'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { GameState, SyncMessage, TeamNum } from '@/lib/types'
import { TEAM_COLORS } from '@/lib/types'
import { getSupabase } from '@/lib/supabase'
import questionsData from '@/data/questions.json'

const TEAMS: TeamNum[] = [1, 2, 3]
function getTeamName(s: GameState, t: TeamNum) {
  return t === 1 ? s.team1Name : t === 2 ? s.team2Name : s.team3Name
}
function getTeamScore(s: GameState, t: TeamNum) {
  return t === 1 ? s.team1Score : t === 2 ? s.team2Score : s.team3Score
}

const CHANNEL = 'family-feud-sync'

// Web Audio API sound effects
function playSound(type: SyncMessage['sound'], ctx: AudioContext) {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.connect(ctx.destination)

  if (type === 'ding') {
    // Bright ascending "ding" for correct answer
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(master)
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1)
    gain.gain.setValueAtTime(0.5, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc.start(now)
    osc.stop(now + 0.6)
  } else if (type === 'wrong') {
    // Buzzer for strike
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(master)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4)
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    osc.start(now)
    osc.stop(now + 0.4)
  } else if (type === 'winner') {
    // Victory fanfare
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(master)
      osc.frequency.value = freq
      const t = now + i * 0.1
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  }
}

interface BuzzState {
  order: TeamNum[]
  team1Name: string
  team2Name: string
  team3Name: string
}

