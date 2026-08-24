import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { findAuthErrorCodeInMessage, resolveAuthErrorFromLocation } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

// Destino de `redirectTo` en CU-032. Supabase Auth entrega aquí, según el flujo, tokens directo
// en el hash (`#access_token=...&refresh_token=...`) o un `code` de PKCE en el query — se
// manejan ambos formatos explícitamente (en vez de dejarlo al detectSessionInUrl automático del
// SDK) para poder capturar el rechazo real del Custom Access Token Hook (RN-098/102) y mostrarlo
// en Login — de lo contrario, un rechazo (o una sesión válida ignorada) se traduce en "regresa a
// Login sin ningún mensaje".
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    async function run() {
      const providerError = resolveAuthErrorFromLocation(window.location)
      if (providerError) {
        navigate(`/login?authError=${providerError}`, { replace: true })
        return
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          const errorCode = findAuthErrorCodeInMessage(error.message) ?? 'AUTH_003'
          navigate(`/login?authError=${errorCode}`, { replace: true })
          return
        }

        navigate('/', { replace: true })
        return
      }

      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        navigate('/login', { replace: true })
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        const errorCode = findAuthErrorCodeInMessage(error.message) ?? 'AUTH_003'
        navigate(`/login?authError=${errorCode}`, { replace: true })
        return
      }

      navigate('/', { replace: true })
    }

    run()
  }, [navigate])

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Completing sign-in…
    </div>
  )
}
