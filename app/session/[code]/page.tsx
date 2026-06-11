// app/session/[code]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { YearRangeSlider } from '@/components/YearRangeSlider'
import type { Session, Participant, Movie, SessionSettings } from '@/lib/database.types'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1980

const GENRES = [
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
const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17']

export default function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()

  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Custom list state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Movie[]>([])
  const [customMovies, setCustomMovies] = useState<Movie[]>([])
  const [searching, setSearching] = useState(false)

  // Settings edit state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editedSettings, setEditedSettings] = useState<Partial<SessionSettings>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [genresOpen, setGenresOpen] = useState(false)

  // Clipboard
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const savedParticipantId = localStorage.getItem('participant_id')
    const savedSessionId = localStorage.getItem('session_id')
    if (!savedParticipantId || !savedSessionId) {
      router.push(`/join?code=${code}`)
      return
    }
    setMyId(savedParticipantId)
  }, [code])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('join_code', code)
        .single()
      if (error || !data) { setNotFound(true); return }
      setSession(data)
      setEditedSettings({
        rating_mode: data.rating_mode,
        pool_size: data.pool_size,
        genre_filter: data.genre_filter,
        year_from: data.year_from,
        year_to: data.year_to,
        age_rating_filter: data.age_rating_filter,
        custom_list_mode: data.custom_list_mode,
      })
    }
    load()
  }, [code])

  useEffect(() => {
    if (!session) return

    supabase
      .from('participants').select('*').eq('session_id', session.id)
      .then(({ data }) => data && setParticipants(data))

    const channel = supabase
      .channel(`participants-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${session.id}` },
        () => supabase.from('participants').select('*').eq('session_id', session.id)
          .then(({ data }) => data && setParticipants(data)))
      .subscribe()

    const sessionChannel = supabase
      .channel(`session-phase-${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          if (payload.new.phase === 'voting') router.push(`/session/${code}/vote`)
          // Also update local session state when settings change
          setSession(prev => prev ? { ...prev, ...payload.new } : prev)
        })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(sessionChannel)
    }
  }, [session])

  useEffect(() => {
    if (!session?.custom_list_mode) return

    async function fetchCustomMovies() {
      const { data } = await supabase
        .from('session_movies').select('movie_id, movies(*)').eq('session_id', session!.id)
      if (data) setCustomMovies(data.map((sm: any) => sm.movies).filter(Boolean))
    }
    fetchCustomMovies()

    const moviesChannel = supabase
      .channel(`session-movies-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_movies', filter: `session_id=eq.${session.id}` },
        () => fetchCustomMovies())
      .subscribe()

    return () => { supabase.removeChannel(moviesChannel) }
  }, [session])

  function moviePassesFilters(movie: Movie): boolean {
    if (!session) return true
    if (session.genre_filter?.length > 0) {
      if (!movie.genres?.some(g => session.genre_filter.includes(g))) return false
    }
    if (session.year_from && movie.year && movie.year < session.year_from) return false
    if (session.year_to && movie.year && movie.year > session.year_to) return false
    if (session.age_rating_filter?.length > 0) {
      if (!movie.age_rating || !session.age_rating_filter.includes(movie.age_rating)) return false
    }
    return true
  }

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('movies').select('*').ilike('title', `%${query}%`).limit(8)
    setSearchResults(data || [])
    setSearching(false)
  }

  async function addMovie(movie: Movie) {
    if (!session || !myId) return
    if (customMovies.some(m => m.id === movie.id)) return
    await supabase.from('session_movies').insert({
      session_id: session.id, movie_id: movie.id, added_by_participant_id: myId,
    })
    setSearchQuery('')
    setSearchResults([])
  }

  async function removeMovie(movieId: string) {
    if (!session) return
    await supabase.from('session_movies').delete().eq('session_id', session.id).eq('movie_id', movieId)
  }

  async function saveSettings() {
    if (!session) return
    setSavingSettings(true)
    await supabase.from('sessions').update(editedSettings).eq('id', session.id)
    setSession(s => s ? { ...s, ...editedSettings } as Session : s)
    setSettingsOpen(false)
    setSavingSettings(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(session?.share_link || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isAdmin = myId === session?.admin_participant_id

  const cardStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
  }
  const labelStyle = {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  if (notFound) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Session not found. Check your join code.</p>
    </main>
  )

  if (!session) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </main>
  )

  const yearMin = editedSettings.year_from ?? MIN_YEAR
  const yearMax = editedSettings.year_to ?? CURRENT_YEAR

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="w-12" />
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

        {/* Title */}
        <div>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>Lobby</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Share the code with your group.</p>
        </div>

        {/* Join code card */}
        <div className="rounded-2xl p-6 text-center" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Join code
          </p>
          <p className="text-5xl font-extrabold tracking-widest mb-3" style={{ color: 'var(--color-primary)' }}>
            {code}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={copyLink}
              className="text-xs font-semibold px-4 py-2 rounded-xl transition"
              style={{
                backgroundColor: copied ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: copied ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {copied ? '✓ Copied!' : '🔗 Copy link'}
            </button>

            {/* Share button — only shown if Web Share API is available (mobile) */}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={() => navigator.share({
                  title: 'Join my Movie Picker session!',
                  text: `Join my Movie Picker session with code ${code}`,
                  url: session.share_link,
                })}
                className="text-xs font-semibold px-4 py-2 rounded-xl transition"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                }}
              >
                📤 Share
              </button>
            )}
        </div>
        </div>

        {/* Participants */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <p className="mb-3" style={labelStyle}>Who's here ({participants.length})</p>
          <ul className="flex flex-col gap-2">
            {participants.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--color-surface-2)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-text)' }}>
                  {p.display_name}
                </span>
                {p.id === session.admin_participant_id && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-primary)' }}>
                    host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Session settings summary */}
        <div className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
            <p style={labelStyle}>Session settings</p>
            {isAdmin && (
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition"
                style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
              >
                {settingsOpen ? 'Cancel' : '✏️ Edit'}
              </button>
            )}
          </div>

          {!settingsOpen ? (
            // Settings summary view
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Rating</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {session.rating_mode === 'binary' ? '👍 Yes / No'
                    : session.rating_mode === '3-star' ? '⭐ 3 Stars'
                    : '🎯 1 – 10'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Movies per person</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{session.pool_size}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Movie source</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {session.custom_list_mode ? '✏️ Custom list' : '🎲 Random pool'}
                </span>
              </div>
              {!session.custom_list_mode && (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Genres</span>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {session.genre_filter?.length === GENRE_NAMES.length ? 'All' : `${session.genre_filter?.length} selected`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Years</span>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {session.year_from ?? `${MIN_YEAR} & older`} – {session.year_to ?? CURRENT_YEAR}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Age ratings</span>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {session.age_rating_filter?.length === 0 ? 'All' : session.age_rating_filter?.join(', ')}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Settings edit form
            <div className="flex flex-col gap-4">

              {/* Rating mode */}
              <div>
                <p className="mb-2" style={labelStyle}>Rating mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'binary', emoji: '👍', label: 'Yes / No' },
                    { value: '3-star', emoji: '⭐', label: '3 Stars' },
                    { value: '1-10',   emoji: '🎯', label: '1 – 10' },
                  ].map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setEditedSettings(s => ({ ...s, rating_mode: mode.value as any }))}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition"
                      style={{
                        backgroundColor: editedSettings.rating_mode === mode.value
                          ? 'var(--color-primary)' : 'var(--color-surface-2)',
                        color: editedSettings.rating_mode === mode.value
                          ? '#fff' : 'var(--color-text-muted)',
                      }}
                    >
                      <span className="text-xl">{mode.emoji}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pool size */}
              <div>
                <p className="mb-2" style={labelStyle}>Movies per person</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditedSettings(s => ({ ...s, pool_size: Math.max(1, (s.pool_size ?? 20) - 5) }))}
                    className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                  >−</button>
                  <input
                    type="number"
                    value={editedSettings.pool_size ?? 20}
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val > 0) setEditedSettings(s => ({ ...s, pool_size: val }))
                    }}
                    className="flex-1 h-11 rounded-xl font-bold text-lg text-center outline-none"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: '2px solid var(--color-primary)',
                      color: 'var(--color-text)',
                    }}
                  />
                  <button
                    onClick={() => setEditedSettings(s => ({ ...s, pool_size: (s.pool_size ?? 20) + 5 }))}
                    className="w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                  >+</button>
                </div>
              </div>

              {/* Movie source */}
              <div>
                <p className="mb-2" style={labelStyle}>Movie source</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: false, emoji: '🎲', label: 'Random Pool', desc: 'Auto-picked' },
                    { value: true,  emoji: '✏️', label: 'Custom List', desc: 'Group picks' },
                  ].map(mode => (
                    <button
                      key={String(mode.value)}
                      onClick={() => setEditedSettings(s => ({ ...s, custom_list_mode: mode.value }))}
                      className="flex flex-col items-start gap-0.5 p-3 rounded-xl text-left transition"
                      style={{
                        backgroundColor: editedSettings.custom_list_mode === mode.value
                          ? 'var(--color-primary)' : 'var(--color-surface-2)',
                        color: editedSettings.custom_list_mode === mode.value
                          ? '#fff' : 'var(--color-text-muted)',
                      }}
                    >
                      <span className="text-xl">{mode.emoji}</span>
                      <span className="font-bold text-xs">{mode.label}</span>
                      <span className="text-xs opacity-75">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres */}
              {!editedSettings.custom_list_mode && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p style={labelStyle}>
                        Genres —{' '}
                        <span style={{ color: 'var(--color-primary)' }}>
                          {(editedSettings.genre_filter?.length ?? 0) === GENRE_NAMES.length
                            ? 'All' : `${editedSettings.genre_filter?.length ?? 0} selected`}
                        </span>
                      </p>
                      <button
                        onClick={() => setGenresOpen(o => !o)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                      >
                        {genresOpen ? 'Collapse ↑' : 'Edit ↓'}
                      </button>
                    </div>
                    {genresOpen && (
                      <>
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => setEditedSettings(s => ({ ...s, genre_filter: [...GENRE_NAMES] }))}
                            className="text-xs font-semibold px-3 py-1 rounded-lg"
                            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                          >Select all</button>
                          <button
                            onClick={() => setEditedSettings(s => ({ ...s, genre_filter: [] }))}
                            className="text-xs font-semibold px-3 py-1 rounded-lg"
                            style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
                          >Clear</button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {GENRES.map(g => (
                            <button
                              key={g.name}
                              onClick={() => setEditedSettings(s => ({
                                ...s,
                                genre_filter: s.genre_filter?.includes(g.name)
                                  ? s.genre_filter.filter(x => x !== g.name)
                                  : [...(s.genre_filter ?? []), g.name]
                              }))}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition"
                              style={{
                                backgroundColor: editedSettings.genre_filter?.includes(g.name)
                                  ? 'var(--color-primary)' : 'var(--color-surface-2)',
                                color: editedSettings.genre_filter?.includes(g.name)
                                  ? '#fff' : 'var(--color-text-muted)',
                              }}
                            >
                              <span>{g.emoji}</span><span>{g.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Year range */}
                  <div>
                    <p className="mb-3" style={labelStyle}>
                      Release year —{' '}
                      <span style={{ color: 'var(--color-primary)' }}>
                        {yearMin === MIN_YEAR ? `${MIN_YEAR} & older` : yearMin} – {yearMax}
                      </span>
                    </p>
                    <div className="px-2">
                      <YearRangeSlider
                        min={MIN_YEAR} max={CURRENT_YEAR} step={1}
                        value={[yearMin, yearMax]}
                        onValueChange={([min, max]) =>
                          setEditedSettings(s => ({ ...s, year_from: min, year_to: max }))
                        }
                      />
                      <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <span>{MIN_YEAR} & older</span><span>{CURRENT_YEAR}</span>
                      </div>
                    </div>
                  </div>

                  {/* Age ratings */}
                  <div>
                    <p className="mb-2" style={labelStyle}>
                      Age ratings —{' '}
                      <span style={{ color: 'var(--color-primary)' }}>
                        {(editedSettings.age_rating_filter?.length ?? 0) === 0 ? 'All' : editedSettings.age_rating_filter?.join(', ')}
                      </span>
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {AGE_RATINGS.map(rating => (
                        <button
                          key={rating}
                          onClick={() => setEditedSettings(s => ({
                            ...s,
                            age_rating_filter: s.age_rating_filter?.includes(rating)
                              ? s.age_rating_filter.filter(r => r !== rating)
                              : [...(s.age_rating_filter ?? []), rating]
                          }))}
                          className="px-4 py-2 rounded-xl text-sm font-bold transition"
                          style={{
                            backgroundColor: editedSettings.age_rating_filter?.includes(rating)
                              ? 'var(--color-primary)' : 'var(--color-surface-2)',
                            color: editedSettings.age_rating_filter?.includes(rating)
                              ? '#fff' : 'var(--color-text-muted)',
                          }}
                        >{rating}</button>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Leave empty for all ratings.</p>
                  </div>
                </>
              )}

              {/* Save button */}
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full font-bold py-3 rounded-xl text-sm uppercase tracking-wide transition"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: savingSettings ? 0.6 : 1 }}
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>

        {/* Custom list movie search */}
        {session.custom_list_mode && (
          <div className="rounded-2xl p-4" style={cardStyle}>
            <p className="mb-3" style={labelStyle}>Movie list ({customMovies.length} added)</p>

            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search for a movie to add..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              {searching && (
                <p className="absolute right-4 top-3.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Searching...
                </p>
              )}
            </div>

            {searchResults.length > 0 && (
              <ul className="flex flex-col mb-3 rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}>
                {searchResults.map(movie => {
                  const alreadyAdded = customMovies.some(m => m.id === movie.id)
                  const passesFilters = moviePassesFilters(movie)
                  return (
                    <li
                      key={movie.id}
                      className="flex items-center gap-3 px-4 py-3 transition"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        opacity: passesFilters ? 1 : 0.4,
                      }}
                    >
                      {movie.poster_url && (
                        <img src={movie.poster_url} alt={movie.title} className="w-8 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                          {movie.title}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {movie.year}
                          {!passesFilters && <span className="ml-1">· doesn't match filters</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => passesFilters && !alreadyAdded && addMovie(movie)}
                        disabled={alreadyAdded || !passesFilters}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold transition flex-shrink-0"
                        style={{
                          backgroundColor: alreadyAdded || !passesFilters
                            ? 'var(--color-surface)' : 'var(--color-primary)',
                          color: alreadyAdded || !passesFilters ? 'var(--color-text-muted)' : '#fff',
                          cursor: alreadyAdded || !passesFilters ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {alreadyAdded ? 'Added' : !passesFilters ? 'Filtered' : '+ Add'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {customMovies.length === 0 ? (
              <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
                No movies added yet — search above!
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {customMovies.map(movie => (
                  <li key={movie.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    {movie.poster_url && (
                      <img src={movie.poster_url} alt={movie.title} className="w-8 h-12 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {movie.title}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {movie.year}{movie.genres?.length > 0 && ` · ${movie.genres[0]}`}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => removeMovie(movie.id)}
                        className="text-lg flex-shrink-0 transition"
                        style={{ color: 'var(--color-text-muted)' }}
                      >×</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Start voting */}
        {isAdmin && (
          <button
            className="w-full font-bold py-4 rounded-xl text-sm uppercase tracking-wide transition mb-6"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            onClick={async () => {
              const res = await fetch('/api/start-voting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: session.id, participant_id: myId }),
              })
              const data = await res.json()
              if (data.error) alert(data.error)
              else router.push(`/session/${code}/vote`)
            }}
          >
            Start Voting →
          </button>
        )}

        {!isAdmin && (
          <p className="text-center text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Waiting for the host to start voting...
          </p>
        )}

      </div>
    </main>
  )
}