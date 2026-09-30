import { addMonths, format, getDaysInMonth, setDate, startOfMonth } from 'date-fns'

// Vocabulario de ciclos de corte de una tarjeta de crédito, compartido por el Dashboard y por el
// detalle de la tarjeta. Vive aparte porque de aquí salen DOS ejes distintos para el mismo gasto, y
// confundirlos es el error que esto viene a corregir:
//
//   · mes de CIERRE  — en qué mes cerró el periodo donde cayó el gasto ("¿cuánto gasté?")
//   · mes de PAGO    — en qué mes vence ese periodo ("¿cuánto tengo que pagar?")
//
// Con un corte el 16 y un día de pago el 6, lo gastado entre el 16 de agosto y el 15 de septiembre
// cierra en SEPTIEMBRE y se paga en OCTUBRE. Son el mismo dinero bajo dos preguntas distintas.

// RN-236 — recorta el día al último del mes de referencia si ahí no existe (ej. 31 en febrero).
function dayInMonth(monthReference: Date, dia: number): Date {
  const daysInMonth = getDaysInMonth(monthReference)
  return setDate(startOfMonth(monthReference), Math.min(dia, daysInMonth))
}

export interface StatementCycle {
  from: Date
  toExclusive: Date
}

// RN-236 — ciclo de corte en curso a partir de `dia_corte`: si hoy >= día de corte de este mes, el
// ciclo va de ese día al mismo día del próximo mes; si no, del mes anterior a este mes.
export function computeCurrentStatementCycle(diaCorte: number, today: Date = new Date()): StatementCycle {
  const thisMonthCutoff = dayInMonth(today, diaCorte)
  if (today >= thisMonthCutoff) {
    return { from: thisMonthCutoff, toExclusive: dayInMonth(addMonths(today, 1), diaCorte) }
  }
  return { from: dayInMonth(addMonths(today, -1), diaCorte), toExclusive: thisMonthCutoff }
}

// El corte que CIERRA el periodo donde cae una fecha: el primer día de corte posterior a ella. Un
// gasto hecho el día del corte ya pertenece al periodo siguiente, mismo criterio que el intervalo
// semiabierto de `computeCurrentStatementCycle`.
export function statementCutoffFor(fecha: Date, diaCorte: number): Date {
  const thisMonth = dayInMonth(fecha, diaCorte)
  return fecha < thisMonth ? thisMonth : dayInMonth(addMonths(fecha, 1), diaCorte)
}

// El corte más reciente que ya ocurrió a una fecha dada. Es el espejo del anterior y sirve para
// los pagos: un abono hecho el 3 de octubre salda el periodo que cerró el 16 de septiembre.
export function lastStatementCutoffAt(fecha: Date, diaCorte: number): Date {
  const thisMonth = dayInMonth(fecha, diaCorte)
  return fecha >= thisMonth ? thisMonth : dayInMonth(addMonths(fecha, -1), diaCorte)
}

// Cuándo vence un corte: el primer día de pago posterior a él. No es "siempre el mes siguiente" —
// eso solo es cierto cuando el día de pago cae antes que el de corte, como en las tarjetas del
// usuario (corte 16, pago 6). Con corte 5 y pago 25, el mismo periodo vence en su propio mes.
export function dueDateFor(cutoff: Date, diaPago: number): Date {
  const sameMonth = dayInMonth(cutoff, diaPago)
  return cutoff < sameMonth ? sameMonth : dayInMonth(addMonths(cutoff, 1), diaPago)
}

const MONTH_KEY = 'yyyy-MM'

// Mes en que cierra el periodo de un gasto — el eje de "¿cuánto gasté?" (gráfica de uso mensual).
export function statementMonthOf(fecha: Date, diaCorte: number): string {
  return format(statementCutoffFor(fecha, diaCorte), MONTH_KEY)
}

// Mes en que se paga el periodo de un gasto — el eje de "¿cuánto debo pagar?" (calendario de pagos).
export function paymentMonthOf(fecha: Date, diaCorte: number, diaPago: number): string {
  return format(dueDateFor(statementCutoffFor(fecha, diaCorte), diaPago), MONTH_KEY)
}

// Mes al que se aplica un abono: aquel cuya VENTANA DE PAGO lo contiene. Con corte el 16 y pago el
// 6, el periodo que cierra el 16 de septiembre se paga entre esa fecha y el 6 de octubre, así que
// cualquier abono hecho del 16 de septiembre al 15 de octubre lo salda a él — sea puntual o unos
// días tarde. Solo a partir del 16 de octubre el abono pasa a contar para el periodo siguiente.
//
// Deliberadamente NO se reparte el abono sobre saldos viejos pendientes: la tarjeta se gestiona por
// periodo, y ver un pago hecho en octubre aterrizar en el mes anterior sería impredecible para
// quien lo capturó.
export function paymentAppliesToMonth(fecha: Date, diaCorte: number, diaPago: number): string {
  return format(dueDateFor(lastStatementCutoffAt(fecha, diaCorte), diaPago), MONTH_KEY)
}
