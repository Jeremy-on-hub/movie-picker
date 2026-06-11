// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    const preferred = saved || 'light'
    setTheme(preferred)
    document.documentElement.setAttribute('data-theme', preferred)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError('Please enter a join code.')
      return
    }
    router.push(`/join?code=${code}`)
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Top bar */}
      <div className="flex justify-end p-4">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">

        {/* Logo */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-4xl">🎬</span>
            <h1
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: 'var(--color-primary)' }}
            >
              MOVIE <span style={{ color: 'var(--color-gold)' }}>PICKER</span>
            </h1>
          </div>
          <p
            className="text-sm font-medium tracking-wide uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Pick a movie everyone will enjoy
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Create session button */}
          <button
            onClick={() => router.push('/create')}
            className="w-full font-bold py-4 px-6 rounded-xl text-sm uppercase tracking-wide transition mb-4"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
          >
            Create Session
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              or join one
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>

          {/* Join code input */}
          <input
            type="text"
            placeholder="Enter join code"
            value={joinCode}
            onChange={e => {
              setJoinCode(e.target.value)
              setError('')
            }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium mb-3 outline-none transition"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />

          {error && (
            <p className="text-red-500 text-xs mb-3 font-medium">{error}</p>
          )}

          <button
            onClick={handleJoin}
            className="w-full font-bold py-4 px-6 rounded-xl text-sm uppercase tracking-wide transition"
            style={{
              backgroundColor: 'var(--color-gold)',
              color: 'var(--color-primary)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-gold-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-gold)')}
          >
            Join Session
          </button>
        </div>

      </div>

      {/* Footer */}
      <div className="text-center p-4">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Movie Picker · Made for movie nights
        </p>
      </div>

    </main>
  )
}