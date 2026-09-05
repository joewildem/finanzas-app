import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { GalleryVerticalEndIcon } from '@hugeicons/core-free-icons'

import { AuthErrorAlert } from '@/components/auth-error-alert'
import { DevSignInPanel } from '@/components/dev-sign-in-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveAuthErrorFromLocation, type AuthErrorCode } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'
import loginBackground from '@/assets/login/login-background.png'
import googleIcon from '@/assets/login/google-icon.svg'

// CU-032 — Iniciar sesión con Google: única opción de ingreso en producción, sin correo/contraseña.
// DevSignInPanel es la excepción del ambiente local (Supabase en Docker, sin OAuth configurado) y va
// detrás de `import.meta.env.DEV`, que Vite sustituye por `false` al compilar producción — el
// componente entero queda sin referencias y se elimina del bundle publicado.
export function LoginPage() {
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    const code = resolveAuthErrorFromLocation(window.location)
    if (code) {
      setErrorCode(code)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleGoogleSignIn() {
    setErrorCode(null)
    setIsRedirecting(true)

    // Sin endpoint REST propio (CU-032) — Supabase Auth maneja el flujo de OAuth completo.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setErrorCode('SYS_001')
      setIsRedirecting(false)
    }
    // Si no hay error, el navegador ya está redirigiendo a Google — no hay más estado que setear.
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-4">
      <img
        src={loginBackground}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover opacity-15 mix-blend-screen"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-brand">
            <HugeiconsIcon icon={GalleryVerticalEndIcon} className="size-4 text-brand-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">Finanzas App</span>
        </div>

        <Card className="w-full">
          <CardHeader className="items-center gap-2 text-center">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription>Sign in with your Google account</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AuthErrorAlert code={errorCode} />
            <Button
              onClick={handleGoogleSignIn}
              disabled={isRedirecting}
              className="w-full border-brand-foreground bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <img src={googleIcon} alt="" className="size-4" />
              {isRedirecting ? 'Redirecting…' : 'Continue with Google'}
            </Button>

            {import.meta.env.DEV && <DevSignInPanel />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
