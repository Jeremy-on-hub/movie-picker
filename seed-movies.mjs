// seed-movies.mjs
// Fetches all movies with 5000+ votes from TMDB
// Run: node seed-movies.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TMDB_API_KEY   = process.env.TMDB_API_KEY
const MIN_VOTES      = 5000
const DELAY_MS       = 300  // be polite to the API

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_API_KEY) {
  console.error('❌ Missing environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchDiscoverPage(page) {
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=vote_count.desc&vote_count.gte=${MIN_VOTES}&page=${page}`
  const res  = await fetch(url)
  const data = await res.json()
  return { results: data.results || [], totalPages: data.total_pages || 1 }
}

async function fetchMovieDetails(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,release_dates`
  const res  = await fetch(url)
  return await res.json()
}

async function main() {
  console.log(`🎬 Fetching all movies with ${MIN_VOTES}+ votes from TMDB...`)

  // First fetch page 1 to find out total pages
  const { results: firstPage, totalPages } = await fetchDiscoverPage(1)
  console.log(`📄 Total pages: ${totalPages}`)

  const allMovies = [...firstPage]

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    process.stdout.write(`  Fetching page ${page}/${totalPages}...\r`)
    const { results } = await fetchDiscoverPage(page)
    allMovies.push(...results)
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`\n✅ Found ${allMovies.length} movies. Fetching full details...`)

  // Fetch genre list
  const genreRes  = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`)
  const genreData = await genreRes.json()
  const genreMap  = Object.fromEntries(genreData.genres.map(g => [g.id, g.name]))

  const rows = []

  for (let i = 0; i < allMovies.length; i++) {
    const m       = allMovies[i]
    const details = await fetchMovieDetails(m.id)
    await new Promise(r => setTimeout(r, DELAY_MS))

    // US age certification
    const usRelease = details.release_dates?.results?.find(r => r.iso_3166_1 === 'US')
    const cert      = usRelease?.release_dates?.find(d => d.certification)?.certification || null

    // Top 4 cast
    const castNames = (details.credits?.cast || []).slice(0, 4).map(c => c.name)

    // Directors and writers
    const crew      = details.credits?.crew || []
    const directors = crew.filter(c => c.job === 'Director').map(c => c.name)
    const writers   = crew
      .filter(c => c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
      .map(c => c.name)
      .filter((name, i, arr) => arr.indexOf(name) === i)

    // YouTube trailer
    const videos     = details.videos?.results || []
    const trailer    = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
      || videos.find(v => v.site === 'YouTube')
    const trailerKey = trailer?.key || null

    rows.push({
      tmdb_id:     m.id,
      title:       m.title,
      year:        m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
      genres:      (m.genre_ids || []).map(id => genreMap[id]).filter(Boolean),
      age_rating:  cert,
      poster_url:  m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      description: m.overview || null,
      popularity:  m.popularity,
      tagline:     details.tagline || null,
      runtime:     details.runtime || null,
      tmdb_rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
      trailer_key: trailerKey,
      cast_names:  castNames,
      directors,
      writers,
    })

    process.stdout.write(`  Processed: ${rows.length}/${allMovies.length}\r`)

    // Insert in batches of 20 as we go to avoid losing progress
    if (rows.length % 100 === 0) {
      const batch = rows.slice(rows.length - 100, rows.length)
      const { error } = await supabase
        .from('movies')
        .upsert(batch, { onConflict: 'tmdb_id' })
      if (error) console.error(`\n❌ Batch error:`, error.message)
      else process.stdout.write(`  💾 Saved ${rows.length} so far...\r`)
    }
  }

  // Insert any remaining rows
  const remaining = rows.length % 100
  if (remaining > 0) {
    const batch = rows.slice(rows.length - remaining)
    const { error } = await supabase
      .from('movies')
      .upsert(batch, { onConflict: 'tmdb_id' })
    if (error) console.error(`\n❌ Final batch error:`, error.message)
  }

  console.log(`\n🎉 Done! ${rows.length} movies in your database.`)
}

main()