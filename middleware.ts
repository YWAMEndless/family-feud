import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.GAME_PASSWORD
  // If no password env var is set, let everything through
  if (!password) return NextResponse.next()

  const token = request.cookies.get('feud_auth')?.value
  if (token === password) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/host(.*)', '/buzz(.*)', '/reader(.*)'],
}
