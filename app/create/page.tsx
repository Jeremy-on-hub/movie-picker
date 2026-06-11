// app/create/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { YearRangeSlider } from '@/components/YearRangeSlider'
import type { SessionSettings } from '@/lib/database.types'

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1980

const GENRES: { name: string; emoji: string }[] = [
  { name: 'Action',          emoji: '💥' },
  { name: 'Adventure',       emoji: '🗺️' },
  { name: 'Animation',       emoji: '🎨' },
  { name: 'Comedy',          emoji: '😂' },
  { name: 'Crime',           emoji: '🔫' },
  { name: 'Documentary',     emoji: '🎙️' },
  { name: 'Drama',           emoji: '🎭' },
  { name: 'Fantasy',         emoji: '🧙' },
  { name: 'Horror',          emoji: '👻' },
  { name: 'Mystery',         emoji: '🔍' },
  { name: 'Romance',         emoji: '❤️' },
  { name: 'Science Fiction', emoji: '🚀' },
  { name: 'Thriller',        emoji: '😰' },
  { name: 'War',             emoji: '⚔️' },
  { name: 'Western',         emoji: '🤠' },
]

const GENRE_NAMES = GENRES.map(g => g.name)

const AGE_RATINGS = [
  { rating: 'G',     description: 'General Audiences — suitable for all ages.' },
  { rating: 'PG',    description: 'Parental Guidance — some material may not suit young children.' },
  { rating: 'PG-13', description: 'Parents Strongly Cautioned — may be inappropriate for children under 13.' },
  { rating: 'R',     description: 'Restricted — under 17 requires parent or adult guardian.' },
  { rating: 'NC-17', description: 'Adults Only — no one 17 and under admitted.' },
]

const defaultSettings: SessionSettings = {
  rating_mode: 'binary',
  pool_size: 20,
  genre_filter: [...GENRE_NAMES],
  year_from: null,
  year_to: null,
  age_rating_filter: [],
  custom_list_mode: false,
  max_movies_total: null,
  max_movies_per_user: null,
}

// ── Info tooltip ─────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center transition"
        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
      >
        i
      </button>
      {open && (
        <div
          className="absolute z-10 left-6 top-0 w-64 text-xs rounded-xl p-3 shadow-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
        {text.split('\n\n').map((line, i) => (
        <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
        ))}
        </div>
      )}
    </div>
  )
}

// ── Pool size scroll picker ──────────────────────────────────
const POOL_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

function PoolSizePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val >= 5 && val <= 50) onChange(val)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(1, value - 5))}
        className="w-12 h-12 rounded-xl font-bold text-xl transition flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
        }}
      >
        −
      </button>

      <input
        type="number"
        min={5}
        max={50}
        value={value}
        onChange={handleInput}
        className="flex-1 h-12 rounded-xl font-bold text-xl text-center outline-none"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '2px solid var(--color-primary)',
          color: 'var(--color-text)',
        }}
      />

      <button
        onClick={() => onChange(value + 5)}
        className="w-12 h-12 rounded-xl font-bold text-xl transition flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
        }}
      >
        +
      </button>
    </div>
  )
}
// ── Main component ───────────────────────────────────────────
export default function CreatePage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [displayName, setDisplayName] = useState('')
  const [settings, setSettings] = useState<SessionSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [genresOpen, setGenresOpen] = useState(false)
  const [ageInfoOpen, setAgeInfoOpen] = useState<string | null>(null)

  const yearMin = settings.year_from ?? MIN_YEAR
  const yearMax = settings.year_to ?? CURRENT_YEAR

  function toggleGenre(genre: string) {
    setSettings(s => ({
      ...s,
      genre_filter: s.genre_filter.includes(genre)
        ? s.genre_filter.filter(g => g !== genre)
        : [...s.genre_filter, genre]
    }))
  }

  function toggleAgeRating(rating: string) {
    setSettings(s => ({
      ...s,
      age_rating_filter: s.age_rating_filter.includes(rating)
        ? s.age_rating_filter.filter(r => r !== rating)
        : [...s.age_rating_filter, rating]
    }))
  }

  async function handleCreate() {
    if (!displayName.trim()) {
      setError('Please enter your name.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const joinCode = generateJoinCode()
      const shareLink = `${window.location.origin}/session/${joinCode}`

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          join_code: joinCode,
          share_link: shareLink,
          phase: 'lobby',
          admin_participant_id: null,
          ...settings,
          year_from: yearMin === MIN_YEAR ? null : yearMin,
          year_to: yearMax === CURRENT_YEAR ? null : yearMax,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, display_name: displayName.trim() })
        .select()
        .single()

      if (participantError) throw participantError

      await supabase
        .from('sessions')
        .update({ admin_participant_id: participant.id })
        .eq('id', session.id)

      localStorage.setItem('participant_id', participant.id)
      localStorage.setItem('session_id', session.id)
      router.push(`/session/${joinCode}`)

    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
  }

  const labelStyle = {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
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

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full flex flex-col gap-5">

        <div>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>
            Create Session
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Set up a movie night for your group.
          </p>
        </div>

        {/* Your name */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <label className="block mb-2" style={labelStyle}>Your name</label>
          <input
            type="text"
            placeholder="e.g. Jeremy"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Rating mode */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <label className="block mb-3" style={labelStyle}>Rating mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'binary', emoji: '👍', label: 'Yes / No' },
              { value: '3-star', emoji: '⭐', label: '3 Stars'  },
              { value: '1-10',   emoji: '🎯', label: '1 – 10'   },
            ].map(mode => (
              <button
                key={mode.value}
                onClick={() => setSettings(s => ({ ...s, rating_mode: mode.value as any }))}
                className="flex flex-col items-center gap-1 py-4 rounded-xl font-semibold text-sm transition"
                style={{
                  backgroundColor: settings.rating_mode === mode.value
                    ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  color: settings.rating_mode === mode.value
                    ? '#FFFFFF' : 'var(--color-text-muted)',
                  border: settings.rating_mode === mode.value
                    ? '2px solid var(--color-primary)' : '2px solid transparent',
                }}
              >
                <span className="text-2xl">{mode.emoji}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Movies per person */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <label className="block mb-3" style={labelStyle}>
            Movies per person —{' '}
            <span style={{ color: 'var(--color-primary)' }}>{settings.pool_size}</span>
          </label>
          <PoolSizePicker
            value={settings.pool_size}
            onChange={v => setSettings(s => ({ ...s, pool_size: v }))}
          />
        </div>

        {/* Movie source */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <label style={labelStyle}>Movie source</label>
            <InfoTooltip text="Random Pool picks movies automatically from our database based on your filters. Custom List lets everyone in the lobby search and add specific movies they want to vote on." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: false,
                emoji: '🎲',
                label: 'Random Pool',
                desc: 'Auto-picked from database',
              },
              {
                value: true,
                emoji: '✏️',
                label: 'Custom List',
                desc: 'Everyone adds movies in lobby',
              },
            ].map(mode => (
              <button
                key={String(mode.value)}
                onClick={() => setSettings(s => ({ ...s, custom_list_mode: mode.value }))}
                className="flex flex-col items-start gap-1 p-4 rounded-xl text-left transition"
                style={{
                  backgroundColor: settings.custom_list_mode === mode.value
                    ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  color: settings.custom_list_mode === mode.value
                    ? '#FFFFFF' : 'var(--color-text-muted)',
                  border: settings.custom_list_mode === mode.value
                    ? '2px solid var(--color-primary)' : '2px solid transparent',
                }}
              >
                <span className="text-2xl">{mode.emoji}</span>
                <span className="font-bold text-sm">{mode.label}</span>
                <span className="text-xs opacity-75">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Genres — only shown for random pool */}
        {!settings.custom_list_mode && (
          <>
            <div className="rounded-2xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <label style={labelStyle}>
                  Genres —{' '}
                  <span style={{ color: 'var(--color-primary)' }}>
                    {settings.genre_filter.length === GENRE_NAMES.length
                      ? 'All' : `${settings.genre_filter.length} selected`}
                  </span>
                </label>
                <button
                  onClick={() => setGenresOpen(o => !o)}
                  className="text-xs font-semibold px-3 py-1 rounded-lg transition"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                >
                  {genresOpen ? 'Collapse ↑' : 'Edit ↓'}
                </button>
              </div>

              {genresOpen && (
                <>
                  <div className="flex gap-2 mt-3 mb-3">
                    <button
                      onClick={() => setSettings(s => ({ ...s, genre_filter: [...GENRE_NAMES] }))}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSettings(s => ({ ...s, genre_filter: [] }))}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {GENRES.map(g => (
                      <button
                        key={g.name}
                        onClick={() => toggleGenre(g.name)}
                        className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition"
                        style={{
                          backgroundColor: settings.genre_filter.includes(g.name)
                            ? 'var(--color-primary)' : 'var(--color-surface-2)',
                          color: settings.genre_filter.includes(g.name)
                            ? '#FFFFFF' : 'var(--color-text-muted)',
                        }}
                      >
                        <span>{g.emoji}</span>
                        <span>{g.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Release year */}
            <div className="rounded-2xl p-4" style={cardStyle}>
              <label className="block mb-4" style={labelStyle}>
                Release year —{' '}
                <span style={{ color: 'var(--color-primary)' }}>
                  {yearMin === MIN_YEAR ? `${MIN_YEAR} & older` : yearMin} – {yearMax}
                </span>
              </label>
              <div className="px-2">
                <YearRangeSlider
                  min={MIN_YEAR}
                  max={CURRENT_YEAR}
                  step={1}
                  value={[yearMin, yearMax]}
                  onValueChange={([min, max]) =>
                    setSettings(s => ({ ...s, year_from: min, year_to: max }))
                  }
                />
                <div className="flex justify-between mt-3 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{MIN_YEAR} & older</span>
                  <span>{CURRENT_YEAR}</span>
                </div>
              </div>
            </div>

            {/* Age ratings */}
            <div className="rounded-2xl p-4" style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                <label style={labelStyle}>
                    Age ratings —{' '}
                    <span style={{ color: 'var(--color-primary)' }}>
                    {settings.age_rating_filter.length === 0
                        ? 'All' : settings.age_rating_filter.join(', ')}
                    </span>
                </label>
                <InfoTooltip text={`G — All ages.\n\nPG — Parental guidance suggested.\n\nPG-13 — May be inappropriate under 13.\n\nR — Under 17 requires adult.\n\nNC-17 — Adults only.`} />
                </div>
                <div className="flex gap-2 flex-wrap">
                {AGE_RATINGS.map(({ rating }) => (
                    <button
                    key={rating}
                    onClick={() => toggleAgeRating(rating)}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition"
                    style={{
                        backgroundColor: settings.age_rating_filter.includes(rating)
                        ? 'var(--color-primary)' : 'var(--color-surface-2)',
                        color: settings.age_rating_filter.includes(rating)
                        ? '#FFFFFF' : 'var(--color-text-muted)',
                    }}
                    >
                    {rating}
                    </button>
                ))}
                </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Leave empty to include all ratings.
              </p>
            </div>
          </>
        )}

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full font-bold py-4 rounded-xl text-sm uppercase tracking-wide transition mb-6"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Creating...' : 'Create Session →'}
        </button>

      </div>
    </main>
  )
}