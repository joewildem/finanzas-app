import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthSessionProvider } from '@/lib/auth-context'
import { consumeExplicitSignOut } from '@/lib/sign-out'
import { useSession } from '@/lib/session'

// CU-034: sin sesión activa, ninguna ruta protegida muestra su contenido — redirige a Login
// antes de renderizar nada. Si hubo sesión y se invalidó sola (no por "Cerrar sesión" explícito,
// CU-033), se manda con AUTH_001 para que el Login muestre el motivo.
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession()
  const hadSession = useRef(false)
  const redirectComputed = useRef(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    if (session) hadSession.current = true
  }, [session])

  useEffect(() => {
    // Guardado por ref (no por estado): en StrictMode React invoca los efectos dos veces en
    // desarrollo, y consumeExplicitSignOut() solo debe leerse/resetearse una vez por transición
    // a sesión nula — de lo contrario la segunda pasada ya la encuentra en falso y muestra
    // AUTH_001 después de un "Cerrar sesión" normal.
    if (session === null && !redirectComputed.current) {
      redirectComputed.current = true
      const wasExplicitSignOut = consumeExplicitSignOut()
      const search = !wasExplicitSignOut && hadSession.current ? '?authError=AUTH_001' : ''
      setRedirectTo(`/login${search}`)
    }
  }, [session])

  if (session === undefined || (session === null && redirectTo === null)) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

  return <AuthSessionProvider value={session}>{children}</AuthSessionProvider>
}
