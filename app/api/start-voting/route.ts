// app/api/start-voting/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { session_id, participant_id } = await req.json()

  // Verify the requester is the admin
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', session_id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }
  if (session.admin_participant_id !== participant_id) {
    return NextResponse.json({ error: 'Only the admin can start voting.' }, { status: 403 })
  }
  if (session.phase !== 'lobby') {
    return NextResponse.json({ error: 'Session is not in lobby phase.' }, { status: 400 })
  }

  // ── Custom list mode ─────────────────────────────────────
  // Movies were already added to session_movies during the lobby.
  // Just flip the phase — don't touch session_movies.
  if (session.custom_list_mode) {
    const { data: existingMovies } = await supabase
      .from('session_movies')
      .select('id')
      .eq('session_id', session_id)

    if (!existingMovies?.length) {
      return NextResponse.json({ error: 'No movies in the custom list yet.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ phase: 'voting' })
      .eq('id', session_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  // ── Random pool mode ─────────────────────────────────────
  // Get all participants
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id')
    .eq('session_id', session_id)

  if (participantsError || !participants?.length) {
    return NextResponse.json({ error: 'No participants found.' }, { status: 400 })
  }

  // Get movies filtered by session settings
  let query = supabase.from('movies').select('id')

  if (session.genre_filter?.length > 0) {
    query = query.overlaps('genres', session.genre_filter)
  }
  if (session.year_from) {
    query = query.gte('year', session.year_from)
  }
  if (session.year_to) {
    query = query.lte('year', session.year_to)
  }
  if (session.age_rating_filter?.length > 0) {
    query = query.in('age_rating', session.age_rating_filter)
  }

  const { data: movies, error: moviesError } = await query

  if (moviesError || !movies?.length) {
    return NextResponse.json({ error: 'No movies found matching the filters.' }, { status: 400 })
  }

  // Shuffle and assign pool_size movies
  const shuffled = [...movies].sort(() => Math.random() - 0.5)
  const assigned = shuffled.slice(0, session.pool_size)

  const sessionMovieRows = assigned.map(movie => ({
    session_id,
    movie_id: movie.id,
  }))

  const { error: insertError } = await supabase
    .from('session_movies')
    .insert(sessionMovieRows)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Flip session phase to voting
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ phase: 'voting' })
    .eq('id', session_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}