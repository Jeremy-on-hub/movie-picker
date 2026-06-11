export interface Movie {
  id: string
  tmdb_id: number
  title: string
  year: number | null
  genres: string[]
  age_rating: string | null
  poster_url: string | null
  description: string | null
  popularity: number
  tagline: string | null
  runtime: number | null
  tmdb_rating: number | null
  trailer_key: string | null
  cast_names: string[]
  directors: string[]
  writers: string[]
}