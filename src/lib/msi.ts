import { addMonths, differenceInCalendarMonths, format, parseISO, startOfMonth } from 'date-fns'

// Planes típicos de MSI en tarjetas mexicanas — catálogo cerrado en el selector del modal de
// transacciones, pero el rango real aceptado por la base de datos es más amplio (2-60, ver
// migración) por si el usuario necesita capturar un plan fuera de lo común.
export const MSI_MONTH_OPTIONS = [3, 6, 9, 12, 15, 18, 24] as const

// Un plan a meses sin intereses es un movimiento de tipo `compra_msi` sobre una tarjeta de crédito.
// No lleva categoría a propósito: es lo que lo mantiene fuera de todo reporte de gasto por categoría
// sin depender de que cada consulta recuerde excluirlo (ver la migración 20260904100000).
//
// `fecha` es el día de la compra; `mesInicio` es el mes de la primera parcialidad, que no siempre es
// el mismo — comprar después de la fecha de corte empuja el plan al mes siguiente. Todo el calendario
// se deriva de `mesInicio`, nunca de `fecha`.
export interface MsiPlan {
  id: string
  accountId: string
  accountNombre: string
  concepto: string
  monto: number
  meses: number
  fecha: string
  mesInicio: string
  /** Mes en que se liquidó por adelantado, si se hizo. Ver computeInstallmentSchedule. */
  liquidadoMes: string | null
  nota: string | null
}

export type MsiStatus = 'upcoming' | 'active' | 'completed'

// Índice 1-based del mes dentro del plan (1..meses) para el mes dado ('yyyy-MM'), o null si ese mes
// cae fuera de la ventana [mesInicio, mesInicio + meses) — o si el plan ya se liquidó antes de él,
// caso en el que deja de aparecer en Presupuesto porque ya no se debe nada.
export function computeMsiMonthIndex(
  plan: Pick<MsiPlan, 'mesInicio' | 'meses' | 'liquidadoMes'>,
  mes: string,
): number | null {
  const diff = differenceInCalendarMonths(parseISO(`${mes}-01`), parseISO(`${plan.mesInicio}-01`))
  if (diff < 0 || diff >= plan.meses) return null
  if (plan.liquidadoMes && mes > plan.liquidadoMes) return null
  return diff + 1
}

export function computeMsiStatus(
  plan: Pick<MsiPlan, 'mesInicio' | 'meses' | 'liquidadoMes'>,
  mes: string,
): MsiStatus {
  if (plan.liquidadoMes && mes > plan.liquidadoMes) return 'completed'
  const diff = differenceInCalendarMonths(parseISO(`${mes}-01`), parseISO(`${plan.mesInicio}-01`))
  if (diff < 0) return 'upcoming'
  if (diff >= plan.meses) return 'completed'
  return 'active'
}

// Mensualidad nominal — monto total entre meses, redondeada a centavos. Sirve como cifra "de
// cabecera"; para cuadrar contra el total de la compra usar `computeInstallmentSchedule`, donde la
// última mensualidad absorbe el redondeo.
export function computeMonthlyInstallment(plan: Pick<MsiPlan, 'monto' | 'meses'>): number {
  return Math.round((Math.abs(plan.monto) / plan.meses) * 100) / 100
}

export interface MsiInstallment {
  /** 1-based, como lo numera un estado de cuenta ("3 de 18"). */
  index: number
  mes: string
  monto: number
  /**
   * `normal` — mensualidad de calendario.
   * `settlement` — el mes en que se liquidó: concentra lo que faltaba, así que vale más que una.
   * `settled` — parcialidad que ya no se paga porque la liquidación la absorbió.
   */
  status: 'normal' | 'settlement' | 'settled'
}

// Calendario completo del plan. Todas las mensualidades valen igual salvo la última, que absorbe la
// diferencia de redondeo: $10,000 a 12 meses da $833.33, y doce veces eso son $9,999.96 — sin este
// ajuste la tabla no sumaría el monto de la compra y dejaría de ser confiable.
//
// Si el plan se liquidó (`liquidadoMes`), ese mes absorbe todo lo que quedaba pendiente y los
// posteriores se quedan en cero. La suma del calendario sigue siendo el monto de la compra: liquidar
// no perdona deuda, solo la adelanta.
export function computeInstallmentSchedule(
  plan: Pick<MsiPlan, 'monto' | 'meses' | 'mesInicio' | 'liquidadoMes'>,
): MsiInstallment[] {
  const total = Math.abs(plan.monto)
  const base = Math.round((total / plan.meses) * 100) / 100
  const start = startOfMonth(parseISO(`${plan.mesInicio}-01`))

  const schedule: MsiInstallment[] = Array.from({ length: plan.meses }, (_, i) => ({
    index: i + 1,
    mes: format(addMonths(start, i), 'yyyy-MM'),
    monto: i === plan.meses - 1 ? Math.round((total - base * (plan.meses - 1)) * 100) / 100 : base,
    status: 'normal' as const,
  }))

  const liquidado = plan.liquidadoMes
  if (!liquidado) return schedule

  const pendiente = schedule
    .filter((cuota) => cuota.mes >= liquidado)
    .reduce((sum, cuota) => sum + cuota.monto, 0)

  return schedule.map((cuota) => {
    if (cuota.mes < liquidado) return cuota
    if (cuota.mes === liquidado) {
      return { ...cuota, monto: Math.round(pendiente * 100) / 100, status: 'settlement' as const }
    }
    return { ...cuota, monto: 0, status: 'settled' as const }
  })
}

// Mensualidad que el banco carga en un mes dado, o null si el plan no corre ese mes. Es el "real"
// del renglón de MSI en Presupuesto: a diferencia de un pago a tarjeta (un monto único que no dice
// a qué plan corresponde), el cargo de la mensualidad es un hecho cierto derivable del calendario.
export function computeInstallmentForMonth(
  plan: Pick<MsiPlan, 'monto' | 'meses' | 'mesInicio' | 'liquidadoMes'>,
  mes: string,
): number | null {
  return computeInstallmentSchedule(plan).find((entry) => entry.mes === mes)?.monto ?? null
}

// Cuánto lleva cargado el plan hasta el mes dado (inclusive) — el acumulado de la tabla de
// amortización.
export function computeChargedThrough(
  plan: Pick<MsiPlan, 'monto' | 'meses' | 'mesInicio' | 'liquidadoMes'>,
  mes: string,
): { monto: number; mensualidades: number } {
  const charged = computeInstallmentSchedule(plan).filter((entry) => entry.mes <= mes)
  return {
    monto: Math.round(charged.reduce((sum, entry) => sum + entry.monto, 0) * 100) / 100,
    // Las parcialidades que la liquidación absorbió no se cuentan como cargos aparte: ya vinieron
    // dentro del monto del mes de liquidación.
    mensualidades: charged.filter((entry) => entry.status !== 'settled').length,
  }
}
