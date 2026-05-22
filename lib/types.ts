export interface Answer {
  text: string
  points: number
}

export interface Question {
  question: string
  answers: Answer[]
}

export type TeamNum = 1 | 2 | 3

export interface GameState {
  phase: 'idle' | 'playing' | 'steal' | 'roundEnd'
  currentQuestionIndex: number
  controllingTeam: TeamNum | null
  stealTeam: TeamNum | null
  team1Name: string
  team2Name: string
  team3Name: string
  team1Score: number
  team2Score: number
  team3Score: number
  strikes: number
  revealedAnswers: boolean[]
  roundPoints: number
  lastRevealedIndex: number | null
}

export interface SyncMessage {
  type: 'STATE_UPDATE' | 'REQUEST_STATE' | 'SOUND'
  state?: GameState
  sound?: 'ding' | 'wrong' | 'reveal' | 'steal' | 'winner'
}

export const TEAM_COLORS: Record<TeamNum, { bg: string; glow: string; dark: string; border: string }> = {
  1: { bg: '#b91c1c', glow: '#ef4444', dark: '#7f1d1d', border: '#ef4444' }, // Red — Juniors
  2: { bg: '#15803d', glow: '#22c55e', dark: '#14532d', border: '#22c55e' }, // Green — Coaches
  3: { bg: '#1d5db8', glow: '#3b82f6', dark: '#0f3b80', border: '#3b82f6' }, // Blue — Small Group Guides
}
