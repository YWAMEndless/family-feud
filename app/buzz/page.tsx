'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface BuzzState {
  winner: 1 | 2 | null
  team1Name: string
  team2Name: string
  locked: boolean
}

// Team colors
const COLORS: Record<1 | 2, { bg: string; glow: string; dark: string }> = {
  1: { bg: '#1d5db8', glow: '#3b82f6', dark: '#0f3b80' },
  2: { bg: '#b91c1c', glow: '#ef4444', dark: '#7f1d1d' },
}

function BuzzerInner() {
  const params = useSearchParams()
  const teamParam = params.get('team')
  const team = teamParam === '1' ? 1 : teamParam === '2' ? 2 : null

  const [buzzState, setBuzzState] = useState<BuzzState | null>(null)
  const [myBuzzed, setMyBuzzed] = useState(false)
  const [pressing, setPressing] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioRef.current
  }

  function playWin(ctx: AudioContext) {
    const t = ctx.currentTime
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = f
      const s = t + i * 0.08
      g.gain.setValueAtTime(0.4, s)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.4)
      o.start(s); o.stop(s + 0.4)
    })
  }

  function playLose(ctx: AudioContext) {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(200, t)
    o.frequency.exponentialRampToValueAtTime(80, t + 0.5)
    g.gain.setValueAtTime(0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.start(t); o.stop(t + 0.5)
  }

  async function fetchState() {
    try {
      const res = await fetch('/api/buzz', { cache: 'no-store' })
      if (res.ok) {
        const data: BuzzState = await res.json()
        setBuzzState(prev => {
          // Play sound when winner first appears
          if (!prev?.winner && data.winner && team) {
            const ctx = getAudio()
            if (data.winner === team) playWin(ctx)
            else playLose(ctx)
          }
          return data
        })
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

  // No team selected — show selector
  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
           style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 100%)' }}>
        <div className="text-center">
          <div className="text-4xl font-display" style={{ color: '#f5c842' }}>FAMILY FEUD</div>
          <div className="text-lg mt-1" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial' }}>Choose your team</div>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <a href="/buzz?team=1"
             className="block text-center py-6 rounded-2xl text-2xl font-display tracking-wider"
             style={{ background: COLORS[1].bg, color: 'white', boxShadow: `0 4px 20px ${COLORS[1].bg}88` }}>
            {buzzState?.team1Name ?? 'TEAM 1'}
          </a>
          <a href="/buzz?team=2"
             className="block text-center py-6 rounded-2xl text-2xl font-display tracking-wider"
             style={{ background: COLORS[2].bg, color: 'white', boxShadow: `0 4px 20px ${COLORS[2].bg}88` }}>
            {buzzState?.team2Name ?? 'TEAM 2'}
          </a>
        </div>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Arial' }}>
          Or share <strong>/buzz?team=1</strong> and <strong>/buzz?team=2</strong> directly
        </p>
      </div>
    )
  }

  const col = COLORS[team]
  const teamName = team === 1 ? (buzzState?.team1Name ?? 'Team 1') : (buzzState?.team2Name ?? 'Team 2')
  const winner = buzzState?.winner ?? null
  const iWon = winner === team
  const iLost = winner !== null && winner !== team
  const locked = buzzState?.locked ?? false

  // Determine button state
  let buttonBg = col.bg
  let statusText = ''
  let statusColor = 'white'
  let pulse = false

  if (iWon) {
    buttonBg = '#16a34a'
    statusText = '🎉 YOU BUZZED FIRST!'
    statusColor = '#f5c842'
  } else if (iLost) {
    const otherName = team === 1 ? (buzzState?.team2Name ?? 'Team 2') : (buzzState?.team1Name ?? 'Team 1')
    buttonBg = '#374151'
    statusText = `${otherName} buzzed first`
    statusColor = 'rgba(255,255,255,0.5)'
  } else {
    statusText = 'TAP TO BUZZ IN!'
    pulse = true
  }

  return (
    <div className="min-h-screen flex flex-col select-none"
         style={{ background: iWon ? '#052e16' : iLost ? '#111827' : `linear-gradient(180deg, ${col.dark} 0%, #0B1437 100%)` }}>

      {/* Team name header */}
      <div className="flex-shrink-0 py-5 text-center"
           style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="text-3xl font-display tracking-wider" style={{ color: '#f5c842' }}>
          {teamName.toUpperCase()}
        </div>
      </div>

      {/* Main buzz button */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <button
          onPointerDown={() => { setPressing(true); handleBuzz() }}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          disabled={locked}
          className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95 disabled:cursor-default"
          style={{
            background: buttonBg,
            minHeight: '50vh',
            maxHeight: 420,
            border: `4px solid ${iWon ? '#16a34a' : iLost ? '#374151' : col.glow}`,
            boxShadow: iWon
              ? '0 0 40px rgba(22,163,74,0.6), 0 0 80px rgba(22,163,74,0.3)'
              : iLost ? 'none'
              : `0 0 30px ${col.bg}88`,
            transform: pressing && !locked ? 'scale(0.97)' : 'scale(1)',
            animation: pulse ? 'none' : undefined,
          }}>

          {iWon ? (
            <>
              <div className="text-6xl">✓</div>
              <div className="text-3xl font-display tracking-wider">FIRST!</div>
            </>
          ) : iLost ? (
            <>
              <div className="text-5xl">✗</div>
              <div className="text-2xl font-display">TOO SLOW</div>
            </>
          ) : (
            <>
              <div className="text-8xl font-display" style={{ lineHeight: 1 }}>
                {teamName.charAt(0)}
              </div>
              <div className="text-2xl font-display tracking-wider">BUZZ!</div>
            </>
          )}
        </button>

        {/* Status text */}
        <div className="text-xl font-bold text-center"
             style={{ color: statusColor, fontFamily: 'Arial Black, sans-serif' }}>
          {statusText}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-3 text-center text-xs"
           style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Arial' }}>
        FAMILY FEUD BUZZER
      </div>
    </div>
  )
}

export default function BuzzPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: '#0B1437' }}>
        <div className="text-2xl font-display" style={{ color: '#f5c842' }}>Loading…</div>
      </div>
    }>
      <BuzzerInner />
    </Suspense>
  )
}
