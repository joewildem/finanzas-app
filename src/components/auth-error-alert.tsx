import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from '@/lib/auth-errors'

// Banner reutilizable para los 4 mensajes de error de docs/pdr/auth.md (AUTH_001, AUTH_002,
// AUTH_003, SYS_001) — un único componente en vez de un alert distinto por caso.
export function AuthErrorAlert({ code }: { code: AuthErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{AUTH_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
