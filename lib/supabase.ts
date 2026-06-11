// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — reuse the same instance instead of creating a new one every render
let browserClient: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnon)
  }
  return browserClient
}

export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false },
  })
}