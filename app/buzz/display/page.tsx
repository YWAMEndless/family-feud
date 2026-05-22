'use client'
import { useState, useEffect, useRef } from 'react'
import type { TeamNum } from '@/lib/types'
import { TEAM_COLORS } from '@/lib/types'
import { getSupabase } from '@/lib/supabase'

interface BuzzState {
  order: TeamNum[]
  team1Name: string
  team2Name: string
  team3Name: string
}

const ORDINALS = ['1ST', '2ND', '3RD']
const MEDALS = ['🥇', '🥈', '🥉']
const TEAMS: TeamNum[] = [1, 2, 3]

function getTeamName(s: BuzzState, t: TeamNum) {
  return t === 1 ? s.team1Name : t === 2 ? s.team2Name : s.team3Name
}

const DEFAULT: BuzzState = { order: [], team1Name: 'Juniors', team2Name: 'Coaches', team3Name: 'Small Group Guides' }

export default function BuzzDisplayPage() {
  const [state, setState] = useState<BuzzState>(DEFAULT)
  const [names, setNames] = useState([DEFAULT.team1Name, DEFAULT.team2Name, DEFAULT.team3Name])
  const [editingNames, setEditingNames] = useState(false)
  const [animKeys, setAnimKeys] = useState<number[]>([])
  const prevOrderRef = useRef<TeamNum[]>([])
  const audioRef = useRef<AudioContext | null>(null)

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioRef.current
  }

  function playBuzz(position: number, ctx: AudioContext) {
    const t = ctx.currentTime
    const freqs = [[523, 659, 784, 1047], [440, 554, 659], [330, 415, 523]]
    const notes = freqs[Math.min(position, 2)]
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      const s = t + i * 0.1
      g.gain.setValueAtTime(0.3, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.5)
      o.start(s); o.stop(s + 0.5)
    })
  }

  function handleBuzzData(data: BuzzState) {
    const prev = prevOrderRef.current
    const newTeams = data.order.filter(t => !prev.includes(t))
    if (newTeams.length > 0) {
      const newPositions = newTeams.map(t => data.order.indexOf(t))
      setAnimKeys(k => [...k, ...newPositions])
      setTimeout(() => setAnimKeys([]), 800)
      try { const ctx = getAudio(); newPositions.forEach(p => playBuzz(p, ctx)) } catch {}
    }
    prevOrderRef.current = data.order
    setState(data)
    setNames([data.team1Name, data.team2Name, data.team3Name])
  }

  useEffect(() => {
    let active = true

    async function fetchBuzz() {
      try {
        const res = await fetch('/api/buzz', { cache: 'no-store' })
        if (res.ok && active) handleBuzzData(await res.json())
      } catch {}
    }

    // Immediate load + poll every 600ms (reliable across all setups)
    fetchBuzz()
    const pollId = setInterval(fetchBuzz, 600)

    // Supabase Realtime on top — instant when REPLICA IDENTITY FULL is set
    const sb = getSupabase()
    const channel = sb.channel('buzz-display-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_kv' },
        (payload) => {
          const row = payload.new as { key: string; value: BuzzState }
          if (row.key === 'buzz' && row.value) handleBuzzData(row.value)
        })
      .subscribe()

    return () => {
      active = false
      clearInterval(pollId)
      sb.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function reset() {
    // Optimistic clear immediately
    const cleared: BuzzState = { order: [], team1Name: names[0], team2Name: names[1], team3Name: names[2] }
    handleBuzzData(cleared)
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', team1Name: names[0], team2Name: names[1], team3Name: names[2] }),
    })
  }

  async function saveNames() {
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setNames', team1Name: names[0], team2Name: names[1], team3Name: names[2] }),
    })
    setEditingNames(false)
  }

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
          Buzzer Order
        </div>
      </div>

      {/* Main — 3 position slots */}
      <div className="flex-1 flex flex-col justify-center gap-3 px-6 py-4">
        {[0, 1, 2].map(position => {
          const team = state.order[position] as TeamNum | undefined
          const col = team ? TEAM_COLORS[team] : null
          const name = team ? getTeamName(state, team) : null
          const isNew = animKeys.includes(position)

          return (
            <div key={position}
                 className="flex items-center gap-4 px-6 py-5 rounded-2xl"
                 style={{
                   background: team
                     ? `linear-gradient(135deg, ${col!.dark}, ${col!.bg})`
                     : 'rgba(255,255,255,0.04)',
                   border: `2px solid ${team ? col!.border : 'rgba(255,255,255,0.08)'}`,
                   boxShadow: team ? `0 0 20px ${col!.glow}44` : 'none',
                   animation: isNew ? 'slideDown 0.4s cubic-bezier(0.23,1,0.32,1)' : 'none',
                   minHeight: 90,
                 }}>

              {/* Medal */}
              <div className="text-4xl flex-shrink-0 w-12 text-center">
                {team ? MEDALS[position] : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 28 }}>{position + 1}</span>}
              </div>

              {/* Ordinal */}
              <div className="flex-shrink-0 text-center" style={{ width: 60 }}>
                <div className="text-2xl font-display"
                     style={{
                       color: team
                         ? position === 0 ? '#f5c842'
                         : position === 1 ? '#d1d5db'
                         : '#b45309'
                         : 'rgba(255,255,255,0.15)',
                     }}>
                  {ORDINALS[position]}
                </div>
              </div>

              {/* Team name */}
              <div className="flex-1">
                {team ? (
                  <div className="text-2xl md:text-3xl font-display tracking-wider"
                       style={{ color: 'white' }}>
                    {name!.toUpperCase()}
                  </div>
                ) : (
                  <div className="text-lg animate-pulse"
                       style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Arial' }}>
                    Waiting…
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 px-6 pb-6 flex flex-wrap items-center justify-between gap-3">
        {editingNames ? (
          <div className="flex items-center gap-2 flex-wrap">
            {TEAMS.map(t => (
              <input key={t} value={names[t - 1]}
                     onChange={e => setNames(prev => prev.map((v, i) => i === t - 1 ? e.target.value : v))}
                     className="px-3 py-2 rounded text-sm font-bold w-32"
                     style={{ background: '#1a3c7f', border: `1px solid ${TEAM_COLORS[t].border}88`, color: 'white' }} />
            ))}
            <button onClick={saveNames} className="px-4 py-2 rounded text-sm font-bold"
                    style={{ background: '#f5c842', color: '#0B1437' }}>Save</button>
            <button onClick={() => setEditingNames(false)} className="px-4 py-2 rounded text-sm font-bold"
                    style={{ background: '#374151', color: 'white' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditingNames(true)}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: '#1a3c7f', color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial' }}>
            ✏ Team Names
          </button>
        )}

        <button onClick={reset}
                className="px-8 py-3 rounded-xl text-lg font-display tracking-widest transition-all hover:scale-105 active:scale-95"
                style={{
                  background: state.order.length > 0 ? 'linear-gradient(135deg, #f5c842, #c99a00)' : '#1a3c7f',
                  color: state.order.length > 0 ? '#0B1437' : 'rgba(255,255,255,0.4)',
                  border: state.order.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: state.order.length > 0 ? '0 4px 20px rgba(245,200,66,0.4)' : 'none',
                }}>
          RESET BUZZERS
        </button>
      </div>
    </div>
  )
}
