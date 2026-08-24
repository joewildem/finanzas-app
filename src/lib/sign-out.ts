import { supabase } from '@/lib/supabase'

// CU-033: cerrar sesión revoca el refresh token del lado del servidor (no solo limpieza local).
// El flag distingue este cierre intencional del que AuthGate detecta cuando una sesión existente
// se invalida sola (CU-034, AUTH_001) — ambos casos disparan el mismo evento `SIGNED_OUT` de
// Supabase, así que sin este flag AuthGate no podría diferenciar "cerraste sesión" de "tu sesión
// expiró" y mostraría el mensaje equivocado.
let explicitSignOut = false

export function consumeExplicitSignOut(): boolean {
  const value = explicitSignOut
  explicitSignOut = false
  return value
}

export async function signOut() {
  explicitSignOut = true
  await supabase.auth.signOut()
}
