'use client'
import { useState, useEffect, useRef } from 'react'
import type { GameState } from '@/lib/types'
import questionsData from '@/data/questions.json'

export default function ReaderPage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setGameState(data)
            setLastUpdated(new Date())
          }
        }
      } catch {}
    }
    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const qIndex = gameState?.currentQuestionIndex ?? 0
  const q = questionsData.questions[qIndex]
  const totalQs = questionsData.questions.length
  const revealed = gameState?.revealedAnswers ?? []
  const revealedCount = revealed.filter(Boolean).length

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: '#0B1437', fontFamily: 'Arial, sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
           style={{ background: '#1a3c7f', borderBottom: '2px solid rgba(245,200,66,0.3)' }}>
        <span className="font-display text-lg" style={{ color: '#f5c842' }}>
          FAMILY FEUD
        </span>
        <span className="text-sm font-bold"
              style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.3)',
                       padding: '3px 10px', borderRadius: 20 }}>
          Q {qIndex + 1} / {totalQs}
        </span>
        {lastUpdated && (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Live
            <span className="inline-block w-1.5 h-1.5 rounded-full ml-1 animate-pulse"
                  style={{ background: '#22c55e', verticalAlign: 'middle' }} />
          </span>
        )}
      </div>

      {/* Question */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <p className="text-xs uppercase tracking-widest mb-3"
           style={{ color: 'rgba(245,200,66,0.7)' }}>
          Read this question aloud:
        </p>
        <div className="rounded-2xl px-5 py-5"
             style={{ background: '#1a3c7f', border: '2px solid rgba(245,200,66,0.4)' }}>
          <p className="text-2xl font-bold leading-snug" style={{ color: 'white' }}>
            {q.question}
          </p>
        </div>
        <p className="mt-3 text-sm text-center"
           style={{ color: 'rgba(255,255,255,0.4)' }}>
          {q.answers.length} answers on the board
          {revealedCount > 0 && ` · ${revealedCount} revealed`}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* Answers reference */}
      <div className="px-5 pb-6 flex-1 overflow-y-auto">
        <p className="text-xs uppercase tracking-widest mb-3"
           style={{ color: 'rgba(255,255,255,0.35)' }}>
          Answer guide (your reference only)
        </p>
        <div className="space-y-2">
          {q.answers.map((ans, i) => {
            const isRevealed = revealed[i] === true
            return (
              <div key={i}
                   className="flex items-center gap-3 px-4 py-3 rounded-xl"
                   style={{
                     background: isRevealed ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.05)',
                     border: `1px solid ${isRevealed ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'}`,
                   }}>
                {/* Number */}
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: isRevealed ? '#16a34a' : '#1a3c7f', color: 'white' }}>
                  {i + 1}
                </span>
                {/* Answer text */}
                <span className="flex-1 font-bold text-base"
                      style={{ color: isRevealed ? 'rgba(255,255,255,0.5)' : 'white' }}>
                  {ans.text}
                  {isRevealed && (
                    <span className="ml-2 text-xs font-normal" style={{ color: '#16a34a' }}>
                      ✓ revealed
                    </span>
                  )}
                </span>
                {/* Points */}
                <span className="text-sm font-bold flex-shrink-0"
                      style={{ color: isRevealed ? 'rgba(245,200,66,0.4)' : '#f5c842' }}>
                  {ans.points}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score bar */}
      {gameState && (
        <div className="flex-shrink-0 px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { name: gameState.team1Name, score: gameState.team1Score, active: gameState.controllingTeam === 1 },
              { name: gameState.team2Name, score: gameState.team2Score, active: gameState.controllingTeam === 2 },
              { name: gameState.team3Name, score: gameState.team3Score, active: gameState.controllingTeam === 3 },
            ] as const).map((team, i) => (
              <div key={i}
                   className="rounded-xl py-2 px-3 text-center"
                   style={{
                     background: team.active ? '#1a3c7f' : 'rgba(255,255,255,0.05)',
                     border: `1px solid ${team.active ? 'rgba(245,200,66,0.5)' : 'rgba(255,255,255,0.08)'}`,
                   }}>
                <div className="text-xs truncate mb-0.5"
                     style={{ color: team.active ? '#f5c842' : 'rgba(255,255,255,0.5)' }}>
                  {team.name}
                  {team.active && ' ★'}
                </div>
                <div className="text-xl font-display" style={{ color: 'white' }}>
                  {team.score}
                </div>
              </div>
            ))}
          </div>

          {/* Strikes */}
          {gameState.strikes > 0 && (
            <div className="flex justify-center gap-2 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i}
                     className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                     style={{
                       background: i < gameState.strikes ? '#dc2626' : 'rgba(255,255,255,0.06)',
                       color: 'white',
                       fontSize: 14,
                     }}>
                  {i < gameState.strikes ? '✗' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No state yet */}
      {!gameState && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Waiting for game to start…
          </p>
        </div>
      )}
    </div>
  )
}
