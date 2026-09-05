import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AUTH_ERROR_MESSAGES, findAuthErrorCodeInMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

// Identidad de pruebas del stack local — la misma que da de alta supabase/seed.sql en el allowlist.
const DEV_EMAIL = 'dev@localhost.test'
const DEV_PASSWORD = 'localdev123'

// Ingreso por correo/contraseña para el ambiente local (Supabase en Docker, sin OAuth de Google
// configurado) — ver docs/desarrollo/ambiente-local.md. En producción el único acceso sigue siendo
// Google (CU-032).
//
// Vive en su propio módulo, y no incrustado en LoginPage, para que el `import.meta.env.DEV` que lo
// renderiza (Vite lo sustituye por `false` al compilar) deje al componente entero sin referencias y
// el bundler pueda eliminarlo — incluidas estas credenciales. Escrito dentro de LoginPage, los
// `useState` quedaban fuera del condicional y los strings sobrevivían en el bundle publicado.
export function DevSignInPanel() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(DEV_EMAIL)
  const [password, setPassword] = useState(DEV_PASSWORD)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intenta iniciar sesión y, si el usuario todavía no existe (base recién creada con
  // `supabase db reset`), lo da de alta — el alta por correo está habilitada nada más en el
  // config.toml del stack local. Quien decide si entra sigue siendo el Custom Access Token Hook
  // contra el allowlist de `public.users` (AUTH_002 si el correo no está ahí), igual que producción.
  async function handleSignIn() {
    setError(null)
    setIsBusy(true)

    const signIn = await supabase.auth.signInWithPassword({ email, password })
    let signInError = signIn.error

    if (signInError && signInError.message.toLowerCase().includes('invalid login credentials')) {
      const signUp = await supabase.auth.signUp({ email, password })
      signInError = signUp.error
    }

    setIsBusy(false)

    if (signInError) {
      const code = findAuthErrorCodeInMessage(signInError.message)
      setError(code ? AUTH_ERROR_MESSAGES[code] : signInError.message)
      return
    }

    // A diferencia del flujo de Google, aquí no hay redirect de vuelta por /auth/callback — la
    // sesión ya quedó puesta, solo falta salir de /login (que no tiene guard de "ya autenticado").
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Local development only — not included in production builds
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dev_email" className="text-xs">
          Email
        </Label>
        <Input
          id="dev_email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dev_password" className="text-xs">
          Password
        </Label>
        <Input
          id="dev_password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button variant="outline" onClick={handleSignIn} disabled={isBusy} className="w-full">
        {isBusy ? 'Signing in…' : 'Sign in locally'}
      </Button>
    </div>
  )
}
