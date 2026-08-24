import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // El intercambio del código de OAuth se maneja explícitamente en AuthCallbackPage (para
    // poder capturar un rechazo del Custom Access Token Hook y mostrarlo) — el auto-detect del
    // SDK lo haría en silencio y se perdería el error real (RN-098/102).
    detectSessionInUrl: false,
  },
})
