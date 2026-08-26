import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import type { NetworthBreakdownGroup } from '@/lib/networth'

// CU-065 — RN-242 a RN-247. Card genérica reutilizada para Cash & Savings, Investments y
// Liabilities: total, barra segmentada proporcional a cada ítem, y el detalle ordenado (RN-245).
// Mismo shell visual (Card/CardHeader/CardContent) que el resto del Dashboard.
export function NetworthBreakdownCard({ title, group }: { title: string; group: NetworthBreakdownGroup }) {
  const hasData = group.total > 0

  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="font-mono text-xl font-regular text-card-foreground">{formatCurrency(group.total)}</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="flex flex-col gap-7">
            <div className="flex h-2 w-full gap-1">
              {group.items
                .filter((item) => item.monto > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(item.monto / group.total) * 100}%`, backgroundColor: item.color }}
                  />
                ))}
            </div>

            <div className="flex flex-col gap-3">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-base font-medium text-card-foreground">{item.label}</span>
                  </div>
                  <span className="font-mono text-base text-card-foreground">{formatCurrency(item.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
