import { NextResponse } from 'next/server'
import type { GameState } from '@/lib/types'
import { serverSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await serverSupabase()
    .from('game_kv')
    .select('value')
    .eq('key', 'game')
    .single()
  return NextResponse.json(data?.value ?? null)
}

export async function POST(request: Request) {
  try {
    const state: GameState = await request.json()
    await serverSupabase()
      .from('game_kv')
      .upsert({ key: 'game', value: state, updated_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
}
