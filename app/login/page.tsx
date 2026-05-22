'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

function LoginInner() {
  const params = useSearchParams()
  const router = useRouter()
  const from = params.get('from') || '/'

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Full page navigation so the browser sends the new cookie on the next request
        window.location.href = from
      } else {
        setError('Incorrect password. Try again.')
        setPassword('')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(180deg, #0B1437 0%, #1a3c7f 50%, #0B1437 100%)' }}>

      {/* Logo */}
      <div className="text-center mb-8">
        <Image src="/logo.png" alt="Family Feud" width={320} height={213}
               priority style={{ height: 110, width: 'auto', objectFit: 'contain', margin: '0 auto' }} />
        <div className="mt-2 text-sm tracking-widest uppercase"
             style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Arial' }}>
          Staff Access
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-2xl p-8 space-y-5"
            style={{
              background: 'rgba(26,60,127,0.6)',
              border: '1px solid rgba(245,200,66,0.3)',
              backdropFilter: 'blur(10px)',
            }}>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest font-bold"
                 style={{ color: '#f5c842', fontFamily: 'Arial' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="Enter password"
            className="w-full px-4 py-3 rounded-xl text-lg font-bold outline-none transition-all"
            style={{
              background: '#0B1437',
              border: `2px solid ${error ? '#ef4444' : 'rgba(245,200,66,0.3)'}`,
              color: 'white',
              fontFamily: 'Arial',
            }}
            onFocus={e => (e.target.style.borderColor = '#f5c842')}
            onBlur={e => (e.target.style.borderColor = error ? '#ef4444' : 'rgba(245,200,66,0.3)')}
          />
          {error && (
            <p className="text-sm font-bold" style={{ color: '#ef4444', fontFamily: 'Arial' }}>
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-4 rounded-xl text-xl font-display tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #f5c842, #c99a00)',
            color: '#0B1437',
            boxShadow: '0 4px 20px rgba(245,200,66,0.3)',
          }}>
          {loading ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1437' }}>
        <div className="text-2xl font-display" style={{ color: '#f5c842' }}>Loading…</div>
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
