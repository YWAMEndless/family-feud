import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()
  const correct = process.env.GAME_PASSWORD

  if (!correct || password !== correct) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('feud_auth', correct, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 48, // 48 hours
    path: '/',
  })
  return res
}
