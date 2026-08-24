// English copy for the error codes documented in docs/pdr/auth.md (CU-032 a CU-034), donde el
// texto original está en español — la app pasó a inglés como único idioma, así que el texto de
// aquí ya no es literal al de los documentos; los códigos (AUTH_001, etc.) siguen igual.
export const AUTH_ERROR_MESSAGES = {
  AUTH_001: 'Your session has expired. Please sign in again.',
  AUTH_002: "Your account doesn't have access to this app. Contact your administrator.",
  AUTH_003: "We couldn't complete sign-in with Google. Please try again.",
  SYS_001: 'Something went wrong. Please try again later.',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES

export function isAuthErrorCode(value: string | null): value is AuthErrorCode {
  return value !== null && value in AUTH_ERROR_MESSAGES
}

/**
 * El Custom Access Token Hook devuelve `message: 'AUTH_002'` (ver la migración de auth), y
 * Supabase lo propaga como el `.message` del error de `exchangeCodeForSession()` — no
 * necesariamente como el string exacto, así que se busca por coincidencia en vez de igualdad.
 */
export function findAuthErrorCodeInMessage(message: string | null | undefined): AuthErrorCode | null {
  if (!message) return null
  const code = (Object.keys(AUTH_ERROR_MESSAGES) as AuthErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}

/**
 * Resuelve qué error de auth mostrar en el login a partir de la URL actual:
 * - `?authError=AUTH_001`: convención propia para cuando una ruta protegida redirige aquí
 *   por sesión expirada (CU-034, mecanismo transversal — todavía sin guard de rutas).
 * - `error_description` en query o hash: Supabase Auth reenvía aquí el `message` que
 *   devuelve el Custom Access Token Hook al abortar la emisión (RN-098/102) — coincide
 *   literalmente con uno de nuestros códigos, ej. "AUTH_002".
 * - `error` genérico sin código propio: consentimiento cancelado o falla de comunicación
 *   con Google (flujo alterno de CU-032) → AUTH_003.
 */
export function resolveAuthErrorFromLocation(
  location: Pick<Location, 'search' | 'hash'>,
): AuthErrorCode | null {
  const params = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))

  const explicit = params.get('authError')
  if (isAuthErrorCode(explicit)) return explicit

  const description = params.get('error_description') ?? hashParams.get('error_description')
  if (isAuthErrorCode(description)) return description

  const providerError = params.get('error') ?? hashParams.get('error')
  if (providerError) return 'AUTH_003'

  return null
}
