import { NextResponse } from 'next/server'
import type { TeamNum } from '@/lib/types'

export interface BuzzState {
  order: TeamNum[]
  team1Name: string
  team2Name: string
  team3Name: string
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const KEY = 'ff-buzz-state'

async function redisGet(): Promise<BuzzState | null> {
  try {
    const res = await fetch(REDIS_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', KEY]),
    })
    const { result } = await res.json()
    return result ? (JSON.parse(result) as BuzzState) : null
  } catch { return null }
}

async function redisSet(state: BuzzState): Promise<void> {
  try {
    await fetch(REDIS_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', KEY, JSON.stringify(state), 'EX', 86400]),
    })
  } catch {}
}

let memState: BuzzState = {
  order: [],
  team1Name: 'Juniors',
  team2Name: 'Coaches',
  team3Name: 'Small Group Guides',
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const state = REDIS_URL && REDIS_TOKEN ? (await redisGet()) ?? memState : memState
  return NextResponse.json(state)
}

export async function POST(request: Request) {
  const body = await request.json()
  const current = REDIS_URL && REDIS_TOKEN ? (await redisGet()) ?? memState : memState

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

  memState = next
  if (REDIS_URL && REDIS_TOKEN) await redisSet(next)
  return NextResponse.json(next)
}
