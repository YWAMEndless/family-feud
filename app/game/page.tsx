'use client'
import { useState, useEffect, useRef } from 'react'
import type { GameState, SyncMessage } from '@/lib/types'
import questionsData from '@/data/questions.json'

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

export default function GamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
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

  // BroadcastChannel listener + request initial state
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data.type === 'STATE_UPDATE' && e.data.state) {
        applyState(e.data.state)
      } else if (e.data.type === 'SOUND' && e.data.sound) {
        if (audioCtxRef.current) playSound(e.data.sound, audioCtxRef.current)
      }
    }
    // Request current state from host
    ch.postMessage({ type: 'REQUEST_STATE' } as SyncMessage)

    // Poll API as fallback for cross-device setups
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data) applyState(data)
        }
      } catch {}
    }, 1500)

    return () => {
      ch.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6"
           style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 50%, #0B1437 100%)' }}>
        <div className="text-center">
          <div className="text-7xl font-display tracking-wider"
               style={{ color: '#f5c842', textShadow: '0 0 20px rgba(245,200,66,0.5)' }}>
            FAMILY
          </div>
          <div className="text-7xl font-display tracking-wider mt-1"
               style={{ color: 'white', textShadow: '3px 3px 0 #1a3c7f' }}>
            FEUD
          </div>
        </div>
        <div className="text-lg animate-pulse" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>
          Waiting for host to start…
        </div>
      </div>
    )
  }

  const q = questionsData.questions[gameState.currentQuestionIndex]

  return (
    <div className="min-h-screen flex flex-col tv-overlay"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #0d1f4c 100%)' }}>

      {/* Title bar */}
      <div className="flex-shrink-0 py-4 text-center"
           style={{ background: 'linear-gradient(90deg, #0B1437, #1a3c7f, #0B1437)' }}>
        <span className="text-4xl md:text-5xl font-display tracking-[0.2em]"
              style={{
                color: '#f5c842',
                textShadow: '0 0 15px rgba(245,200,66,0.4), 2px 2px 0 #c99a00',
              }}>
          FAMILY FEUD
        </span>
      </div>

      {/* Question */}
      {gameState.phase !== 'idle' && (
        <div className="flex-shrink-0 mx-4 mt-3 py-4 px-6 rounded-xl text-center"
             style={{
               background: 'linear-gradient(135deg, #1a3c7f, #1d5db8)',
               border: '2px solid #f5c842',
               boxShadow: '0 0 20px rgba(245,200,66,0.2)',
             }}>
          <p className="text-2xl md:text-3xl font-bold leading-tight"
             style={{ color: 'white', fontFamily: 'Arial Black, sans-serif' }}>
            {q.question}
          </p>
        </div>
      )}

      {/* Answer Board */}
      <div className="flex-1 flex flex-col justify-center px-4 py-2 gap-1.5">
        {gameState.phase === 'idle' ? (
          <WaitingBoard />
        ) : (
          q.answers.map((ans, i) => {
            const revealed = gameState.revealedAnswers[i]
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
      </div>

      {/* Bottom bar: scores + strikes */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 pb-4 pt-2">

        {/* Team 1 */}
        <div className={`flex-1 rounded-xl py-3 px-4 text-center transition-all ${gameState.controllingTeam === 1 ? 'team-active' : ''}`}
             style={{
               background: 'linear-gradient(135deg, #1a3c7f, #1d5db8)',
               border: '2px solid',
               borderColor: gameState.controllingTeam === 1 ? '#f5c842' : 'rgba(245,200,66,0.3)',
             }}>
          <div className="text-xs uppercase tracking-widest mb-1"
               style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial' }}>
            {gameState.team1Name}
            {gameState.controllingTeam === 1 && <span style={{ color: '#f5c842' }}> ★</span>}
          </div>
          <div className="text-4xl font-display" style={{ color: 'white' }}>
            {gameState.team1Score}
          </div>
        </div>

        {/* Center: round points + strikes */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2 px-2"
             style={{ minWidth: 120 }}>
          {/* Strikes */}
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i}
                   className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold ${i < gameState.strikes && strikeAnim ? 'strike-appear' : ''}`}
                   style={{
                     background: i < gameState.strikes ? '#dc2626' : 'rgba(255,255,255,0.08)',
                     color: 'white',
                     border: '2px solid',
                     borderColor: i < gameState.strikes ? '#dc2626' : 'rgba(255,255,255,0.15)',
                     transition: 'all 0.3s',
                   }}>
                {i < gameState.strikes ? '✗' : ''}
              </div>
            ))}
          </div>

          {/* Round pot */}
          {gameState.roundPoints > 0 && (
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>on board</div>
              <div className="text-2xl font-display" style={{ color: '#f5c842' }}>{gameState.roundPoints}</div>
            </div>
          )}

          {/* Phase indicator */}
          {gameState.phase === 'steal' && (
            <div className="steal-pulse px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider"
                 style={{ background: '#f5c842', color: '#0B1437', fontFamily: 'Arial Black' }}>
              STEAL!
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className={`flex-1 rounded-xl py-3 px-4 text-center transition-all ${gameState.controllingTeam === 2 ? 'team-active' : ''}`}
             style={{
               background: 'linear-gradient(135deg, #1a3c7f, #1d5db8)',
               border: '2px solid',
               borderColor: gameState.controllingTeam === 2 ? '#f5c842' : 'rgba(245,200,66,0.3)',
             }}>
          <div className="text-xs uppercase tracking-widest mb-1"
               style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial' }}>
            {gameState.team2Name}
            {gameState.controllingTeam === 2 && <span style={{ color: '#f5c842' }}> ★</span>}
          </div>
          <div className="text-4xl font-display" style={{ color: 'white' }}>
            {gameState.team2Score}
          </div>
        </div>
      </div>
    </div>
  )
}

function WaitingBoard() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      <div className="text-center space-y-2">
        <div className="text-5xl font-display" style={{ color: '#f5c842' }}>SURVEY SAYS!</div>
        <div className="text-lg animate-pulse" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>
          Get ready…
        </div>
      </div>
    </div>
  )
}
