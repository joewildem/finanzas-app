import { formatCurrency } from '@/lib/accounts'
import { cn } from '@/lib/utils'

// Estilos completos (no interpolados) para que Tailwind los detecte estáticamente en el build.
const CHIP_STYLES = {
  gray: { pill: 'bg-muted text-muted-foreground', fill: 'bg-muted-foreground/20' },
  amber: { pill: 'bg-warning/10 text-warning dark:bg-warning/20', fill: 'bg-warning/25' },
  red: { pill: 'bg-destructive/10 text-destructive dark:bg-destructive/20', fill: 'bg-destructive/25' },
  green: { pill: 'bg-success/10 text-success dark:bg-success/20', fill: 'bg-success/25' },
} as const

// Chip de "Available" a nivel categoría (CU-022, RN-112 a RN-117). Sin `assigned` (o
// `assigned <= 0`) y sin ningún movimiento real tampoco, no hay nada que mostrar — mismo criterio
// que el "—" ya usado para el % de grupo cuando el ingreso presupuestado es $0. En cualquier otro
// caso, cuatro estados:
// - `current` en $0 (RN-116): todavía no hay movimientos reales — gris, sin relleno.
// - `current` dentro del presupuesto: ámbar, relleno proporcional a `current / assigned`.
// - `current > assigned` (RN-113/RN-114), incluyendo el caso de una categoría sin monto asignado
//   pero con movimientos reales (RN-117 — `assigned = 0` se trata como "presupuesto agotado",
//   nunca como "sin datos"): en categorías de gasto (Outflow) es alerta roja con el número en
//   negativo (`assigned - current`); en categorías de Ingresos (Inflow) es una señal positiva
//   verde — y a diferencia del resto, el número también se vuelve positivo
//   (`current - assigned`, el excedente recibido) en vez de conservar el negativo.
export function AvailableChip({
  assigned,
  current,
  isIncome,
}: {
  assigned: number
  current: number
  isIncome: boolean
}) {
  const hasActivity = current > 0

  if (assigned <= 0 && !hasActivity) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const overBudget = current > assigned
  const color = !hasActivity ? 'gray' : overBudget ? (isIncome ? 'green' : 'red') : 'amber'
  const amount = overBudget && isIncome ? current - assigned : assigned - current
  const fillPercent = !hasActivity ? 0 : overBudget ? 100 : Math.min(current / assigned, 1) * 100
  const styles = CHIP_STYLES[color]

  return (
    <span
      className={cn(
        'relative inline-flex h-6 min-w-16 items-center justify-center overflow-hidden rounded-full px-2 text-xs font-medium',
        styles.pill,
      )}
    >
      <span className={cn('absolute inset-y-0 left-0', styles.fill)} style={{ width: `${fillPercent}%` }} />
      <span className="relative font-mono">{formatCurrency(amount)}</span>
    </span>
  )
}
