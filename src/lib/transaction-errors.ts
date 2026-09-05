import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'
import { DEBT_ERROR_MESSAGES } from '@/lib/debt-errors'
import { SAVINGS_ERROR_MESSAGES } from '@/lib/savings-errors'

// Mensajes documentados en docs/pdr/transacciones.md (CU-013), traducidos a inglés — mismo
// tratamiento que account-errors.ts / category-errors.ts. AUTH_001 y SYS_001 se reutilizan tal
// cual, sin duplicar texto.
export const TRANSACTION_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_012: 'The amount must be a number greater than zero.',
  VALIDATION_014: 'The source and destination accounts must be different.',
  VALIDATION_015: "That type filter isn't valid.",
  VALIDATION_023: 'Select at least one transaction.',
  BIZ_009: "That category doesn't exist, isn't yours, is hidden, or doesn't match this movement type.",
  BIZ_010: "That account doesn't exist, isn't yours, or is archived.",
  BIZ_011: "The source or destination account doesn't exist, isn't yours, or is archived.",
  BIZ_012: 'Transfers are only allowed between debit or cash accounts.',
  BIZ_013: 'The destination account must be your own active credit card.',
  BIZ_014: "One or more selected transactions don't exist or aren't yours.",
  BIZ_015: "Balance adjustments can't be edited or deleted from this screen.",
  BIZ_022: "You can't change the account of a linked transaction (transfer or card payment) from a batch action.",
  // Ahorros y Metas (CU-047/CU-048) — el modal de transacciones también llama a
  // create_goal_contribution/create_goal_withdrawal, que pueden devolver estos dos códigos.
  BIZ_023: SAVINGS_ERROR_MESSAGES.BIZ_023,
  BIZ_025: SAVINGS_ERROR_MESSAGES.BIZ_025,
  // Créditos y Deudas (CU-060, RN-224) — editar un pago_deuda existente pasa por update_transaction,
  // que puede devolver estos códigos.
  VALIDATION_006: DEBT_ERROR_MESSAGES.VALIDATION_006,
  VALIDATION_035: DEBT_ERROR_MESSAGES.VALIDATION_035,
  BIZ_031: DEBT_ERROR_MESSAGES.BIZ_031,
  BIZ_033: DEBT_ERROR_MESSAGES.BIZ_033,
  // Meses Sin Intereses (MSI, sin PRD todavía — ver supabase/migrations/20260903100000_*) —
  // create_transaction/update_transaction devuelven estos códigos al capturar/editar el plan.
  VALIDATION_038: 'The number of months must be between 2 and 60.',
  BIZ_034: "Installment plans can only be set on an expense charged to a credit card.",
} as const

export type TransactionErrorCode = keyof typeof TRANSACTION_ERROR_MESSAGES

export function isTransactionErrorCode(value: string | null): value is TransactionErrorCode {
  return value !== null && value in TRANSACTION_ERROR_MESSAGES
}

/**
 * El RPC `create_transaction` devuelve el código como el mensaje completo de la excepción (ej.
 * `raise exception 'BIZ_009'`), pero Postgres/PostgREST pueden envolverlo con texto adicional — se
 * busca por coincidencia en vez de igualdad, mismo patrón que `findAccountErrorCodeInMessage`.
 */
export function findTransactionErrorCodeInMessage(
  message: string | null | undefined,
): TransactionErrorCode | null {
  if (!message) return null
  const code = (Object.keys(TRANSACTION_ERROR_MESSAGES) as TransactionErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
