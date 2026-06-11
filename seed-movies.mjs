// seed-movies.mjs
// Run: node seed-movies.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TMDB_API_KEY   = process.env.TMDB_API_KEY
const PAGES_TO_FETCH = 50  // 20 per page × 50 = 1000 movies

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_API_KEY) {
  console.error('❌ Missing environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchPage(page) {
  const res  = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`)
  const data = await res.json()
  return data.results
}

async function fetchMovieDetails(tmdbId) {
  // Single call with append_to_response gets everything at once
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,release_dates`
  const res  = await fetch(url)
  return await res.json()
}

async function main() {
  console.log('🎬 Fetching movies from TMDB...')

  const allMovies = []
  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    console.log(`  Fetching page ${page} of ${PAGES_TO_FETCH}...`)
    const movies = await fetchPage(page)
    allMovies.push(...movies)
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`✅ Got ${allMovies.length} movies. Fetching details...`)

  // Fetch genre list for ID → name mapping
  const genreRes  = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`)
  const genreData = await genreRes.json()
  const genreMap  = Object.fromEntries(genreData.genres.map(g => [g.id, g.name]))

  const rows = []

  for (let i = 0; i < allMovies.length; i++) {
    const m       = allMovies[i]
    const details = await fetchMovieDetails(m.id)
    await new Promise(r => setTimeout(r, 300))

    // US age certification
    const usRelease = details.release_dates?.results?.find(r => r.iso_3166_1 === 'US')
    const cert      = usRelease?.release_dates?.find(d => d.certification)?.certification || null

    // Top 4 cast names
    const castNames = (details.credits?.cast || [])
      .slice(0, 4)
      .map(c => c.name)

    // YouTube trailer key (prefer official trailer)
    const videos     = details.videos?.results || []
    const trailer    = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
      || videos.find(v => v.site === 'YouTube')
    const trailerKey = trailer?.key || null

    // Directors and writers from crew
    const crew = details.credits?.crew || []
    const directors = crew
    .filter(c => c.job === 'Director')
    .map(c => c.name)
    const writers = crew
    .filter(c => c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
    .map(c => c.name)
    .filter((name, i, arr) => arr.indexOf(name) === i)

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
  }

  console.log('\n💾 Inserting into Supabase...')

  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20)
    const { error } = await supabase
      .from('movies')
      .upsert(batch, { onConflict: 'tmdb_id' })

    if (error) console.error(`❌ Batch ${i}:`, error.message)
    else console.log(`  Inserted rows ${i + 1}–${i + batch.length}`)
  }

  console.log('🎉 Done!')
}

main()