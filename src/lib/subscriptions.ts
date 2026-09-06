import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, format } from 'date-fns'

import { parseDate } from '@/lib/dates'

export type SubscriptionStatus = 'active' | 'archived'

export type SubscriptionCategory =
  | 'ai'
  | 'education'
  | 'entertainment'
  | 'finance'
  | 'fitness'
  | 'gaming'
  | 'music'
  | 'news'
  | 'other'
  | 'productivity'
  | 'shopping'
  | 'streaming'
  | 'travel'
  | 'utilities'

export type SubscriptionCycle =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'one_time'

export interface Subscription {
  id: string
  user_id: string
  nombre: string
  categoria: SubscriptionCategory
  sitio_web: string | null
  monto: number
  ciclo: SubscriptionCycle
  fecha_inicio: string
  fecha_fin: string | null
  es_prueba: boolean
  metodo_pago: string | null
  nota: string | null
  status: SubscriptionStatus
  archivada_en: string | null
  created_at: string
  updated_at: string
}

export const SUBSCRIPTION_CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  ai: 'AI',
  education: 'Education',
  entertainment: 'Entertainment',
  finance: 'Finance',
  fitness: 'Fitness',
  gaming: 'Gaming',
  music: 'Music',
  news: 'News',
  other: 'Other',
  productivity: 'Productivity',
  shopping: 'Shopping',
  streaming: 'Streaming',
  travel: 'Travel',
  utilities: 'Utilities',
}

// Un color fijo por categoría, no asignado por posición como en `networth.ts`: aquí el conjunto de
// categorías es cerrado, así que una categoría conserva su color aunque cambie qué categorías
// tienen gasto en el mes visible.
export const SUBSCRIPTION_CATEGORY_COLORS: Record<SubscriptionCategory, string> = {
  ai: '#8b5cf6',
  education: '#0ea5e9',
  entertainment: '#f43f5e',
  finance: '#10b981',
  fitness: '#84cc16',
  gaming: '#a855f7',
  music: '#ec4899',
  news: '#64748b',
  other: '#94a3b8',
  productivity: '#3b82f6',
  shopping: '#f59e0b',
  streaming: '#ef4444',
  travel: '#06b6d4',
  utilities: '#78716c',
}

export const SUBSCRIPTION_CATEGORIES = Object.keys(SUBSCRIPTION_CATEGORY_LABELS) as SubscriptionCategory[]

export const SUBSCRIPTION_CYCLE_LABELS: Record<SubscriptionCycle, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semiannual',
  annual: 'Annual',
  one_time: 'One-time',
}

// Sufijo compacto para las cards ("$139.00/mo"). `one_time` no lleva sufijo de periodo porque no
// hay periodo que repetir.
export const SUBSCRIPTION_CYCLE_SUFFIX: Record<SubscriptionCycle, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  quarterly: '/qtr',
  semiannual: '/6mo',
  annual: '/yr',
  one_time: '',
}

export const SUBSCRIPTION_CYCLES = Object.keys(SUBSCRIPTION_CYCLE_LABELS) as SubscriptionCycle[]

// Cuántos meses avanza cada paso de un ciclo mensual-o-mayor. Los ciclos por día y por semana no
// están aquí porque no se pueden expresar en meses sin perder el día exacto.
const CYCLE_STEP_MONTHS: Record<'monthly' | 'quarterly' | 'semiannual' | 'annual', number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

// Tope de seguridad del generador de ocurrencias: la ventana más grande que consulta la aplicación
// es un año, y un ciclo diario produce 366 cobros en ese lapso.
const MAX_OCCURRENCES = 800

// Hasta cuándo cobra una suscripción. `fecha_fin` es la fecha que el usuario conocía de antemano;
// `archivada_en` es el corte que deja el archivado. Manda la más temprana de las dos: archivar en
// junio deja de contarla de julio en adelante, pero enero a junio la siguen mostrando — archivar no
// puede borrar dinero que sí se pagó de las gráficas históricas.
export function computeCutoff(sub: Subscription): Date | null {
  const fin = sub.fecha_fin ? parseDate(sub.fecha_fin) : null
  const archivada = sub.archivada_en ? parseDate(sub.archivada_en) : null
  if (fin && archivada) return fin < archivada ? fin : archivada
  return fin ?? archivada
}

// La i-ésima fecha de cobro, contada siempre desde `fecha_inicio` y no desde la ocurrencia
// anterior. Esa es la diferencia que hace que una mensual iniciada un 31 caiga el 28 en febrero y
// vuelva al 31 en marzo: `addMonths` recorta al último día del mes, y anclar al inicio evita que
// ese recorte se arrastre hacia adelante.
function occurrenceAt(sub: Subscription, index: number): Date {
  const start = parseDate(sub.fecha_inicio)
  switch (sub.ciclo) {
    case 'one_time':
      return start
    case 'daily':
      return addDays(start, index)
    case 'weekly':
      return addDays(start, index * 7)
    default:
      return addMonths(start, index * CYCLE_STEP_MONTHS[sub.ciclo])
  }
}

// Índice aproximado del primer cobro que cae en o después de `from`. Es una estimación a la baja
// —quien la usa arranca un paso antes— para no recorrer desde el inicio de una suscripción vieja
// cada vez que se pinta un mes.
function estimateIndexAt(sub: Subscription, from: Date): number {
  if (sub.ciclo === 'one_time') return 0
  const start = parseDate(sub.fecha_inicio)
  const days = differenceInCalendarDays(from, start)
  if (days <= 0) return 0
  if (sub.ciclo === 'daily') return days
  if (sub.ciclo === 'weekly') return Math.floor(days / 7)
  const months = differenceInCalendarMonths(from, start)
  return Math.max(0, Math.floor(months / CYCLE_STEP_MONTHS[sub.ciclo]))
}