export default function GamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [buzzState, setBuzzState] = useState<BuzzState | null>(null)
  const [animatingIndices, setAnimatingIndices] = useState<number[]>([])
  const [strikeAnim, setStrikeAnim] = useState(false)
  const prevStrikesRef = useRef(0)
  const prevRevealedRef = useRef<boolean[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Init audio context on first interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }
    window.addEventListener('click', initAudio, { once: true })
    window.addEventListener('keydown', initAudio, { once: true })
  }, [])

  function applyState(newState: GameState, sound?: SyncMessage['sound']) {
    const prev = prevRevealedRef.current
    const newlyRevealed: number[] = []
    newState.revealedAnswers.forEach((revealed, i) => {
      if (revealed && !prev[i]) newlyRevealed.push(i)
    })

    if (newlyRevealed.length > 0) {
      setAnimatingIndices(newlyRevealed)
      setTimeout(() => setAnimatingIndices([]), 600)
    }

    if (newState.strikes > prevStrikesRef.current) {
      setStrikeAnim(true)
      setTimeout(() => setStrikeAnim(false), 600)
    }
    prevStrikesRef.current = newState.strikes
    prevRevealedRef.current = [...newState.revealedAnswers]

    setGameState(newState)

    if (sound && audioCtxRef.current) {
      playSound(sound, audioCtxRef.current)
    }
  }

  // BroadcastChannel (same-device) + Supabase Realtime (cross-device)
  useEffect(() => {
    // BroadcastChannel for same-device host↔display
    const ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data.type === 'STATE_UPDATE' && e.data.state) applyState(e.data.state)
      else if (e.data.type === 'SOUND' && e.data.sound && audioCtxRef.current) playSound(e.data.sound, audioCtxRef.current)
    }
    ch.postMessage({ type: 'REQUEST_STATE' } as SyncMessage)

    // Load initial state from Supabase
    const sb = getSupabase()
    Promise.all([
      sb.from('game_kv').select('value').eq('key', 'game').single(),
      sb.from('game_kv').select('value').eq('key', 'buzz').single(),
    ]).then(([game, buzz]) => {
      if ((game.data as any)?.value) applyState((game.data as any).value)
      if ((buzz.data as any)?.value) setBuzzState((buzz.data as any).value)
    })

    // Supabase Realtime — instant push whenever host saves state
    const channel = sb.channel('game-kv-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_kv' },
        (payload) => {
          const row = payload.new as { key: string; value: unknown }
          if (row.key === 'game' && row.value) applyState(row.value as GameState)
          if (row.key === 'buzz' && row.value) setBuzzState(row.value as BuzzState)
        })
      .subscribe()

    return () => {
      ch.close()
      sb.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────
  // Use live state if available, otherwise show a default idle board so the
  // screen is never blank while the host is setting up
  const defaultState = makeDisplayDefault()
  const live = gameState ?? defaultState
  const isConnected = gameState !== null

  const q = questionsData.questions[live.currentQuestionIndex]

  return (
    <div className="min-h-screen flex flex-col tv-overlay"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #0d1f4c 100%)' }}>

      {/* Title bar: buzzer widget left | logo center | balance right */}
      <div className="flex-shrink-0 flex items-center py-1 px-3 gap-2"
           style={{ background: 'linear-gradient(90deg, #0B1437, #1a3c7f, #0B1437)' }}>
        <div className="w-44 flex-shrink-0">
          <BuzzerWidget buzz={buzzState} />
        </div>
        <div className="flex-1 flex justify-center">
          <Image src="/logo.png" alt="Family Feud" width={480} height={320}
                 priority style={{ height: 110, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="w-44 flex-shrink-0" />
      </div>

      {/* Horizontal dot strip */}
      <DotLights />

      {/* Question — visible once playing */}
      {live.phase !== 'idle' ? (
        <div className="flex-shrink-0 mx-4 py-3 px-6 rounded-xl text-center"
             style={{
               background: 'linear-gradient(135deg, #1a3c7f, #1d5db8)',
               border: '2px solid #f5c842',
               boxShadow: '0 0 20px rgba(245,200,66,0.2)',
             }}>
          <p className="text-xl md:text-2xl font-bold leading-tight"
             style={{ color: 'white', fontFamily: 'Arial Black, sans-serif' }}>
            {q.question}
          </p>
        </div>
      ) : (
        <div className="flex-shrink-0 mx-4 py-3 px-6 rounded-xl text-center"
             style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(245,200,66,0.2)' }}>
          <p className="text-2xl font-display tracking-widest"
             style={{ color: 'rgba(245,200,66,0.5)' }}>
            SURVEY SAYS…
          </p>
          {!isConnected && (
            <p className="text-sm mt-1 animate-pulse" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Arial' }}>
              Waiting for host to connect
            </p>
          )}
        </div>
      )}

      {/* Answer Board with vertical dot borders on each side */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left vertical dots */}
        <VerticalDots />

        {/* Answers */}
        <div className="flex-1 flex flex-col justify-center py-2 gap-1.5">
        {(
          q.answers.map((ans, i) => {
            const revealed = live.revealedAnswers[i] ?? false
            const isAnimating = animatingIndices.includes(i)
            // Scale font based on text length so long answers always fit
            const textSize = ans.text.length > 42 ? 'text-sm md:text-base' :
                             ans.text.length > 28 ? 'text-base md:text-lg' :
                             'text-lg md:text-xl'
            return (
              <div key={i}
                   className="flex items-center gap-0 overflow-hidden rounded-lg flex-1"
                   style={{
                     minHeight: 48,
                     maxHeight: 76,
                     border: '2px solid',
                     borderColor: revealed ? '#f5c842' : 'rgba(245,200,66,0.25)',
                     boxShadow: revealed ? '0 0 12px rgba(245,200,66,0.3)' : 'none',
                     transition: 'border-color 0.3s, box-shadow 0.3s',
                   }}>

                {/* Number */}
                <div className="flex-shrink-0 w-11 h-full flex items-center justify-center text-lg font-display"
                     style={{ background: '#1a3c7f', color: '#f5c842' }}>
                  {i + 1}
                </div>

                {/* Answer text */}
                <div className="flex-1 h-full flex items-center px-3 relative overflow-hidden"
                     style={{ background: revealed ? '#1d5db8' : '#0d1f4c' }}>
                  {revealed ? (
                    <span
                      className={`${textSize} font-bold uppercase leading-tight`}
                      style={{
                        color: 'white',
                        fontFamily: 'Arial Black, sans-serif',
                        animation: isAnimating ? 'slideReveal 0.4s ease-out' : 'none',
                      }}>
                      {ans.text}
                    </span>
                  ) : (
                    <div className="w-full h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  )}
                </div>

                {/* Points */}
                <div className="flex-shrink-0 w-16 h-full flex items-center justify-center text-xl font-display"
                     style={{
                       background: revealed ? '#0f3b80' : '#0a1830',
                       color: revealed ? '#f5c842' : 'rgba(255,255,255,0.15)',
                     }}>
                  {revealed ? ans.points : ''}
                </div>
              </div>
            )
          })
        )}
        </div>{/* end answers flex-1 */}

        {/* Right vertical dots */}
        <VerticalDots />

      </div>{/* end answer board row */}

      {/* Horizontal dot strip */}
      <DotLights />

      {/* Strikes + round points row */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 px-4 pt-1 pb-1">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i}
                 className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold ${i < live.strikes && strikeAnim ? 'strike-appear' : ''}`}
                 style={{
                   background: i < live.strikes ? '#dc2626' : 'rgba(255,255,255,0.08)',
                   color: 'white',
                   border: '2px solid',
                   borderColor: i < live.strikes ? '#dc2626' : 'rgba(255,255,255,0.15)',
                   transition: 'all 0.3s',
                 }}>
              {i < live.strikes ? '✗' : ''}
            </div>
          ))}
        </div>
        {live.roundPoints > 0 && (
          <div className="text-center">
            <span className="text-xs uppercase tracking-wider mr-1" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>on board</span>
            <span className="text-2xl font-display" style={{ color: '#f5c842' }}>{live.roundPoints}</span>
          </div>
        )}
        {live.phase === 'steal' && (
          <div className="steal-pulse px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider"
               style={{ background: '#f5c842', color: '#0B1437', fontFamily: 'Arial Black' }}>
            STEAL!
          </div>
        )}
      </div>

      {/* Bottom bar: 3 team scores */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-2 px-4 pb-4">
        {TEAMS.map(t => {
          const active = live.controllingTeam === t
          const stealing = live.stealTeam === t
          const col = TEAM_COLORS[t]
          return (
            <div key={t}
                 className={`rounded-xl py-3 px-3 text-center transition-all ${active ? 'team-active' : ''}`}
                 style={{
                   background: `linear-gradient(135deg, ${col.dark}, ${col.bg})`,
                   border: '2px solid',
                   borderColor: active || stealing ? '#f5c842' : `${col.border}55`,
                   boxShadow: active ? `0 0 16px ${col.glow}55` : 'none',
                 }}>
              <div className="text-xs uppercase tracking-widest mb-1 truncate"
                   style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial' }}>
                {getTeamName(live, t)}
                {active && <span style={{ color: '#f5c842' }}> ★</span>}
                {stealing && <span style={{ color: '#f5c842' }}> 🔥</span>}
              </div>
              <div className="text-3xl md:text-4xl font-display" style={{ color: 'white' }}>
                {getTeamScore(live, t)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function makeDisplayDefault(): GameState {
  const q = questionsData.questions[0]
  const [t1, t2, t3] = questionsData.teamNames
  return {
    phase: 'idle', currentQuestionIndex: 0, controllingTeam: null, stealTeam: null,
    team1Name: t1, team2Name: t2, team3Name: t3,
    team1Score: 0, team2Score: 0, team3Score: 0,
    strikes: 0, revealedAnswers: new Array(q.answers.length).fill(false),
    roundPoints: 0, lastRevealedIndex: null,
  }
}

const MEDALS = ['🥇', '🥈', '🥉']
const ORDINALS = ['1ST', '2ND', '3RD']

function BuzzerWidget({ buzz }: { buzz: BuzzState | null }) {
  const order = buzz?.order ?? []
  const names = [buzz?.team1Name ?? 'Juniors', buzz?.team2Name ?? 'Coaches', buzz?.team3Name ?? 'Small Group Guides']

  function getTeamName(t: TeamNum) { return names[t - 1] }

  return (
    <div className="rounded-xl overflow-hidden"
         style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)' }}>
      <div className="px-2 py-0.5 text-center"
           style={{ background: 'rgba(0,0,0,0.5)', fontSize: 8, letterSpacing: '0.2em',
                    color: 'rgba(255,255,255,0.4)', fontFamily: 'Arial', textTransform: 'uppercase' }}>
        Buzzers
      </div>
      <div className="flex flex-col gap-0.5 p-1.5">
        {[0, 1, 2].map(pos => {
          const team = order[pos] as TeamNum | undefined
          const col = team ? TEAM_COLORS[team] : null
          return (
            <div key={pos}
                 className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                 style={{
                   background: team ? `${col!.bg}cc` : 'rgba(255,255,255,0.03)',
                   border: `1px solid ${team ? col!.border + '88' : 'rgba(255,255,255,0.06)'}`,
                   boxShadow: team && pos === 0 ? `0 0 8px ${col!.glow}66` : 'none',
                 }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>{team ? MEDALS[pos] : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>{pos + 1}</span>}</span>
              <span style={{
                fontSize: 10, fontFamily: 'Arial Black', color: team ? 'white' : 'rgba(255,255,255,0.2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
              }}>
                {team ? getTeamName(team) : '—'}
              </span>
              {team && (
                <span style={{ fontSize: 8, color: pos === 0 ? '#f5c842' : 'rgba(255,255,255,0.5)',
                               fontFamily: 'Arial', letterSpacing: '0.1em', flexShrink: 0 }}>
                  {ORDINALS[pos]}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {order.length === 0 && (
        <div className="text-center pb-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)',
             fontFamily: 'Arial', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ready
        </div>
      )}
    </div>
  )
}

function DotLights() {
  const dots = Array.from({ length: 40 })
  return (
    <div className="flex-shrink-0 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 px-4 py-1.5">
      {dots.map((_, i) => (
        <div key={i} className="rounded-full flex-shrink-0"
             style={{
               width: 9, height: 9,
               background: '#f97316',
               boxShadow: '0 0 5px #f97316, 0 0 10px #f9731655',
               animation: 'dotPulse 2s ease-in-out infinite',
               animationDelay: `${(i % 7) * 0.28}s`,
             }} />
      ))}
    </div>
  )
}

function VerticalDots() {
  const dots = Array.from({ length: 18 })
  return (
    <div className="flex-shrink-0 flex flex-col justify-around items-center py-1"
         style={{ width: 28, paddingLeft: 4, paddingRight: 4 }}>
      {dots.map((_, i) => (
        <div key={i} className="rounded-full"
             style={{
               width: 10, height: 10,
               background: '#f97316',
               boxShadow: '0 0 6px #f97316, 0 0 14px #f9731666',
               animation: 'dotPulse 2s ease-in-out infinite',
               animationDelay: `${(i % 6) * 0.33}s`,
             }} />
      ))}
    </div>
  )
}

