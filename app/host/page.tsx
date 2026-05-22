'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { GameState, SyncMessage } from '@/lib/types'
import questionsData from '@/data/questions.json'

const CHANNEL = 'family-feud-sync'

function makeInitialState(): GameState {
  const q = questionsData.questions[0]
  return {
    phase: 'idle',
    currentQuestionIndex: 0,
    controllingTeam: null,
    stealTeam: null,
    team1Name: questionsData.teamNames[0],
    team2Name: questionsData.teamNames[1],
    team1Score: 0,
    team2Score: 0,
    strikes: 0,
    revealedAnswers: new Array(q.answers.length).fill(false),
    roundPoints: 0,
    lastRevealedIndex: null,
  }
}

function computeRoundPoints(state: GameState): number {
  const q = questionsData.questions[state.currentQuestionIndex]
  return q.answers.reduce((sum, ans, i) => sum + (state.revealedAnswers[i] ? ans.points : 0), 0)
}

export default function HostPage() {
  const [state, setState] = useState<GameState>(makeInitialState)
  const [team1Input, setTeam1Input] = useState(questionsData.teamNames[0])
  const [team2Input, setTeam2Input] = useState(questionsData.teamNames[1])
  const [flash, setFlash] = useState<string | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

  // Set up BroadcastChannel
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL)
    channelRef.current = ch
    // If display requests state, send it
    ch.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data.type === 'REQUEST_STATE') {
        ch.postMessage({ type: 'STATE_UPDATE', state } as SyncMessage)
      }
    }
    return () => ch.close()
  }, [state])

  const broadcast = useCallback((newState: GameState, sound?: SyncMessage['sound']) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'STATE_UPDATE', state: newState } as SyncMessage)
      if (sound) {
        channelRef.current.postMessage({ type: 'SOUND', sound } as SyncMessage)
      }
    }
    // Async API sync for cross-device fallback
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState),
    }).catch(() => {})
  }, [])

  const update = useCallback((newState: GameState, sound?: SyncMessage['sound']) => {
    setState(newState)
    broadcast(newState, sound)
  }, [broadcast])

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2000)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function goToQuestion(index: number) {
    const q = questionsData.questions[index]
    if (!q) return
    const next: GameState = {
      ...makeInitialState(),
      currentQuestionIndex: index,
      team1Name: state.team1Name,
      team2Name: state.team2Name,
      team1Score: state.team1Score,
      team2Score: state.team2Score,
      revealedAnswers: new Array(q.answers.length).fill(false),
    }
    update(next)
  }

  function startRound(team: 1 | 2) {
    const next: GameState = { ...state, phase: 'playing', controllingTeam: team, stealTeam: null, strikes: 0 }
    update(next)
    showFlash(`${team === 1 ? state.team1Name : state.team2Name} is playing!`)
  }

  function revealAnswer(index: number) {
    if (state.revealedAnswers[index]) return
    const newRevealed = [...state.revealedAnswers]
    newRevealed[index] = true
    const newPoints = questionsData.questions[state.currentQuestionIndex].answers.reduce(
      (sum, ans, i) => sum + (newRevealed[i] ? ans.points : 0), 0
    )
    const next: GameState = {
      ...state,
      revealedAnswers: newRevealed,
      roundPoints: newPoints,
      lastRevealedIndex: index,
    }
    update(next, 'ding')
  }

  function addStrike() {
    const newStrikes = state.strikes + 1
    if (newStrikes >= 3) {
      // 3 strikes — switch to steal
      const stealTeam = state.controllingTeam === 1 ? 2 : 1
      const next: GameState = { ...state, strikes: newStrikes, phase: 'steal', stealTeam }
      update(next, 'wrong')
      showFlash(`3 Strikes! ${stealTeam === 1 ? state.team1Name : state.team2Name} can STEAL!`)
    } else {
      update({ ...state, strikes: newStrikes }, 'wrong')
    }
  }

  function awardPoints(team: 1 | 2) {
    const pts = state.roundPoints
    const next: GameState = {
      ...state,
      team1Score: team === 1 ? state.team1Score + pts : state.team1Score,
      team2Score: team === 2 ? state.team2Score + pts : state.team2Score,
      phase: 'roundEnd',
    }
    update(next, 'winner')
    showFlash(`+${pts} points to ${team === 1 ? state.team1Name : state.team2Name}!`)
  }

  function resetRound() {
    goToQuestion(state.currentQuestionIndex)
  }

  function updateTeamNames() {
    const next: GameState = { ...state, team1Name: team1Input, team2Name: team2Input }
    update(next)
    showFlash('Team names updated!')
  }

  function adjustScore(team: 1 | 2, delta: number) {
    const next: GameState = {
      ...state,
      team1Score: team === 1 ? Math.max(0, state.team1Score + delta) : state.team1Score,
      team2Score: team === 2 ? Math.max(0, state.team2Score + delta) : state.team2Score,
    }
    update(next)
  }

  function revealAllAnswers() {
    const q = questionsData.questions[state.currentQuestionIndex]
    const newRevealed = new Array(q.answers.length).fill(true)
    const pts = q.answers.reduce((s, a) => s + a.points, 0)
    update({ ...state, revealedAnswers: newRevealed, roundPoints: pts, lastRevealedIndex: null })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const q = questionsData.questions[state.currentQuestionIndex]
  const totalQs = questionsData.questions.length

  const btn = (
    label: string,
    onClick: () => void,
    color = '#1d5db8',
    textColor = 'white',
    disabled = false
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: color,
        color: textColor,
        border: '1px solid rgba(255,255,255,0.15)',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen p-4 text-white" style={{ background: '#0f1729', fontFamily: 'Arial, sans-serif' }}>

      {/* Flash message */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-lg"
             style={{ background: '#f5c842', color: '#0B1437', boxShadow: '0 4px 20px rgba(245,200,66,0.5)' }}>
          {flash}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3"
           style={{ borderBottom: '1px solid rgba(245,200,66,0.3)' }}>
        <div>
          <h1 className="text-2xl font-display" style={{ color: '#f5c842' }}>FAMILY FEUD — HOST</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Controlling: {state.controllingTeam ? (state.controllingTeam === 1 ? state.team1Name : state.team2Name) : 'Nobody yet'}
            {' '} | Phase: {state.phase.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {btn('← Prev', () => goToQuestion(state.currentQuestionIndex - 1), '#0B1437', '#f5c842', state.currentQuestionIndex === 0)}
          <span className="text-sm px-3 py-1 rounded" style={{ background: '#1a3c7f' }}>
            Q {state.currentQuestionIndex + 1} / {totalQs}
          </span>
          {btn('Next →', () => goToQuestion(state.currentQuestionIndex + 1), '#0B1437', '#f5c842', state.currentQuestionIndex === totalQs - 1)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: Answers */}
        <div className="lg:col-span-2 space-y-3">

          {/* Question */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.4)' }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#f5c842' }}>Current Question</p>
            <p className="text-lg font-bold">{q.question}</p>
          </div>

          {/* Answer Slots */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,200,66,0.3)' }}>
            <div className="px-4 py-2 flex justify-between items-center"
                 style={{ background: '#1a3c7f' }}>
              <span className="text-sm font-bold" style={{ color: '#f5c842' }}>ANSWERS</span>
              <div className="flex gap-2">
                {btn('Reveal All', revealAllAnswers, '#1a3c7f', '#f5c842')}
              </div>
            </div>
            {q.answers.map((ans, i) => (
              <div key={i}
                   className="flex items-center gap-3 px-4 py-3 transition-all"
                   style={{
                     background: state.revealedAnswers[i] ? '#1d5db8' : '#0d1f4c',
                     borderBottom: '1px solid rgba(255,255,255,0.08)',
                   }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: '#f5c842', color: '#0B1437' }}>
                  {i + 1}
                </span>
                <span className="flex-1 font-bold text-sm"
                      style={{ color: state.revealedAnswers[i] ? 'white' : 'rgba(255,255,255,0.4)' }}>
                  {ans.text}
                </span>
                <span className="font-bold text-lg px-3" style={{ color: '#f5c842' }}>
                  {ans.points}
                </span>
                <button
                  onClick={() => revealAnswer(i)}
                  disabled={state.revealedAnswers[i]}
                  className="px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: state.revealedAnswers[i] ? '#0a8a3a' : '#f5c842', color: '#0B1437' }}
                >
                  {state.revealedAnswers[i] ? '✓ Shown' : 'REVEAL'}
                </button>
              </div>
            ))}
          </div>

          {/* Round points tally */}
          <div className="flex items-center justify-between rounded-xl px-5 py-3"
               style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Points on the board:</span>
            <span className="text-3xl font-display" style={{ color: '#f5c842' }}>{state.roundPoints}</span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-3">

          {/* Team Names */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#f5c842' }}>Team Names</p>
            <div className="space-y-2">
              <input
                value={team1Input}
                onChange={e => setTeam1Input(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm font-bold"
                style={{ background: '#0B1437', border: '1px solid rgba(245,200,66,0.4)', color: 'white' }}
                placeholder="Team 1 name"
              />
              <input
                value={team2Input}
                onChange={e => setTeam2Input(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm font-bold"
                style={{ background: '#0B1437', border: '1px solid rgba(245,200,66,0.4)', color: 'white' }}
                placeholder="Team 2 name"
              />
              {btn('Update Names', updateTeamNames, '#f5c842', '#0B1437')}
            </div>
          </div>

          {/* Scores */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: '#f5c842' }}>Scores</p>
            <div className="space-y-3">
              {([1, 2] as const).map(team => {
                const name = team === 1 ? state.team1Name : state.team2Name
                const score = team === 1 ? state.team1Score : state.team2Score
                return (
                  <div key={team} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-bold truncate">{name}</span>
                    <button onClick={() => adjustScore(team, -10)} className="w-7 h-7 rounded font-bold text-sm"
                            style={{ background: '#dc2626' }}>−</button>
                    <span className="w-16 text-center text-xl font-display" style={{ color: '#f5c842' }}>{score}</span>
                    <button onClick={() => adjustScore(team, 10)} className="w-7 h-7 rounded font-bold text-sm"
                            style={{ background: '#16a34a' }}>+</button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Strikes */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#f5c842' }}>Strikes</p>
            <div className="flex gap-2 mb-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold"
                     style={{
                       background: i < state.strikes ? '#dc2626' : '#0d1f4c',
                       border: '2px solid',
                       borderColor: i < state.strikes ? '#dc2626' : 'rgba(255,255,255,0.2)',
                       transition: 'all 0.3s',
                     }}>
                  {i < state.strikes ? '✗' : ''}
                </div>
              ))}
              <div className="flex gap-2 ml-auto">
                {btn('+ Strike', addStrike, '#dc2626')}
                {btn('Clear', () => update({ ...state, strikes: 0 }), '#0d1f4c')}
              </div>
            </div>
          </div>

          {/* Play Control */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#f5c842' }}>Round Control</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => startRound(1)}
                className="py-3 rounded-lg font-bold text-sm transition-all hover:scale-105"
                style={{
                  background: state.controllingTeam === 1 ? '#f5c842' : '#1d5db8',
                  color: state.controllingTeam === 1 ? '#0B1437' : 'white',
                  border: state.controllingTeam === 1 ? '2px solid #f5c842' : '2px solid transparent',
                }}>
                {state.team1Name} Plays
              </button>
              <button
                onClick={() => startRound(2)}
                className="py-3 rounded-lg font-bold text-sm transition-all hover:scale-105"
                style={{
                  background: state.controllingTeam === 2 ? '#f5c842' : '#1d5db8',
                  color: state.controllingTeam === 2 ? '#0B1437' : 'white',
                  border: state.controllingTeam === 2 ? '2px solid #f5c842' : '2px solid transparent',
                }}>
                {state.team2Name} Plays
              </button>
            </div>

            {/* Award points */}
            <p className="text-xs uppercase tracking-widest mt-3 mb-1 font-bold" style={{ color: '#f5c842' }}>Award Points</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => awardPoints(1)}
                disabled={state.roundPoints === 0}
                className="py-3 rounded-lg font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: '#16a34a', color: 'white' }}>
                → {state.team1Name}
              </button>
              <button
                onClick={() => awardPoints(2)}
                disabled={state.roundPoints === 0}
                className="py-3 rounded-lg font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: '#16a34a', color: 'white' }}>
                → {state.team2Name}
              </button>
            </div>

            <button
              onClick={resetRound}
              className="w-full py-2 rounded-lg font-bold text-sm mt-1 transition-all hover:scale-105"
              style={{ background: '#374151', color: 'rgba(255,255,255,0.8)' }}>
              ↺ Reset Round
            </button>
          </div>

          {/* Question picker */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#f5c842' }}>Jump to Question</p>
            <div className="grid grid-cols-3 gap-1">
              {questionsData.questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToQuestion(i)}
                  className="py-2 rounded text-sm font-bold transition-all hover:scale-105"
                  style={{
                    background: i === state.currentQuestionIndex ? '#f5c842' : '#0d1f4c',
                    color: i === state.currentQuestionIndex ? '#0B1437' : 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                  Q{i + 1}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
