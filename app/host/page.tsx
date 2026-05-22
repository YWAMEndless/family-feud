'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { GameState, SyncMessage, TeamNum } from '@/lib/types'
import { TEAM_COLORS } from '@/lib/types'
import questionsData from '@/data/questions.json'

const CHANNEL = 'family-feud-sync'

const TEAMS: TeamNum[] = [1, 2, 3]

function getTeamName(s: GameState, t: TeamNum) {
  return t === 1 ? s.team1Name : t === 2 ? s.team2Name : s.team3Name
}
function getTeamScore(s: GameState, t: TeamNum) {
  return t === 1 ? s.team1Score : t === 2 ? s.team2Score : s.team3Score
}

function makeInitialState(): GameState {
  const q = questionsData.questions[0]
  const [t1, t2, t3] = questionsData.teamNames
  return {
    phase: 'idle',
    currentQuestionIndex: 0,
    controllingTeam: null,
    stealTeam: null,
    team1Name: t1,
    team2Name: t2,
    team3Name: t3,
    team1Score: 0,
    team2Score: 0,
    team3Score: 0,
    strikes: 0,
    revealedAnswers: new Array(q.answers.length).fill(false),
    roundPoints: 0,
    lastRevealedIndex: null,
  }
}

export default function HostPage() {
  const [state, setState] = useState<GameState>(makeInitialState)
  const [nameInputs, setNameInputs] = useState([
    questionsData.teamNames[0],
    questionsData.teamNames[1],
    questionsData.teamNames[2],
  ])
  const [flash, setFlash] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL)
    channelRef.current = ch
    ch.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data.type === 'REQUEST_STATE') {
        ch.postMessage({ type: 'STATE_UPDATE', state } as SyncMessage)
      }
    }
    return () => ch.close()
  }, [state])

  const broadcast = useCallback((newState: GameState, sound?: SyncMessage['sound']) => {
    channelRef.current?.postMessage({ type: 'STATE_UPDATE', state: newState } as SyncMessage)
    if (sound) channelRef.current?.postMessage({ type: 'SOUND', sound } as SyncMessage)
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
    setTimeout(() => setFlash(null), 2200)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function goToQuestion(index: number) {
    const q = questionsData.questions[index]
    if (!q) return
    update({
      ...makeInitialState(),
      currentQuestionIndex: index,
      team1Name: state.team1Name,
      team2Name: state.team2Name,
      team3Name: state.team3Name,
      team1Score: state.team1Score,
      team2Score: state.team2Score,
      team3Score: state.team3Score,
      revealedAnswers: new Array(q.answers.length).fill(false),
    })
  }

  function startRound(team: TeamNum) {
    update({ ...state, phase: 'playing', controllingTeam: team, stealTeam: null, strikes: 0 })
    showFlash(`${getTeamName(state, team)} is playing!`)
  }

  function revealAnswer(index: number) {
    if (state.revealedAnswers[index]) return
    const newRevealed = [...state.revealedAnswers]
    newRevealed[index] = true
    const newPoints = questionsData.questions[state.currentQuestionIndex].answers.reduce(
      (sum, ans, i) => sum + (newRevealed[i] ? ans.points : 0), 0
    )
    update({ ...state, revealedAnswers: newRevealed, roundPoints: newPoints, lastRevealedIndex: index }, 'ding')
  }

  function addStrike() {
    const newStrikes = state.strikes + 1
    if (newStrikes >= 3) {
      update({ ...state, strikes: newStrikes, phase: 'steal', stealTeam: null }, 'wrong')
      showFlash('3 Strikes! Choose a team to STEAL!')
    } else {
      update({ ...state, strikes: newStrikes }, 'wrong')
    }
  }

  function setStealTeam(team: TeamNum) {
    update({ ...state, stealTeam: team, phase: 'steal' })
    showFlash(`${getTeamName(state, team)} can STEAL!`)
  }

  function awardPoints(team: TeamNum) {
    const pts = state.roundPoints
    update({
      ...state,
      team1Score: team === 1 ? state.team1Score + pts : state.team1Score,
      team2Score: team === 2 ? state.team2Score + pts : state.team2Score,
      team3Score: team === 3 ? state.team3Score + pts : state.team3Score,
      phase: 'roundEnd',
    }, 'winner')
    showFlash(`+${pts} points to ${getTeamName(state, team)}!`)
  }

  async function resetGame() {
    // Dismiss confirm UI immediately so it doesn't feel broken
    setConfirmReset(false)
    showFlash('Resetting…')
    const fresh = makeInitialState()
    fresh.team1Name = state.team1Name
    fresh.team2Name = state.team2Name
    fresh.team3Name = state.team3Name
    update(fresh)
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', team1Name: fresh.team1Name, team2Name: fresh.team2Name, team3Name: fresh.team3Name }),
    }).catch(() => {})
    showFlash('Game reset! All scores cleared.')
  }

  async function resetBuzzers() {
    await fetch('/api/buzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset',
        team1Name: state.team1Name,
        team2Name: state.team2Name,
        team3Name: state.team3Name,
      }),
    }).catch(() => {})
    showFlash('Buzzers reset!')
  }

  function adjustScore(team: TeamNum, delta: number) {
    update({
      ...state,
      team1Score: team === 1 ? Math.max(0, state.team1Score + delta) : state.team1Score,
      team2Score: team === 2 ? Math.max(0, state.team2Score + delta) : state.team2Score,
      team3Score: team === 3 ? Math.max(0, state.team3Score + delta) : state.team3Score,
    })
  }

  function updateTeamNames() {
    update({ ...state, team1Name: nameInputs[0], team2Name: nameInputs[1], team3Name: nameInputs[2] })
    showFlash('Team names updated!')
  }

  function revealAllAnswers() {
    const q = questionsData.questions[state.currentQuestionIndex]
    const pts = q.answers.reduce((s, a) => s + a.points, 0)
    update({ ...state, revealedAnswers: new Array(q.answers.length).fill(true), roundPoints: pts, lastRevealedIndex: null })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const q = questionsData.questions[state.currentQuestionIndex]
  const totalQs = questionsData.questions.length

  const btn = (label: string, onClick: () => void, bg = '#1d5db8', color = 'white', disabled = false) => (
    <button onClick={onClick} disabled={disabled}
            className="px-4 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: bg, color, border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Arial, sans-serif' }}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen p-4 text-white" style={{ background: '#0f1729', fontFamily: 'Arial, sans-serif' }}>

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
            {state.phase === 'idle' && !state.controllingTeam && (
              <span style={{ color: '#f5c842', opacity: 0.7 }}>← Pick a team under <strong>Playing</strong> to start a round</span>
            )}
            {state.controllingTeam && (
              <span>
                <span style={{ color: TEAM_COLORS[state.controllingTeam].glow }}>● {getTeamName(state, state.controllingTeam)}</span>
                {' '}is {state.phase === 'steal' ? 'stealing' : 'playing'}
                {state.strikes > 0 && ` · ${state.strikes} strike${state.strikes > 1 ? 's' : ''}`}
              </span>
            )}
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

        {/* Left/Center: Answers */}
        <div className="lg:col-span-2 space-y-3">

          {/* Question */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.4)' }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#f5c842' }}>Current Question</p>
            <p className="text-lg font-bold">{q.question}</p>
          </div>

          {/* Answers */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,200,66,0.3)' }}>
            <div className="px-4 py-2 flex justify-between items-center" style={{ background: '#1a3c7f' }}>
              <span className="text-sm font-bold" style={{ color: '#f5c842' }}>ANSWERS</span>
              {btn('Reveal All', revealAllAnswers, '#1a3c7f', '#f5c842')}
            </div>
            {q.answers.map((ans, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3"
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
                <span className="font-bold text-lg px-3" style={{ color: '#f5c842' }}>{ans.points}</span>
                <button onClick={() => revealAnswer(i)} disabled={state.revealedAnswers[i]}
                        className="px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: state.revealedAnswers[i] ? '#0a8a3a' : '#f5c842', color: '#0B1437' }}>
                  {state.revealedAnswers[i] ? '✓ Shown' : 'REVEAL'}
                </button>
              </div>
            ))}
          </div>

          {/* Round points */}
          <div className="flex items-center justify-between rounded-xl px-5 py-3"
               style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Points on the board:</span>
            <span className="text-3xl font-display" style={{ color: '#f5c842' }}>{state.roundPoints}</span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-3">

          {/* Team Names */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: '#f5c842' }}>Team Names</p>
            {TEAMS.map((t, i) => (
              <div key={t} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                     style={{ background: TEAM_COLORS[t].bg }} />
                <input value={nameInputs[i]}
                       onChange={e => setNameInputs(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                       className="flex-1 px-3 py-1.5 rounded text-sm font-bold"
                       style={{ background: '#0B1437', border: `1px solid ${TEAM_COLORS[t].border}55`, color: 'white' }} />
              </div>
            ))}
            {btn('Update Names', updateTeamNames, '#f5c842', '#0B1437')}
          </div>

          {/* Scores */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: '#f5c842' }}>Scores</p>
            <div className="space-y-2">
              {TEAMS.map(t => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEAM_COLORS[t].bg }} />
                  <span className="flex-1 text-sm font-bold truncate">{getTeamName(state, t)}</span>
                  <button onClick={() => adjustScore(t, -10)} className="w-7 h-7 rounded font-bold text-sm"
                          style={{ background: '#dc2626' }}>−</button>
                  <span className="w-14 text-center text-xl font-display" style={{ color: '#f5c842' }}>
                    {getTeamScore(state, t)}
                  </span>
                  <button onClick={() => adjustScore(t, 10)} className="w-7 h-7 rounded font-bold text-sm"
                          style={{ background: '#16a34a' }}>+</button>
                </div>
              ))}
            </div>
          </div>

          {/* Strikes */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#f5c842' }}>Strikes</p>
            <div className="flex items-center gap-2 mb-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                     style={{
                       background: i < state.strikes ? '#dc2626' : '#0d1f4c',
                       border: `2px solid ${i < state.strikes ? '#dc2626' : 'rgba(255,255,255,0.2)'}`,
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

          {/* Round Control */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: '#f5c842' }}>Playing</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TEAMS.map(t => {
                const active = state.controllingTeam === t
                return (
                  <button key={t} onClick={() => startRound(t)}
                          className="py-2.5 rounded-lg font-bold text-xs transition-all hover:scale-105 leading-tight"
                          style={{
                            background: active ? TEAM_COLORS[t].bg : '#0d1f4c',
                            color: active ? 'white' : 'rgba(255,255,255,0.6)',
                            border: `2px solid ${active ? TEAM_COLORS[t].border : 'rgba(255,255,255,0.1)'}`,
                          }}>
                    {getTeamName(state, t)}
                  </button>
                )
              })}
            </div>

            {/* Steal team */}
            {state.phase === 'steal' && (
              <>
                <p className="text-xs uppercase tracking-widest mt-2 font-bold" style={{ color: '#f5c842' }}>
                  Steal Team
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {TEAMS.filter(t => t !== state.controllingTeam).map(t => (
                    <button key={t} onClick={() => setStealTeam(t)}
                            className="py-2.5 rounded-lg font-bold text-xs transition-all hover:scale-105"
                            style={{
                              background: state.stealTeam === t ? TEAM_COLORS[t].bg : '#0d1f4c',
                              color: 'white',
                              border: `2px solid ${TEAM_COLORS[t].border}`,
                            }}>
                      {getTeamName(state, t)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Award points */}
            <p className="text-xs uppercase tracking-widest mt-2 mb-1 font-bold" style={{ color: '#f5c842' }}>Award Points</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TEAMS.map(t => (
                <button key={t} onClick={() => awardPoints(t)} disabled={state.roundPoints === 0}
                        className="py-2.5 rounded-lg font-bold text-xs transition-all hover:scale-105 disabled:opacity-40 leading-tight"
                        style={{ background: TEAM_COLORS[t].bg, color: 'white' }}>
                  → {getTeamName(state, t)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => goToQuestion(state.currentQuestionIndex)}
                      className="py-2 rounded-lg font-bold text-sm transition-all hover:scale-105"
                      style={{ background: '#374151', color: 'rgba(255,255,255,0.8)' }}>
                ↺ Reset Round
              </button>
              <button onClick={resetBuzzers}
                      className="py-2 rounded-lg font-bold text-sm transition-all hover:scale-105"
                      style={{ background: '#4c1d95', color: 'white', border: '1px solid rgba(167,139,250,0.4)' }}>
                🔔 Reset Buzz
              </button>
            </div>
          </div>

          {/* Question picker */}
          <div className="rounded-xl p-4" style={{ background: '#1a3c7f', border: '1px solid rgba(245,200,66,0.3)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#f5c842' }}>Jump to Question</p>
            <div className="grid grid-cols-4 gap-1">
              {questionsData.questions.map((_, i) => (
                <button key={i} onClick={() => goToQuestion(i)}
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

          {/* Full game reset */}
          <div className="rounded-xl p-4" style={{ background: '#1a0a0a', border: '1px solid rgba(220,38,38,0.4)' }}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: '#ef4444' }}>
              Danger Zone
            </p>
            {confirmReset ? (
              <div className="space-y-2">
                <p className="text-sm text-center font-bold" style={{ color: 'white', fontFamily: 'Arial' }}>
                  Reset everything? All scores go to zero.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={resetGame}
                    className="py-2.5 rounded-lg font-bold text-sm transition-all hover:scale-105"
                    style={{ background: '#dc2626', color: 'white' }}>
                    Yes, reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="py-2.5 rounded-lg font-bold text-sm transition-all hover:scale-105"
                    style={{ background: '#374151', color: 'white' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full py-2.5 rounded-lg font-bold text-sm transition-all hover:scale-105"
                style={{ background: 'rgba(220,38,38,0.2)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.4)' }}>
                🔄 Reset Entire Game
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
