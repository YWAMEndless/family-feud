export interface Answer {
  text: string
  points: number
}

export interface Question {
  question: string
  answers: Answer[] // max 8, ordered by points descending
}

export interface GameState {
  phase: 'idle' | 'playing' | 'steal' | 'roundEnd'
  currentQuestionIndex: number
  controllingTeam: 1 | 2 | null
  stealTeam: 1 | 2 | null
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  strikes: number         // 0, 1, 2, or 3
  revealedAnswers: boolean[]
  roundPoints: number     // sum of revealed answer points this round
  lastRevealedIndex: number | null
}

export interface SyncMessage {
  type: 'STATE_UPDATE' | 'REQUEST_STATE' | 'SOUND'
  state?: GameState
  sound?: 'ding' | 'wrong' | 'reveal' | 'steal' | 'winner'
}
