import { NextResponse } from 'next/server'

interface BuzzState {
  winner: 1 | 2 | null
  team1Name: string
  team2Name: string
  locked: boolean
  buzzAt: number | null // server timestamp ms
}

let state: BuzzState = {
  winner: null,
  team1Name: 'Team 1',
  team2Name: 'Team 2',
  locked: false,
  buzzAt: null,
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(state)
}

export async function POST(request: Request) {
  const body = await request.json()

  if (body.action === 'buzz') {
    // Only record the first buzz received
    if (!state.locked) {
      state = { ...state, winner: body.team, locked: true, buzzAt: Date.now() }
    }
  } else if (body.action === 'reset') {
    state = {
      winner: null,
      locked: false,
      buzzAt: null,
      team1Name: body.team1Name ?? state.team1Name,
      team2Name: body.team2Name ?? state.team2Name,
    }
  } else if (body.action === 'setNames') {
    state = { ...state, team1Name: body.team1Name, team2Name: body.team2Name }
  }

  return NextResponse.json(state)
}
