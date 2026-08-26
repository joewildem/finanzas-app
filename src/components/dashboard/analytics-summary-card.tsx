import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDownRight01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons'

import { Card, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import type { PeriodAmount } from '@/lib/analytics'
import { formatPercent } from '@/lib/utils'

// CU-069 — RN-263: el indicador es siempre "creció" (verde) / "disminuyó" (rojo), sin importar si
// ese cambio es financieramente bueno o malo para esta card en particular; no se muestra si
// `variacion` es `null` (periodo "All" o monto anterior en $0).
export function AnalyticsSummaryCard({ title, amount }: { title: string; amount: PeriodAmount }) {
  const isUp = amount.variacion !== null && amount.variacion > 0
  const isDown = amount.variacion !== null && amount.variacion < 0

  return (
    <Card className="flex-1">
      <CardHeader className="gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className="flex-1 text-lg font-medium text-card-foreground">{title}</p>
          {(isUp || isDown) && (
            <span
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                isUp ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}
            >
              <HugeiconsIcon icon={isUp ? ArrowUpRight01Icon : ArrowDownRight01Icon} className="size-3.5" />
              {formatPercent(Math.abs(amount.variacion!) * 100)}
            </span>
          )}
        </div>
        <p className="font-mono text-2xl font-medium text-card-foreground">{formatCurrency(amount.monto)}</p>
      </CardHeader>
    </Card>
  )
}
