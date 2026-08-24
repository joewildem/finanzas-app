import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

// Se llena en AuthGate (única fuente de la sesión ya resuelta) para que las páginas protegidas
// no necesiten volver a suscribirse a supabase.auth por su cuenta solo para leer el usuario.
const AuthSessionContext = createContext<Session | null>(null)

export const AuthSessionProvider = AuthSessionContext.Provider

export function useAuthSession(): Session {
  const session = useContext(AuthSessionContext)
  if (!session) {
    throw new Error('useAuthSession must be used within an authenticated route (AuthGate)')
  }
  return session
}

export function getFirstName(session: Session): string | null {
  const fullName = session.user.user_metadata?.full_name as string | undefined
  if (!fullName) return null
  return fullName.trim().split(/\s+/)[0] ?? null
}

export function getAvatarUrl(session: Session): string | null {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined
  const avatarUrl = (metadata?.avatar_url ?? metadata?.picture) as string | undefined
  return avatarUrl ?? null
}
