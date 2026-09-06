import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/suscripciones.md (CU-078 a CU-082). A diferencia del resto de
// los módulos, aquí no hay RPCs: los errores vienen de las CHECK de la migración o del índice único
// de nombre, así que la lista es corta.
export const SUBSCRIPTION_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_012: 'The amount must be a number greater than zero.',
  VALIDATION_040: 'You already have a subscription with this name.',
  VALIDATION_041: 'The end date must be on or after the start date.',
  BIZ_036: "That subscription doesn't exist or isn't yours.",
} as const

export type SubscriptionErrorCode = keyof typeof SUBSCRIPTION_ERROR_MESSAGES

// El nombre duplicado no llega como un código en el mensaje sino como violación del índice único
// `subscriptions_user_nombre_active_key`, que PostgREST reporta en `error.code` — mismo caso que
// Inversiones. Por eso esta función recibe el error completo y no solo su mensaje.
export function findSubscriptionErrorCode(
  error: { code?: string; message?: string } | null | undefined,
): SubscriptionErrorCode | null {
  if (!error) return null
  if (error.code === '23505') return 'VALIDATION_040'
  if (error.message?.includes('subscriptions_fecha_fin_valid')) return 'VALIDATION_041'
  if (!error.message) return null
  const code = (Object.keys(SUBSCRIPTION_ERROR_MESSAGES) as SubscriptionErrorCode[]).find((candidate) =>
    error.message!.includes(candidate),
  )
  return code ?? null
}
