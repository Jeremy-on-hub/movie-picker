// app/join/page.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()

  const code = searchParams.get('code')?.toUpperCase() || ''

  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!displayName.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('join_code', code)
        .single()

      if (sessionError || !session) {
        setError('Session not found. Check your join code.')
        return
      }

      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, display_name: displayName.trim() })
        .select()
        .single()

      if (participantError) throw participantError

      localStorage.setItem('participant_id', participant.id)
      localStorage.setItem('session_id', session.id)

      if (session.phase === 'voting') {
        router.push(`/session/${code}/vote`)
      } else {
        router.push(`/session/${code}`)
      }

    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => router.push('/')}
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Back
        </button>
        <button
        onClick={() => router.push('/')}
        className="text-base font-extrabold uppercase tracking-wide"
        style={{ color: 'var(--color-primary)' }}
        >
        MOVIE <span style={{ color: 'var(--color-gold)' }}>PICKER</span>
        </button>
        <div className="w-12" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Title */}
          <div className="mb-8">
            <h2
              className="text-2xl font-extrabold mb-1"
              style={{ color: 'var(--color-text)' }}
            >
              Join Session
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              Joining code{' '}
              <span
                className="font-extrabold tracking-widest"
                style={{ color: 'var(--color-primary)' }}
              >
                {code}
              </span>
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <label
                className="block mb-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Your name
              </label>
              <input
                type="text"
                placeholder="e.g. Jeremy"
                value={displayName}
                onChange={e => {
                  setDisplayName(e.target.value)
                  setError('')
                }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium">{error}</p>
            )}

            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full font-bold py-4 rounded-xl text-sm uppercase tracking-wide transition"
              style={{
                backgroundColor: 'var(--color-gold)',
                color: 'var(--color-primary)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Joining...' : 'Join Session →'}
            </button>
          </div>

        </div>
      </div>
    </main>
  )
}