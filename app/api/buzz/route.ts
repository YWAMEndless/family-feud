import { NextResponse } from 'next/server'
import type { TeamNum } from '@/lib/types'
import { serverSupabase } from '@/lib/supabase'

export interface BuzzState {
  order: TeamNum[]
  team1Name: string
  team2Name: string
  team3Name: string
}

const DEFAULT: BuzzState = {
  order: [],
  team1Name: 'Juniors',
  team2Name: 'Coaches',
  team3Name: 'Small Group Guides',
}

export const dynamic = 'force-dynamic'

async function getCurrent(): Promise<BuzzState> {
  const { data } = await serverSupabase()
    .from('game_kv')
    .select('value')
    .eq('key', 'buzz')
    .single()
  return (data?.value as BuzzState) ?? DEFAULT
}

async function save(state: BuzzState) {
  await serverSupabase()
    .from('game_kv')
    .upsert({ key: 'buzz', value: state, updated_at: new Date().toISOString() })
}

export async function GET() {
  return NextResponse.json(await getCurrent())
}

export async function POST(request: Request) {
  const body = await request.json()
  const current = await getCurrent()
  let next: BuzzState = current

  if (body.action === 'buzz') {
    const team = body.team as TeamNum
    if (!current.order.includes(team)) {
      next = { ...current, order: [...current.order, team] }
    }
  } else if (body.action === 'reset') {
    next = { order: [], team1Name: body.team1Name ?? current.team1Name, team2Name: body.team2Name ?? current.team2Name, team3Name: body.team3Name ?? current.team3Name }
  } else if (body.action === 'setNames') {
    next = { ...current, team1Name: body.team1Name ?? current.team1Name, team2Name: body.team2Name ?? current.team2Name, team3Name: body.team3Name ?? current.team3Name }
  }

  await save(next)
  return NextResponse.json(next)
}
