'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { TeamNum } from '@/lib/types'
import { TEAM_COLORS } from '@/lib/types'

interface BuzzState {
  winner: TeamNum | null
  team1Name: string
  team2Name: string
  team3Name: string
  locked: boolean
}

function getTeamName(s: BuzzState, t: TeamNum) {
  return t === 1 ? s.team1Name : t === 2 ? s.team2Name : s.team3Name
}

const TEAMS: TeamNum[] = [1, 2, 3]

function BuzzerInner() {
  const params = useSearchParams()
  const raw = params.get('team')
  const team: TeamNum | null = raw === '1' ? 1 : raw === '2' ? 2 : raw === '3' ? 3 : null

  const [buzzState, setBuzzState] = useState<BuzzState | null>(null)
  const [myBuzzed, setMyBuzzed] = useState(false)
  const [pressing, setPressing] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const prevWinnerRef = useRef<TeamNum | null>(null)

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioRef.current
  }

  function playWin(ctx: AudioContext) {
    const t = ctx.currentTime
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = f
      const s = t + i * 0.08
      g.gain.setValueAtTime(0.4, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.4)
      o.start(s); o.stop(s + 0.4)
    })
  }

  function playLose(ctx: AudioContext) {
    const t = ctx.currentTime
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.5)
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.start(t); o.stop(t + 0.5)
  }

  async function fetchState() {
    try {
      const res = await fetch('/api/buzz', { cache: 'no-store' })
      if (res.ok) {
        const data: BuzzState = await res.json()
        const prev = prevWinnerRef.current
        if (!prev && data.winner && team) {
          try {
            const ctx = getAudio()
            if (data.winner === team) playWin(ctx); else playLose(ctx)
          } catch {}
        }
        prevWinnerRef.current = data.winner
        setBuzzState(data)
      }
    } catch {}
  }

  useEffect(() => {
    fetchState()
    pollRef.current = setInterval(fetchState, 300)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBuzz() {
    if (!team || buzzState?.locked || myBuzzed) return
    setMyBuzzed(true)
    try {
      const res = await fetch('/api/buzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buzz', team }),
      })
      const data: BuzzState = await res.json()
      setBuzzState(data)
    } catch {}
  }

  // No team — show selector
  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
           style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 100%)' }}>
        <div className="text-center">
          <div className="text-4xl font-display" style={{ color: '#f5c842' }}>FAMILY FEUD</div>
          <div className="text-lg mt-1" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial' }}>Choose your team to buzz in</div>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {TEAMS.map(t => {
            const col = TEAM_COLORS[t]
            const name = buzzState ? getTeamName(buzzState, t) : ['Juniors', 'Coaches', 'Small Group Guides'][t - 1]
            return (
              <a key={t} href={`/buzz?team=${t}`}
                 className="block text-center py-6 rounded-2xl text-2xl font-display tracking-wider transition-all hover:scale-105"
                 style={{
                   background: `linear-gradient(135deg, ${col.dark}, ${col.bg})`,
                   color: 'white',
                   border: `2px solid ${col.border}`,
                   boxShadow: `0 4px 20px ${col.bg}66`,
                 }}>
                {name.toUpperCase()}
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  const col = TEAM_COLORS[team]
  const teamName = buzzState ? getTeamName(buzzState, team) : ['Juniors', 'Coaches', 'Small Group Guides'][team - 1]
  const winner = buzzState?.winner ?? null
  const iWon = winner === team
  const iLost = winner !== null && winner !== team
  const locked = buzzState?.locked ?? false
  const winnerName = winner && buzzState ? getTeamName(buzzState, winner) : ''

  return (
    <div className="min-h-screen flex flex-col select-none"
         style={{
           background: iWon ? '#052e16'
             : iLost ? '#111827'
             : `linear-gradient(180deg, ${col.dark} 0%, #0B1437 100%)`,
         }}>

      {/* Team header */}
      <div className="flex-shrink-0 py-5 text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="text-3xl font-display tracking-wider" style={{ color: col.glow }}>
          {teamName.toUpperCase()}
        </div>
      </div>

      {/* Buzz button */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <button
          onPointerDown={() => { setPressing(true); handleBuzz() }}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          disabled={locked}
          className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 transition-all disabled:cursor-default"
          style={{
            background: iWon ? '#16a34a' : iLost ? '#374151' : `linear-gradient(135deg, ${col.dark}, ${col.bg})`,
            minHeight: '50vh',
            maxHeight: 420,
            border: `4px solid ${iWon ? '#22c55e' : iLost ? '#374151' : col.border}`,
            boxShadow: iWon ? '0 0 40px rgba(22,163,74,0.6)' : iLost ? 'none' : `0 0 30px ${col.bg}66`,
            transform: pressing && !locked ? 'scale(0.97)' : 'scale(1)',
          }}>
          {iWon ? (
            <><div className="text-6xl">✓</div><div className="text-3xl font-display tracking-wider">FIRST!</div></>
          ) : iLost ? (
            <><div className="text-5xl">✗</div><div className="text-2xl font-display">TOO SLOW</div></>
          ) : (
            <>
              <div className="text-8xl font-display" style={{ lineHeight: 1 }}>
                {teamName.charAt(0)}
              </div>
              <div className="text-2xl font-display tracking-wider">BUZZ!</div>
            </>
          )}
        </button>

        <div className="text-xl font-bold text-center"
             style={{
               color: iWon ? '#f5c842' : iLost ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
               fontFamily: 'Arial Black, sans-serif',
             }}>
          {iWon ? '🎉 YOU BUZZED FIRST!'
            : iLost ? `${winnerName} buzzed first`
            : 'TAP TO BUZZ IN!'}
        </div>
      </div>

      <div className="flex-shrink-0 py-3 text-center text-xs"
           style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Arial' }}>
        FAMILY FEUD BUZZER
      </div>
    </div>
  )
}

export default function BuzzPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1437' }}>
        <div className="text-2xl font-display" style={{ color: '#f5c842' }}>Loading…</div>
      </div>
    }>
      <BuzzerInner />
    </Suspense>
  )
}
