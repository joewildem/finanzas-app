import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/cuentas.md (CU-001 a CU-006), traducidos a inglés — mismo
// tratamiento que auth-errors.ts. AUTH_001 y SYS_001 se reutilizan tal cual, sin duplicar texto.
export const ACCOUNT_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_002: 'You already have an account with this name.',
  VALIDATION_003: 'Initial balance cannot be negative for this account type.',
  VALIDATION_005: 'Day must be between 1 and 31.',
  VALIDATION_006: 'Amount cannot be negative.',
  VALIDATION_008: 'Enter a valid hex color (e.g. #RRGGBB).',
  BIZ_001: "We couldn't process the image, but your account was saved.",
  BIZ_002: 'Account not found.',
  BIZ_003: 'This account is already archived.',
  BIZ_004: 'Archived accounts cannot be adjusted. Reactivate it first.',
} as const

export type AccountErrorCode = keyof typeof ACCOUNT_ERROR_MESSAGES

export function isAccountErrorCode(value: string | null): value is AccountErrorCode {
  return value !== null && value in ACCOUNT_ERROR_MESSAGES
}

/**
 * El RPC `adjust_account_balance` (y las políticas RLS) devuelven el código como el mensaje
 * completo de la excepción (ej. `raise exception 'BIZ_004'`), pero Postgres/PostgREST pueden
 * envolverlo con texto adicional — se busca por coincidencia en vez de igualdad, mismo patrón que
 * `findAuthErrorCodeInMessage`.
 */
export function findAccountErrorCodeInMessage(
  message: string | null | undefined,
): AccountErrorCode | null {
  if (!message) return null
  const code = (Object.keys(ACCOUNT_ERROR_MESSAGES) as AccountErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
