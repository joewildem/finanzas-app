import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import type { ExposureBreakdownRow } from '@/lib/investments'

// RN-151 — desglose de exposición por grupo/tipo de activo sobre el total general, de solo lectura,
// sin librería de gráficas nueva (mismo criterio que GoalProgressRing): una barra simple por div.
export function ExposureBreakdown({ title, rows }: { title: string; rows: ExposureBreakdownRow[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{row.key}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatCurrency(row.monto)} · {row.porcentaje === undefined ? '—' : `${row.porcentaje.toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, row.porcentaje ?? 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
