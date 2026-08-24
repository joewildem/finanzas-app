import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/ahorros.md (CU-042 a CU-048), traducidos a inglés — mismo
// tratamiento que category-errors.ts/budget-errors.ts. AUTH_001 y SYS_001 se reutilizan tal cual.
export const SAVINGS_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_006: 'Amount cannot be negative.',
  VALIDATION_012: 'The amount must be a number greater than zero.',
  VALIDATION_024: 'The target date must be today or a future date.',
  VALIDATION_025: "That emoji isn't valid.",
  VALIDATION_026: 'You already have a goal with this name.',
  BIZ_010: "That account doesn't exist, isn't yours, or is archived.",
  BIZ_023: "That goal doesn't exist, isn't yours, or is archived.",
  BIZ_024: 'This goal is already archived.',
  BIZ_025: "The withdrawal amount can't be more than what's available in this goal.",
  BIZ_026: "That goal couldn't be found.",
} as const

export type SavingsErrorCode = keyof typeof SAVINGS_ERROR_MESSAGES

export function isSavingsErrorCode(value: string | null): value is SavingsErrorCode {
  return value !== null && value in SAVINGS_ERROR_MESSAGES
}

/**
 * Los RPCs de este módulo (create_goal_contribution, create_goal_withdrawal, update_transaction)
 * devuelven el código como el mensaje completo de la excepción, pero Postgres/PostgREST pueden
 * envolverlo con texto adicional — se busca por coincidencia en vez de igualdad, mismo patrón que
 * `findCategoryErrorCodeInMessage`.
 */
export function findSavingsErrorCodeInMessage(
  message: string | null | undefined,
): SavingsErrorCode | null {
  if (!message) return null
  const code = (Object.keys(SAVINGS_ERROR_MESSAGES) as SavingsErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
