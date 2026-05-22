import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton for client-side usage (Realtime subscriptions)
let _client: ReturnType<typeof createClient> | null = null
export function getSupabase() {
  if (!_client) _client = createClient(url, key)
  return _client
}

// Fresh client for server-side API routes
export function serverSupabase() {
  return createClient(url, key)
}
