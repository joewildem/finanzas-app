import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/creditos-deudas.md (CU-055 a CU-060), traducidos a inglés —
// mismo tratamiento que savings-errors.ts/investment-errors.ts. AUTH_001 y SYS_001 se reutilizan
// tal cual.
export const DEBT_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_004: "That status filter isn't valid.",
  VALIDATION_005: 'Day must be between 1 and 31.',
  VALIDATION_006: 'Amount cannot be negative.',
  VALIDATION_012: 'The amount must be a number greater than zero.',
  VALIDATION_033: 'You already have a debt with this name.',
  VALIDATION_034: "That debt type isn't valid.",
  VALIDATION_035: 'Principal and interest must add up to the total payment amount.',
  BIZ_010: "That account doesn't exist, isn't yours, or is archived.",
  BIZ_031: "That debt doesn't exist, isn't yours, or is archived.",
  BIZ_032: 'This debt is already archived.',
  BIZ_033: "The principal amount can't be more than this debt's current balance.",
} as const

export type DebtErrorCode = keyof typeof DEBT_ERROR_MESSAGES

export function isDebtErrorCode(value: string | null): value is DebtErrorCode {
  return value !== null && value in DEBT_ERROR_MESSAGES
}

/**
 * Los RPCs de este módulo (create_debt_payment, update_transaction) y las CHECK constraints
 * devuelven el código como el mensaje completo de la excepción, pero Postgres/PostgREST pueden
 * envolverlo con texto adicional — se busca por coincidencia en vez de igualdad, mismo patrón que
 * `findSavingsErrorCodeInMessage`. La unicidad de `nombre` se valida antes en el cliente (mismo
 * criterio que Ahorros), así que no hace falta detectar `error.code === '23505'` como en Inversiones.
 */
export function findDebtErrorCodeInMessage(
  message: string | null | undefined,
): DebtErrorCode | null {
  if (!message) return null
  const code = (Object.keys(DEBT_ERROR_MESSAGES) as DebtErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
