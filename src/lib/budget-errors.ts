import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/presupuesto.md (CU-019, CU-020), traducidos a inglés — mismo
// tratamiento que category-errors.ts. AUTH_001 y SYS_001 se reutilizan tal cual, sin duplicar texto.
export const BUDGET_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_016: "The amount can't be negative.",
  VALIDATION_017: 'The month must be in YYYY-MM format.',
  VALIDATION_019: "That reserved category value isn't valid.",
  BIZ_016: "That category doesn't exist, isn't yours, or isn't active.",
  BIZ_017: 'The destination month already has a budget. Confirm to overwrite it.',
  BIZ_018: "The source month doesn't have any budget to copy.",
} as const

export type BudgetErrorCode = keyof typeof BUDGET_ERROR_MESSAGES

export function isBudgetErrorCode(value: string | null): value is BudgetErrorCode {
  return value !== null && value in BUDGET_ERROR_MESSAGES
}

/**
 * `save_budgets` y `copy_budget_month` devuelven el código como el mensaje completo de la
 * excepción (ej. `raise exception 'BIZ_017'`), pero Postgres/PostgREST pueden envolverlo con texto
 * adicional — se busca por coincidencia en vez de igualdad, mismo patrón que
 * `findCategoryErrorCodeInMessage`.
 */
export function findBudgetErrorCodeInMessage(
  message: string | null | undefined,
): BudgetErrorCode | null {
  if (!message) return null
  const code = (Object.keys(BUDGET_ERROR_MESSAGES) as BudgetErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
