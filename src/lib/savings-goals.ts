import { differenceInCalendarDays, differenceInCalendarMonths, parseISO } from 'date-fns'

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

export interface SavingsPace {
  daysRemaining: number
  perDay: number
  perWeek: number
  perMonth: number
}

// Ritmo necesario para llegar al objetivo en la fecha límite: lo que falta repartido entre los días
// que quedan. Es una guía de seguimiento y nada más — no toca transacciones, presupuesto ni el
// avance de la meta, y se recorre sola conforme pasan los días, así que el número de hoy no es el
// de mañana.
//
// La semana son 7 días y el mes 30, literal: no es el promedio real de un mes (30.44) ni el conteo
// de calendario. El valor de una cifra de referencia está en que el usuario pueda rehacerla de
// cabeza, y "por día por 30" cumple eso mientras que 30.44 no.
//
// Devuelve null cuando no hay fecha límite o cuando ya no quedan días: repartir entre cero no
// significa nada, y forzar un número ahí sería inventarlo.
export function computeSavingsPace(
  montoRestante: number,
  fechaLimite: string | null,
  today: Date = new Date(),
): SavingsPace | null {
  if (!fechaLimite) return null
  const daysRemaining = differenceInCalendarDays(parseISO(fechaLimite), today)
  if (daysRemaining <= 0) return null
  // El restante puede venir negativo si la meta ya se superó; ahí lo que falta ahorrar es cero.
  const perDay = Math.max(0, montoRestante) / daysRemaining
  return { daysRemaining, perDay, perWeek: perDay * 7, perMonth: perDay * 30 }
}