// Fechas de cobro dentro de [from, to], ambos inclusive. Se calculan al vuelo y nunca se
// almacenan — mismo criterio que el resto de la aplicación con los datos derivados.
export function computeOccurrences(sub: Subscription, from: Date, to: Date): Date[] {
  const start = parseDate(sub.fecha_inicio)
  const cutoff = computeCutoff(sub)
  const last = cutoff && cutoff < to ? cutoff : to
  if (start > last) return []

  const occurrences: Date[] = []
  let index = Math.max(0, estimateIndexAt(sub, from) - 1)

  for (let guard = 0; guard < MAX_OCCURRENCES; guard++) {
    const date = occurrenceAt(sub, index)
    if (date > last) break
    if (date >= from && date >= start) occurrences.push(date)
    if (sub.ciclo === 'one_time') break
    index++
  }

  return occurrences
}

export function computeChargedInRange(subs: Subscription[], from: Date, to: Date): number {
  return subs.reduce((sum, sub) => sum + computeOccurrences(sub, from, to).length * sub.monto, 0)
}

// Costo mensual equivalente: el total anual entre doce. Responde "¿cuánto me cuestan realmente mis
// suscripciones?", que es distinto de "¿cuánto me cobran este mes?" — una anual de $9,774.50 aporta
// $814.54 a este promedio aunque en septiembre no cobre nada.
//
// `one_time` vale cero: un pago único no se repite, así que no tiene costo mensual equivalente. Sí
// cuenta, en cambio, en el mes en que efectivamente cae.
export function computeMonthlyNormalized(sub: Subscription): number {
  switch (sub.ciclo) {
    case 'daily':
      return (sub.monto * 365) / 12
    case 'weekly':
      return (sub.monto * 52) / 12
    case 'monthly':
      return sub.monto
    case 'quarterly':
      return sub.monto / 3
    case 'semiannual':
      return sub.monto / 6
    case 'annual':
      return sub.monto / 12
    case 'one_time':
      return 0
  }
}

export function computeAnnualized(sub: Subscription): number {
  return computeMonthlyNormalized(sub) * 12
}

// El dominio desnudo a partir de lo que el usuario haya escrito en "Website": acepta
// "https://www.netflix.com/mx", "netflix.com" o "www.netflix.com" y devuelve "netflix.com", que es
// lo que espera la URL de logo. Devuelve null si no hay algo que parezca un dominio.
export function extractDomain(website: string | null): string | null {
  if (!website) return null
  const trimmed = website.trim().toLowerCase()
  if (!trimmed) return null
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const host = withoutScheme.split('/')[0].split('?')[0].split('#')[0].replace(/^www\./, '')
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return null
  return host
}

// Si la suscripción está viva en algún punto del rango: empezó antes de que terminara y su corte
// —fecha de fin o archivado— no había llegado cuando empezó. Es lo que decide quién aparece en el
// listado y en el conteo de activas del mes visible, de modo que navegar a enero muestre lo que
// estaba vivo en enero y no lo que está vivo hoy.
export function isLiveInRange(sub: Subscription, from: Date, to: Date): boolean {
  const start = parseDate(sub.fecha_inicio)
  if (start > to) return false
  const cutoff = computeCutoff(sub)
  return cutoff === null || cutoff >= from
}

// --- Cobros pagados -------------------------------------------------------

// Un cobro se identifica por la suscripción y su fecha, no por el mes: una semanal tiene cuatro
// cargos en un mes y "pagada en septiembre" no diría cuál. Esta llave es la misma que la restricción
// única de `subscription_payments`.
export function chargeKey(subscriptionId: string, fecha: Date): string {
  return `${subscriptionId}|${format(fecha, 'yyyy-MM-dd')}`
}

export interface MonthStatus {
  /** Todas las fechas de cobro de la suscripción dentro del mes. */
  charges: Date[]
  /** Las que aún no se han marcado como pagadas, en orden. */
  pending: Date[]
  /** Lo que falta pagar de esta suscripción en el mes. */
  pendingAmount: number
  /** La siguiente por pagar, o null si ya no queda ninguna. */
  next: Date | null
}

export function computeMonthStatus(
  sub: Subscription,
  from: Date,
  to: Date,
  paid: ReadonlySet<string>,
): MonthStatus {
  const charges = computeOccurrences(sub, from, to)
  const pending = charges.filter((fecha) => !paid.has(chargeKey(sub.id, fecha)))
  return {
    charges,
    pending,
    pendingAmount: pending.length * sub.monto,
    next: pending[0] ?? null,
  }
}

// "Hoy" y "Mañana" se leen más rápido que una fecha cuando el cobro es inminente, que es justo
// cuando importa alcanzar a cancelar. Hacia atrás la fecha sola basta: ya pasó.
export function relativeDayLabel(fecha: Date, today: Date): string | null {
  const days = differenceInCalendarDays(fecha, today)
  if (days < 0) return null
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// La siguiente fecha de cobro a partir de hoy, mirando hasta un año adelante. Alimenta la columna
// "Next due" del listado completo, donde una suscripción puede no cobrar en el mes visible.
export function computeNextCharge(sub: Subscription, today: Date): Date | null {
  const [next] = computeOccurrences(sub, today, addDays(today, 366))
  return next ?? null
}
