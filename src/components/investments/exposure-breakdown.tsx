import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import type { ExposureBreakdownRow } from '@/lib/investments'
import { formatPercent } from '@/lib/utils'

// Un segmento por debajo de este ancho desaparece visualmente y deja un hueco entre sus vecinos.
const MIN_SEGMENT_PERCENT = 1.2

// RN-151 — desglose de exposición por grupo/tipo de activo sobre el total general, de solo lectura,
// sin librería de gráficas nueva (mismo criterio que GoalProgressRing).
//
// Una sola barra apilada en vez de una barra por categoría: el reparto es lo que se quiere leer, y
// con barras separadas hay que compararlas de a dos con la vista. Debajo, la leyenda con el punto de
// color hace de puente entre el segmento y su nombre.
export function ExposureBreakdown({ title, rows }: { title: string; rows: ExposureBreakdownRow[] }) {
  const total = rows.reduce((sum, row) => sum + (row.porcentaje ?? 0), 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <>
            <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    // El ancho se normaliza sobre la suma de la leyenda y no sobre 100, para que la
                    // barra quede llena aunque el total tenga residuos de redondeo.
                    width: `${total > 0 ? Math.max(MIN_SEGMENT_PERCENT, ((row.porcentaje ?? 0) / total) * 100) : 0}%`,
                    backgroundColor: row.color,
                  }}
                  title={`${row.key} · ${formatCurrency(row.monto)}`}
                />
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-card-foreground">{row.key}</span>
                  </span>
                  <span className="shrink-0 font-mono text-card-foreground">
                    {formatCurrency(row.monto)}{' '}
                    <span className="text-muted-foreground">
                      ({row.porcentaje === undefined ? '—' : formatPercent(row.porcentaje)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
