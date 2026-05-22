import { NextResponse } from 'next/server'
import type { TeamNum } from '@/lib/types'

interface BuzzState {
  winner: TeamNum | null
  team1Name: string
  team2Name: string
  team3Name: string
  locked: boolean
  buzzAt: number | null
}

let state: BuzzState = {
  winner: null,
  team1Name: 'Juniors',
  team2Name: 'Coaches',
  team3Name: 'Small Group Guides',
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
    if (!state.locked) {
      state = { ...state, winner: body.team as TeamNum, locked: true, buzzAt: Date.now() }
    }
  } else if (body.action === 'reset') {
    state = {
      winner: null,
      locked: false,
      buzzAt: null,
      team1Name: body.team1Name ?? state.team1Name,
      team2Name: body.team2Name ?? state.team2Name,
      team3Name: body.team3Name ?? state.team3Name,
    }
  } else if (body.action === 'setNames') {
    state = {
      ...state,
      team1Name: body.team1Name ?? state.team1Name,
      team2Name: body.team2Name ?? state.team2Name,
      team3Name: body.team3Name ?? state.team3Name,
    }
  }

  return NextResponse.json(state)
}
