'use client'
import { useState, useEffect, useRef } from 'react'

interface BuzzState {
  winner: 1 | 2 | null
  team1Name: string
  team2Name: string
  locked: boolean
}

export default function BuzzDisplayPage() {
  const [state, setState] = useState<BuzzState | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const [editingNames, setEditingNames] = useState(false)
  const [t1, setT1] = useState('Team 1')
  const [t2, setT2] = useState('Team 2')
  const prevWinner = useRef<1 | 2 | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioRef.current
  }

  function playFanfare(ctx: AudioContext) {
    const t = ctx.currentTime
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      const s = t + i * 0.1
      g.gain.setValueAtTime(0.3, s)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.5)
      o.start(s); o.stop(s + 0.6)
    })
  }

  useEffect(() => {
    let ignore = false

    async function poll() {
      try {
        const res = await fetch('/api/buzz', { cache: 'no-store' })
        if (res.ok && !ignore) {
          const data: BuzzState = await res.json()
          setState(prev => {
            if (!prev?.winner && data.winner) {
              setAnimKey(k => k + 1)
              try { playFanfare(getAudio()) } catch {}
            }
            return data
          })
          setT1(data.team1Name)
          setT2(data.team2Name)
          prevWinner.current = data.winner
        }
      } catch {}
    }

    poll()
    const id = setInterval(poll, 300)
    return () => { ignore = true; clearInterval(id) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function reset() {
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', team1Name: t1, team2Name: t2 }),
    })
    setState(s => s ? { ...s, winner: null, locked: false } : s)
  }

  async function saveNames() {
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setNames', team1Name: t1, team2Name: t2 }),
    })
    setEditingNames(false)
  }

  const winner = state?.winner ?? null
  const team1Name = state?.team1Name ?? 'Team 1'
  const team2Name = state?.team2Name ?? 'Team 2'

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #0d1f4c 100%)' }}
         onClick={() => { try { getAudio() } catch {} }}>

      {/* Header */}
      <div className="flex-shrink-0 py-5 text-center"
           style={{ background: 'linear-gradient(90deg, #0B1437, #1a3c7f, #0B1437)' }}>
        <div className="text-4xl md:text-5xl font-display tracking-[0.2em]"
             style={{ color: '#f5c842', textShadow: '0 0 15px rgba(245,200,66,0.4), 2px 2px 0 #c99a00' }}>
          FAMILY FEUD
        </div>
        <div className="text-sm mt-1 tracking-widest uppercase"
             style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>
          Buzzer Display
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">

        {winner ? (
          // Winner announcement
          <div key={animKey}
               className="text-center"
               style={{ animation: 'slideDown 0.4s cubic-bezier(0.23,1,0.32,1)' }}>
            <div className="text-lg mb-3 tracking-widest uppercase"
                 style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial' }}>
              FIRST TO BUZZ IN:
            </div>
            <div className="px-12 py-8 rounded-3xl"
                 style={{
                   background: winner === 1 ? '#1d5db8' : '#b91c1c',
                   border: '4px solid #f5c842',
                   boxShadow: '0 0 40px rgba(245,200,66,0.6), 0 0 80px rgba(245,200,66,0.3)',
                   animation: 'pulseGold 1.5s ease-in-out infinite',
                 }}>
              <div className="text-5xl md:text-7xl font-display tracking-wider"
                   style={{ color: 'white', textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                {winner === 1 ? team1Name.toUpperCase() : team2Name.toUpperCase()}
              </div>
            </div>
          </div>
        ) : (
          // Waiting state — show both team panels
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl">
            {([1, 2] as const).map(t => (
              <div key={t}
                   className="flex-1 flex items-center justify-center py-10 rounded-2xl"
                   style={{
                     background: 'rgba(255,255,255,0.05)',
                     border: '2px solid rgba(255,255,255,0.1)',
                   }}>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-display tracking-wider"
                       style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {(t === 1 ? team1Name : team2Name).toUpperCase()}
                  </div>
                  <div className="mt-3 text-sm animate-pulse"
                       style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Arial' }}>
                    waiting…
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions when waiting */}
        {!winner && (
          <div className="text-center text-xl font-display tracking-widest"
               style={{ color: 'rgba(255,255,255,0.2)' }}>
            READY FOR BUZZ
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex-shrink-0 px-6 pb-6 flex flex-wrap items-center justify-between gap-3">

        {/* Name editor */}
        {editingNames ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input value={t1} onChange={e => setT1(e.target.value)}
                   className="px-3 py-2 rounded text-sm font-bold w-28"
                   style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.5)', color: 'white' }} />
            <input value={t2} onChange={e => setT2(e.target.value)}
                   className="px-3 py-2 rounded text-sm font-bold w-28"
                   style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.5)', color: 'white' }} />
            <button onClick={saveNames}
                    className="px-4 py-2 rounded text-sm font-bold"
                    style={{ background: '#f5c842', color: '#0B1437' }}>
              Save
            </button>
            <button onClick={() => setEditingNames(false)}
                    className="px-4 py-2 rounded text-sm font-bold"
                    style={{ background: '#374151', color: 'white' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingNames(true)}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: '#1a3c7f', color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial' }}>
            ✏ Team Names
          </button>
        )}

        <button
          onClick={reset}
          className="px-8 py-3 rounded-xl text-lg font-display tracking-widest transition-all hover:scale-105 active:scale-95"
          style={{
            background: winner ? 'linear-gradient(135deg, #f5c842, #c99a00)' : '#1a3c7f',
            color: winner ? '#0B1437' : 'rgba(255,255,255,0.5)',
            border: winner ? 'none' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: winner ? '0 4px 20px rgba(245,200,66,0.4)' : 'none',
          }}>
          RESET BUZZERS
        </button>
      </div>
    </div>
  )
}
