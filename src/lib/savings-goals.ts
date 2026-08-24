import { differenceInCalendarMonths, parseISO } from 'date-fns'

export type SavingsGoalStatus = 'active' | 'archived'

export interface SavingsGoal {
  id: string
  user_id: string
  nombre: string
  emoji: string
  monto_objetivo: number
  monto_inicial: number
  fecha_limite: string | null
  status: SavingsGoalStatus
  created_at: string
  updated_at: string
}

export const DEFAULT_GOAL_EMOJI = '💰'

// RN-113 — calculado en tiempo de consulta, nunca persistido, mismo criterio que
// `computeAvailableCredit` de cuentas. El signo de `monto` está definido desde la perspectiva de la
// cuenta (aportación = negativo, retiro = positivo), por eso se resta en vez de sumar.
export function computeMontoAportadoActual(goal: SavingsGoal, movimientos: { monto: number }[]): number {
  const sumaConSigno = movimientos.reduce((sum, m) => sum + m.monto, 0)
  return goal.monto_inicial - sumaConSigno
}

// RN-114 — sin tope superior, puede superar 1 (100%) si el usuario sigue aportando tras alcanzar el objetivo.
export function computePercent(montoAportadoActual: number, montoObjetivo: number): number {
  if (montoObjetivo <= 0) return 0
  return montoAportadoActual / montoObjetivo
}

// RN-115 — el cálculo interno conserva el valor real (incluyendo negativo); solo la UI lo capa en $0.
export function computeMontoRestante(montoAportadoActual: number, montoObjetivo: number): number {
  return montoObjetivo - montoAportadoActual
}

// RN-116 — null si la meta no tiene fecha límite.
export function computeMonthsRemaining(fechaLimite: string | null): number | null {
  if (!fechaLimite) return null
  return Math.max(0, differenceInCalendarMonths(parseISO(fechaLimite), new Date()))
}
