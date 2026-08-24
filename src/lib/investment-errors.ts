import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/inversiones.md (CU-049 a CU-054), traducidos a inglés — mismo
// tratamiento que savings-errors.ts/category-errors.ts. AUTH_001 y SYS_001 se reutilizan tal cual.
export const INVESTMENT_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_006: 'Amount cannot be negative.',
  VALIDATION_027: 'You already have an instrument with that ticker.',
  VALIDATION_028: 'The percentage must be a number between 0 and 100.',
  VALIDATION_029: 'Active instruments must add up to exactly 100%.',
  VALIDATION_030: 'An active instrument must have a target percentage greater than zero.',
  VALIDATION_031: "That asset group isn't valid.",
  VALIDATION_032: "That asset type isn't valid.",
  BIZ_027: "That instrument couldn't be found.",
  BIZ_028: "One or more instruments in the portfolio don't exist or aren't yours. Nothing was saved.",
  BIZ_029: 'Set up your portfolio first: you need active instruments whose target allocation adds up to 100%.',
  BIZ_030: 'Only inactive instruments can be deleted. Deactivate it first from the portfolio configuration.',
} as const

export type InvestmentErrorCode = keyof typeof INVESTMENT_ERROR_MESSAGES

export function isInvestmentErrorCode(value: string | null): value is InvestmentErrorCode {
  return value !== null && value in INVESTMENT_ERROR_MESSAGES
}

// A diferencia de findSavingsErrorCodeInMessage, este módulo tiene dos fuentes de error distintas:
// el RPC save_portfolio_config levanta excepciones con el código embebido como texto plano (mismo
// patrón de siempre, se busca por substring), pero el conflicto de ticker duplicado en alta/edición
// (CU-049/CU-051, sin RPC) llega como una violación de índice único de Postgres — sin el string
// VALIDATION_027 en ningún lado, se detecta por el SQLSTATE `23505` en `error.code`. Los callers
// deben pasar el objeto de error completo de Supabase, no solo `.message`.
export function findInvestmentErrorCodeInMessage(
  error: { message?: string | null; code?: string | null } | string | null | undefined,
): InvestmentErrorCode | null {
  if (!error) return null
  if (typeof error === 'object' && error.code === '23505') return 'VALIDATION_027'

  const message = typeof error === 'string' ? error : error.message
  if (!message) return null
  const code = (Object.keys(INVESTMENT_ERROR_MESSAGES) as InvestmentErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
