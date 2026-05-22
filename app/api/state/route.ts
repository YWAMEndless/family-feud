import { NextResponse } from 'next/server'
import type { GameState } from '@/lib/types'

// Upstash Redis REST helpers — used when env vars are present
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const KEY = 'ff-game-state'

async function redisGet(): Promise<GameState | null> {
  try {
    const res = await fetch(REDIS_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', KEY]),
    })
    const { result } = await res.json()
    return result ? (JSON.parse(result) as GameState) : null
  } catch { return null }
}

async function redisSet(state: GameState): Promise<void> {
  try {
    await fetch(REDIS_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', KEY, JSON.stringify(state), 'EX', 86400]),
    })
  } catch {}
}

// In-memory fallback (same-device BroadcastChannel sessions work fine with this)
let memState: GameState | null = null

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const state = REDIS_URL && REDIS_TOKEN ? await redisGet() : memState
  return NextResponse.json(state ?? null)
}

export async function POST(request: Request) {
  try {
    const state: GameState = await request.json()
    memState = state
    if (REDIS_URL && REDIS_TOKEN) await redisSet(state)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
}
