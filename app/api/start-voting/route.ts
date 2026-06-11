// app/api/start-voting/route.ts
// Called when the admin clicks "Start Voting".
// Assigns movies to participants and flips the session to voting phase.

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

  // Get all participants in the session
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
    // Filter movies that contain at least one of the selected genres
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

  // Shuffle the movies randomly (Fisher-Yates shuffle)
  const shuffled = [...movies].sort(() => Math.random() - 0.5)

  // Assign pool_size movies to each participant
  const sessionMovieRows: { session_id: string; movie_id: string }[] = []
  const assignedMovieIds = new Set<string>()

  for (const participant of participants) {
    // Pick movies for this participant (up to pool_size)
    const assigned = shuffled.slice(0, session.pool_size)
    for (const movie of assigned) {
      // Avoid duplicate session_movie rows
      if (!assignedMovieIds.has(movie.id)) {
        assignedMovieIds.add(movie.id)
        sessionMovieRows.push({
          session_id,
          movie_id: movie.id,
        })
      }
    }
  }

  // Insert session_movies
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