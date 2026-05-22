'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { TeamNum } from '@/lib/types'
import { TEAM_COLORS } from '@/lib/types'
import { getSupabase } from '@/lib/supabase'

interface BuzzState {
  order: TeamNum[]
  team1Name: string
  team2Name: string
  team3Name: string
}

function getTeamName(s: BuzzState, t: TeamNum) {
  return t === 1 ? s.team1Name : t === 2 ? s.team2Name : s.team3Name
}

const ORDINALS = ['1ST', '2ND', '3RD']
const MEDALS = ['🥇', '🥈', '🥉']
const TEAMS: TeamNum[] = [1, 2, 3]

function BuzzerInner() {
  const params = useSearchParams()
  const raw = params.get('team')
  const team: TeamNum | null = raw === '1' ? 1 : raw === '2' ? 2 : raw === '3' ? 3 : null

  const [buzzState, setBuzzState] = useState<BuzzState>({ order: [], team1Name: 'Juniors', team2Name: 'Coaches', team3Name: 'Small Group Guides' })
  const [sending, setSending] = useState(false)
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
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = f
      const s = t + i * 0.08
      g.gain.setValueAtTime(0.4, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.4)
      o.start(s); o.stop(s + 0.4)
    })
  }

  function playPlace(ctx: AudioContext, position: number) {
    // Different tones for 1st/2nd/3rd
    const freqs = [[880, 1047], [660, 784], [440, 523]]
    const pair = freqs[Math.min(position, 2)]
    const t = ctx.currentTime
    pair.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = f
      const s = t + i * 0.12
      g.gain.setValueAtTime(0.35, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.35)
      o.start(s); o.stop(s + 0.35)
    })
  }

  const prevOrderRef = useRef<TeamNum[]>([])

  function applyBuzzData(data: BuzzState) {
    const prev = prevOrderRef.current
    // Play sound when my position is newly confirmed by server
    if (team && data.order.includes(team) && !prev.includes(team)) {
      const position = data.order.indexOf(team)
      try { playPlace(getAudio(), position) } catch {}
    }
    prevOrderRef.current = data.order
    setBuzzState(data)
    // Clear optimistic lock if server reset happened
    if (data.order.length === 0) setSending(false)
  }

  useEffect(() => {
    if (!team) return
    let active = true

    async function fetchBuzz() {
      try {
        const res = await fetch('/api/buzz', { cache: 'no-store' })
        if (res.ok && active) applyBuzzData(await res.json())
      } catch {}
    }

    fetchBuzz()
    const pollId = setInterval(fetchBuzz, 600)

    // Realtime on top for instant updates
    const sb = getSupabase()
    const channel = sb.channel(`buzz-phone-rt-${team}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_kv' },
        (payload) => {
          const row = payload.new as { key: string; value: BuzzState }
          if (row.key === 'buzz' && row.value) applyBuzzData(row.value)
        })
      .subscribe()

    return () => {
      active = false
      clearInterval(pollId)
      sb.removeChannel(channel)
    }
  }, [team]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBuzz() {
    if (!team || sending) return
    // Check already buzzed
    if (buzzState.order.includes(team)) return
    setSending(true)
    try {
      // Optimistic update so button locks immediately
      setBuzzState(prev => ({
        ...prev,
        order: prev.order.includes(team) ? prev.order : [...prev.order, team],
      }))
      const res = await fetch('/api/buzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buzz', team }),
      })
      if (res.ok) {
        const data: BuzzState = await res.json()
        const position = data.order.indexOf(team)
        try { playPlace(getAudio(), position) } catch {}
        setBuzzState(data)
      }
    } catch {
      // On error, revert optimistic update
      setBuzzState(prev => ({ ...prev, order: prev.order.filter(t => t !== team) }))
    } finally {
      setSending(false)
    }
  }

  // No team selected — show selector
  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
           style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 100%)' }}>
        <div className="text-center">
          <div className="text-4xl font-display" style={{ color: '#f5c842' }}>FAMILY FEUD</div>
          <div className="text-lg mt-1" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial' }}>
            Choose your team to buzz in
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {TEAMS.map(t => {
            const col = TEAM_COLORS[t]
            const name = getTeamName(buzzState, t)
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
  const teamName = getTeamName(buzzState, team)
  const myPosition = buzzState.order.indexOf(team) // -1 if not buzzed yet
  const hasBuzzed = myPosition !== -1
  const positionLabel = hasBuzzed ? ORDINALS[myPosition] : null
  const medal = hasBuzzed ? MEDALS[myPosition] : null

  // Background changes based on position
  const bgColor = hasBuzzed
    ? myPosition === 0 ? '#052e16'   // 1st = dark green
    : myPosition === 1 ? '#1c1917'   // 2nd = dark stone
    : '#18181b'                       // 3rd = dark zinc
    : `linear-gradient(180deg, ${col.dark} 0%, #0B1437 100%)`

  return (
    <div className="min-h-screen flex flex-col select-none"
         style={{ background: bgColor }}>

      {/* Team header */}
      <div className="flex-shrink-0 py-4 text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="text-3xl font-display tracking-wider" style={{ color: col.glow }}>
          {teamName.toUpperCase()}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">

        {hasBuzzed ? (
          // Locked — show position
          <div className="w-full flex flex-col items-center gap-4">
            <div className="text-7xl">{medal}</div>
            <div className="text-6xl font-display tracking-widest"
                 style={{
                   color: myPosition === 0 ? '#f5c842' : myPosition === 1 ? '#d1d5db' : '#b45309',
                   textShadow: myPosition === 0 ? '0 0 20px rgba(245,200,66,0.5)' : 'none',
                 }}>
              {positionLabel}
            </div>
            <div className="text-xl font-bold uppercase tracking-wider"
                 style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial' }}>
              {myPosition === 0 ? 'You buzzed first!' : myPosition === 1 ? 'You were second' : 'You were third'}
            </div>
            <div className="mt-4 text-sm text-center"
                 style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Arial' }}>
              Waiting for host to reset…
            </div>
          </div>
        ) : (
          // Button — tap to buzz
          <button
            onClick={handleBuzz}
            disabled={sending}
            className="w-full rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
            style={{
              background: `linear-gradient(135deg, ${col.dark}, ${col.bg})`,
              minHeight: '52vh',
              maxHeight: 440,
              border: `4px solid ${col.border}`,
              boxShadow: `0 0 30px ${col.bg}66, 0 0 60px ${col.bg}33`,
            }}>
            <div className="text-8xl font-display" style={{ lineHeight: 1 }}>
              {teamName.charAt(0)}
            </div>
            <div className="text-3xl font-display tracking-widest">
              {sending ? 'SENDING…' : 'BUZZ!'}
            </div>
          </button>
        )}

        {/* Show others' positions */}
        {buzzState.order.length > 0 && (
          <div className="w-full space-y-1.5">
            {buzzState.order.map((t, i) => {
              const tCol = TEAM_COLORS[t]
              const tName = getTeamName(buzzState, t)
              return (
                <div key={t} className="flex items-center gap-3 px-4 py-2 rounded-xl"
                     style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${tCol.border}44` }}>
                  <span style={{ fontSize: 18 }}>{MEDALS[i]}</span>
                  <span className="font-bold text-sm" style={{ color: tCol.glow, fontFamily: 'Arial' }}>
                    {ORDINALS[i]}
                  </span>
                  <span className="flex-1 font-bold text-sm" style={{ color: 'white', fontFamily: 'Arial' }}>
                    {tName}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 py-3 text-center text-xs"
           style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'Arial' }}>
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
