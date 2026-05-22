import { NextResponse } from 'next/server'
import type { TeamNum } from '@/lib/types'

export interface BuzzState {
  order: TeamNum[]  // teams in the order they buzzed: order[0]=1st, order[1]=2nd, order[2]=3rd
  team1Name: string
  team2Name: string
  team3Name: string
}

let state: BuzzState = {
  order: [],
  team1Name: 'Juniors',
  team2Name: 'Coaches',
  team3Name: 'Small Group Guides',
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(state)
}

export async function POST(request: Request) {
  const body = await request.json()

  if (body.action === 'buzz') {
    const team = body.team as TeamNum
    // Only add if not already in the order
    if (!state.order.includes(team)) {
      state = { ...state, order: [...state.order, team] }
    }
  } else if (body.action === 'reset') {
    state = {
      order: [],
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
