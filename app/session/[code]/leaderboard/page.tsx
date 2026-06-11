// app/session/[code]/leaderboard/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import type { LeaderboardEntry, Movie } from '@/lib/database.types'

export default function LeaderboardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const supabase = createBrowserClient()

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [movieDetails, setMovieDetails] = useState<Record<string, Movie>>({})
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [pendingNames, setPendingNames] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [trailerOpen, setTrailerOpen] = useState<string | null>(null)

  useEffect(() => {
    setSessionId(localStorage.getItem('session_id'))
  }, [])

  async function fetchLeaderboard(sid: string) {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('session_id', sid)
      .order('score_avg', { ascending: false })

    if (data) setEntries(data)

    const { data: participants } = await supabase
      .from('participants')
      .select('display_name, has_submitted')
      .eq('session_id', sid)

    if (participants) {
      setTotalParticipants(participants.length)
      setSubmittedCount(participants.filter(p => p.has_submitted).length)
      setPendingNames(participants.filter(p => !p.has_submitted).map(p => p.display_name))
    }

    setLoading(false)
  }

  async function fetchMovieDetails(movieId: string) {
    if (movieDetails[movieId]) return
    const { data } = await supabase.from('movies').select('*').eq('id', movieId).single()
    if (data) setMovieDetails(prev => ({ ...prev, [movieId]: data }))
  }

  function toggleExpand(movieId: string) {
    if (expandedId === movieId) {
      setExpandedId(null)
      setTrailerOpen(null)
    } else {
      setExpandedId(movieId)
      setTrailerOpen(null)
      fetchMovieDetails(movieId)
    }
  }

  useEffect(() => {
    if (!sessionId) return
    fetchLeaderboard(sessionId)

    const channel = supabase
      .channel(`leaderboard-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'participants',
        filter: `session_id=eq.${sessionId}`,
      }, () => fetchLeaderboard(sessionId))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  function formatScore(entry: LeaderboardEntry) {
    if (entry.rating_mode === 'binary') return `${entry.score_sum} 👍`
    return `${entry.score_avg} ⭐`
  }

  // Border colors for top 3
  const rankBorder: Record<number, string> = {
    0: 'var(--color-gold)',       // gold
    1: '#C0C0C0',                 // silver
    2: '#CD7F32',                 // bronze
  }

  // ── Expanded details panel ─────────────────────────────────
  function ExpandedDetails({ movieId }: { movieId: string }) {
    const details = movieDetails[movieId]
    if (!details) return (
      <p className="text-sm py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Loading...
      </p>
    )

    return (
      <div className="flex flex-col gap-3">
        {details.tagline && (
          <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
            "{details.tagline}"
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {details.runtime && (
            <span className="px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              ⏱ {details.runtime}m
            </span>
          )}
          {details.age_rating && (
            <span className="px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              {details.age_rating}
            </span>
          )}
          {details.tmdb_rating && (
            <span className="px-2 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-primary)' }}>
              ⭐ {details.tmdb_rating}
            </span>
          )}
        </div>

        {details.genres?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {details.genres.map(g => (
              <span key={g} className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                {g}
              </span>
            ))}
          </div>
        )}

        {details.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            {details.description}
          </p>
        )}

        {details.cast_names?.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}>Cast</p>
            <div className="flex flex-wrap gap-1.5">
              {details.cast_names.map(name => (
                <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {details.directors?.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}>
              {details.directors.length === 1 ? 'Director' : 'Directors'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {details.directors.map(name => (
                <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {details.writers?.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}>
              {details.writers.length === 1 ? 'Writer' : 'Writers'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {details.writers.map(name => (
                <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {details.trailer_key && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}>Trailer</p>
            {trailerOpen !== movieId ? (
              <button
                onClick={() => setTrailerOpen(movieId)}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}
              >
                ▶ Watch Trailer
              </button>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <iframe
                  width="100%" height="100%"
                  src={`https://www.youtube.com/embed/${details.trailer_key}?autoplay=1`}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading leaderboard...</p>
    </main>
  )

  const podium = entries.slice(0, 3)
  const rest   = entries.slice(3)

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => router.push(`/session/${code}/vote`)}
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Voting
        </button>
        <button
        onClick={() => router.push('/')}
        className="text-base font-extrabold uppercase tracking-wide"
        style={{ color: 'var(--color-primary)' }}
        >
        MOVIE <span style={{ color: 'var(--color-gold)' }}>PICKER</span>
        </button>
        <div className="w-16" />
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full flex flex-col gap-5">

        {/* Title + submission status */}
        <div>
          <h2 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>
            Leaderboard
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {submittedCount} of {totalParticipants} submitted
            </p>
            {pendingNames.length > 0 && (
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                ⏳ {pendingNames.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: totalParticipants > 0 ? `${(submittedCount / totalParticipants) * 100}%` : '0%',
              backgroundColor: 'var(--color-primary)',
            }}
          />
        </div>

        {entries.length === 0 ? (
          <div className="text-center mt-20 flex flex-col items-center gap-3">
            <p className="text-5xl">🍿</p>
            <p style={{ color: 'var(--color-text-muted)' }}>
              No results yet — waiting for people to finish voting.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">

            {/* Top 3 podium — single column, scaled by rank */}
            {podium.map((entry, i) => (
            <div
                key={entry.movie_id}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                style={{
                backgroundColor: 'var(--color-surface)',
                border: `2px solid ${rankBorder[i]}`,
                }}
            >
                <button
                onClick={() => toggleExpand(entry.movie_id)}
                className="w-full text-left"
                >
                {/* 1st place — square poster hero */}
                {i === 0 && entry.poster_url && (
                    <div className="relative">
                    <img
                        src={entry.poster_url}
                        alt={entry.title}
                        className="w-full object-cover"
                        style={{ height: '360px', objectPosition: 'top' }}
                    />
                    <div className="absolute top-3 left-3 text-2xl w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: 'var(--color-gold)' }}>
                        🥇
                    </div>
                    </div>
                )}

                <div className="flex items-center gap-3 p-4">
                    {/* 2nd and 3rd — small poster inline */}
                    {i > 0 && (
                    <div className="text-xl w-8 flex-shrink-0 text-center">
                        {i === 1 ? '🥈' : '🥉'}
                    </div>
                    )}

                    {i > 0 && entry.poster_url && (
                    <img
                        src={entry.poster_url}
                        alt={entry.title}
                        className="object-cover rounded-xl flex-shrink-0"
                        style={{ width: '48px', height: '68px' }}
                    />
                    )}

                    <div className="flex-1 min-w-0">
                    {/* 1st place gets bigger title */}
                    <p
                        className="font-extrabold leading-tight truncate"
                        style={{
                        color: 'var(--color-text)',
                        fontSize: i === 0 ? '1.25rem' : '0.875rem',
                        }}
                    >
                        {i === 0 && <span className="mr-2">🥇</span>}
                        {entry.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {entry.year}
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: rankBorder[i] }}>
                        {formatScore(entry)}{' '}
                        <span className="font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        · {entry.vote_count} {entry.vote_count === 1 ? 'vote' : 'votes'}
                        </span>
                    </p>
                    </div>

                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {expandedId === entry.movie_id ? '▲' : '▼'}
                    </span>
                </div>
                </button>

                {expandedId === entry.movie_id && (
                <div
                    className="px-4 pb-4"
                    style={{ borderTop: `1px solid ${rankBorder[i]}` }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="pt-3">
                    <ExpandedDetails movieId={entry.movie_id} />
                    </div>
                </div>
                )}
            </div>
            ))}

            {/* Divider before rest */}
            {rest.length > 0 && (
              <div className="flex flex-col items-center gap-2 my-2">
                <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
                <p className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)' }}>
                  Also ranked
                </p>
                <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            )}

            {/* 4th place onwards */}
            {rest.map((entry, i) => (
              <div
                key={entry.movie_id}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: expandedId === entry.movie_id
                    ? '2px solid var(--color-primary)'
                    : '1px solid var(--color-border)',
                }}
              >
                <button
                  onClick={() => toggleExpand(entry.movie_id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="text-sm font-extrabold w-7 flex-shrink-0 text-center"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {i + 4}
                  </div>
                  {entry.poster_url && (
                    <img
                      src={entry.poster_url}
                      alt={entry.title}
                      className="w-10 h-14 object-cover rounded-xl flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--color-text)' }}>
                      {entry.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{entry.year}</p>
                    <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>
                      {formatScore(entry)}{' '}
                      <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
                        · {entry.vote_count} {entry.vote_count === 1 ? 'vote' : 'votes'}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {expandedId === entry.movie_id ? '▲' : '▼'}
                  </span>
                </button>

                {expandedId === entry.movie_id && (
                  <div
                    className="px-4 pb-4"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <div className="pt-3">
                      <ExpandedDetails movieId={entry.movie_id} />
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>
        )}
      </div>
    </main>
  )
}