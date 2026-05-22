import { NextResponse } from 'next/server'
import type { GameState } from '@/lib/types'

// Module-level cache — works while the function stays warm (which it will during active play)
let cachedState: GameState | null = null

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(cachedState ?? null)
}

export async function POST(request: Request) {
  try {
    const state: GameState = await request.json()
    cachedState = state
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
}
