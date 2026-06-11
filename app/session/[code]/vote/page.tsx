// app/session/[code]/vote/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import type { Movie } from '@/lib/database.types'

export default function VotePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const supabase = createBrowserClient()

  const [movies, setMovies] = useState<Movie[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [votes, setVotes] = useState<Record<string, number>>({}) // movieId → score
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [ratingMode, setRatingMode] = useState<string>('binary')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [trailerOpen, setTrailerOpen] = useState(false)

  useEffect(() => {
    setParticipantId(localStorage.getItem('participant_id'))
    setSessionId(localStorage.getItem('session_id'))
  }, [])

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      const { data: session } = await supabase
        .from('sessions')
        .select('rating_mode, pool_size')
        .eq('id', sessionId!)
        .single()

      if (session) setRatingMode(session.rating_mode)

      const { data: sessionMovies } = await supabase
        .from('session_movies')
        .select('movie_id, movies(*)')
        .eq('session_id', sessionId!)

      if (sessionMovies) {
        const movieList = sessionMovies.map((sm: any) => sm.movies).filter(Boolean)
        setMovies(movieList)
      }

      // Load any existing votes (for back button support)
      if (participantId) {
        const { data: existingVotes } = await supabase
          .from('votes')
          .select('movie_id, score')
          .eq('session_id', sessionId!)
          .eq('participant_id', participantId)

        if (existingVotes && existingVotes.length > 0) {
          const voteMap: Record<string, number> = {}
          existingVotes.forEach(v => { voteMap[v.movie_id] = v.score })
          setVotes(voteMap)
          // Resume from where they left off
          setCurrentIndex(existingVotes.length)
        }
      }

      setLoading(false)
    }

    load()
  }, [sessionId, participantId])

  // Reset details/trailer when movie changes
  useEffect(() => {
    setDetailsOpen(false)
    setTrailerOpen(false)
  }, [currentIndex])

  async function submitVote(score: number) {
    if (!sessionId || !participantId) return
    setSubmitting(true)

    const movie = movies[currentIndex]

    // Upsert the vote (handles going back and re-voting)
    await supabase.from('votes').upsert({
      session_id: sessionId,
      participant_id: participantId,
      movie_id: movie.id,
      score,
    }, { onConflict: 'session_id,participant_id,movie_id' })

    // Save vote locally
    setVotes(prev => ({ ...prev, [movie.id]: score }))

    const nextIndex = currentIndex + 1

    if (nextIndex >= movies.length) {
      await supabase
        .from('participants')
        .update({ has_submitted: true })
        .eq('id', participantId)
      setDone(true)
    } else {
      setCurrentIndex(nextIndex)
    }

    setSubmitting(false)
  }

  function goBack() {
    if (currentIndex === 0) return
    setCurrentIndex(i => i - 1)
  }

  async function handleStartOver() {
    if (!sessionId || !participantId) return
    await supabase.from('votes').delete()
      .eq('session_id', sessionId).eq('participant_id', participantId)
    await supabase.from('participants').update({ has_submitted: false }).eq('id', participantId)
    setVotes({})
    setCurrentIndex(0)
    setDone(false)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading movies...</p>
    </main>
  )

  if (done) return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--color-text)' }}>
          You're done!
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Check the leaderboard to see results.</p>
      </div>
      <button
        onClick={() => router.push(`/session/${code}/leaderboard`)}
        className="w-full max-w-sm font-bold py-4 rounded-xl text-sm uppercase tracking-wide"
        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
      >
        See Leaderboard →
      </button>
      <button
        onClick={handleStartOver}
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Start Over
      </button>
    </main>
  )

  const movie = movies[currentIndex]
  if (!movie) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>No movies found for this session.</p>
    </main>
  )

  const existingVote = votes[movie.id]

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={goBack}
          disabled={currentIndex === 0}
          className="text-sm font-semibold transition"
          style={{ color: currentIndex === 0 ? 'var(--color-border)' : 'var(--color-text-muted)' }}
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
        <button
          onClick={handleStartOver}
          className="text-xs font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Reset
        </button>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-4 gap-4">

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}>
            <span>{currentIndex + 1} of {movies.length}</span>
            <span>{Math.round((currentIndex / movies.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${((currentIndex) / movies.length) * 100}%`,
                backgroundColor: 'var(--color-primary)',
              }}
            />
          </div>
        </div>

        {/* Movie card */}
        <div className="rounded-2xl overflow-hidden" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}>
          {/* Poster */}
          {movie.poster_url && (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full object-cover"
              style={{ maxHeight: '380px' }}
            />
          )}

          <div className="p-4">
            {/* Title + meta */}
            <h2 className="text-xl font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>
              {movie.title}
            </h2>

            {movie.tagline && (
              <p className="text-sm italic mb-2" style={{ color: 'var(--color-text-muted)' }}>
                "{movie.tagline}"
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-3 text-xs font-semibold">
              {movie.year && (
                <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  📅 {movie.year}
                </span>
              )}
              {movie.runtime && (
                <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  ⏱ {movie.runtime}m
                </span>
              )}
              {movie.age_rating && (
                <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  {movie.age_rating}
                </span>
              )}
              {movie.tmdb_rating && (
                <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-primary)' }}>
                  ⭐ {movie.tmdb_rating}
                </span>
              )}
            </div>

            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {movie.genres.map(g => (
                  <span key={g} className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Details spoiler */}
            <button
              onClick={() => setDetailsOpen(o => !o)}
              className="w-full text-left text-xs font-semibold py-2 flex items-center justify-between"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <span>More details</span>
              <span>{detailsOpen ? '▲' : '▼'}</span>
            </button>

            {detailsOpen && (
              <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                {/* Description */}
                {movie.description && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {movie.description}
                  </p>
                )}

                {/* Cast */}
                {movie.cast_names?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--color-text-muted)' }}>Cast</p>
                    <div className="flex flex-wrap gap-1.5">
                      {movie.cast_names.map(name => (
                        <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Director */}
                {movie.directors?.length > 0 && (
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {movie.directors.length === 1 ? 'Director' : 'Directors'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                    {movie.directors.map(name => (
                        <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                        {name}
                        </span>
                    ))}
                    </div>
                </div>
                )}

                {/* Writers */}
                {movie.writers?.length > 0 && (
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {movie.writers.length === 1 ? 'Writer' : 'Writers'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                    {movie.writers.map(name => (
                        <span key={name} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                        {name}
                        </span>
                    ))}
                    </div>
                </div>
                )}
                {/* Trailer */}
                {movie.trailer_key && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--color-text-muted)' }}>Trailer</p>
                    {!trailerOpen ? (
                      <button
                        onClick={() => setTrailerOpen(true)}
                        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
                        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }}
                      >
                        <span>▶</span> Watch Trailer
                      </button>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${movie.trailer_key}?autoplay=1`}
                          title="Trailer"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Previously voted indicator */}
        {existingVote !== undefined && (
          <p className="text-center text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            You previously rated this —{' '}
            {ratingMode === 'binary'
              ? existingVote === 1 ? '👍 Yes' : '👎 No'
              : ratingMode === '3-star'
              ? '⭐'.repeat(existingVote)
              : `${existingVote}/10`
            }. Select again to confirm or change.
          </p>
        )}

        {/* Rating buttons */}
        <div className="pb-6">
          {ratingMode === 'binary' && (
            <div className="flex gap-3">
              <button
                disabled={submitting}
                onClick={() => submitVote(0)}
                className="flex-1 py-5 rounded-2xl text-3xl font-bold transition"
                style={{
                  backgroundColor: existingVote === 0 ? '#ef4444' : 'var(--color-surface)',
                  border: `2px solid ${existingVote === 0 ? '#ef4444' : 'var(--color-border)'}`,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                👎
              </button>
              <button
                disabled={submitting}
                onClick={() => submitVote(1)}
                className="flex-1 py-5 rounded-2xl text-3xl font-bold transition"
                style={{
                  backgroundColor: existingVote === 1 ? '#22c55e' : 'var(--color-surface)',
                  border: `2px solid ${existingVote === 1 ? '#22c55e' : 'var(--color-border)'}`,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                👍
              </button>
            </div>
          )}

          {ratingMode === '3-star' && (
            <div className="flex gap-3">
              {[1, 2, 3].map(star => (
                <button
                  key={star}
                  disabled={submitting}
                  onClick={() => submitVote(star)}
                  className="flex-1 py-5 rounded-2xl text-2xl font-bold transition"
                  style={{
                    backgroundColor: existingVote === star ? 'var(--color-gold)' : 'var(--color-surface)',
                    border: `2px solid ${existingVote === star ? 'var(--color-gold)' : 'var(--color-border)'}`,
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {'⭐'.repeat(star)}
                </button>
              ))}
            </div>
          )}

          {ratingMode === '1-10' && (
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  disabled={submitting}
                  onClick={() => submitVote(n)}
                  className="py-4 rounded-xl font-bold text-lg transition"
                  style={{
                    backgroundColor: existingVote === n ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: existingVote === n ? '#fff' : 'var(--color-text)',
                    border: `2px solid ${existingVote === n ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}