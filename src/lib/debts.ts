import { differenceInCalendarMonths, parseISO } from 'date-fns'
import type { IconSvgElement } from '@hugeicons/react'
import { Car01Icon, DollarCircleIcon, HandshakeIcon, Home01Icon } from '@hugeicons/core-free-icons'

export type DebtType = 'auto' | 'hipoteca' | 'personal' | 'otro'
export type DebtStatus = 'active' | 'archived'

export interface Debt {
  id: string
  user_id: string
  nombre: string
  tipo: DebtType
  monto_original: number
  tasa_interes: number
  pago_mensual_esperado: number | null
  dia_pago: number | null
  fecha_liquidacion_estimada: string | null
  status: DebtStatus
  created_at: string
  updated_at: string
}

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  auto: 'Auto loan',
  hipoteca: 'Mortgage',
  personal: 'Personal loan',
  otro: 'Other',
}

export const DEBT_TYPE_ICONS: Record<DebtType, IconSvgElement> = {
  auto: Car01Icon,
  hipoteca: Home01Icon,
  personal: HandshakeIcon,
  otro: DollarCircleIcon,
}

// RN-202 — calculado en tiempo de consulta, nunca persistido: el saldo solo baja por la porción de
// capital de cada pago (pago_deuda) — el interés es el costo del financiamiento, no una reducción
// de lo adeudado (RN-216).
export function computeSaldoActual(debt: Debt, capitalPagos: number[]): number {
  const totalCapital = capitalPagos.reduce((sum, c) => sum + c, 0)
  return debt.monto_original - totalCapital
}

// RN-203 — sin tope, mismo criterio que computePercent de savings-goals (un pago de más dejaría el
// saldo en negativo, lo cual ya está bloqueado por RN-221/BIZ_033 al capturar el pago).
export function computePercentPagado(saldoActual: number, montoOriginal: number): number {
  if (montoOriginal <= 0) return 0
  return (montoOriginal - saldoActual) / montoOriginal
}

// No documentado explícitamente en el PRD (RN-205 solo pide ordenar por esta fecha) — dato
// puramente informativo, mismo criterio que computeMonthsRemaining de savings-goals.ts.
export function computeMonthsRemaining(fechaLiquidacionEstimada: string | null): number | null {
  if (!fechaLiquidacionEstimada) return null
  return Math.max(0, differenceInCalendarMonths(parseISO(fechaLiquidacionEstimada), new Date()))
}
