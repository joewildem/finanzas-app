import { useState } from 'react'

import { ChangeNetworthGoalDialog } from '@/components/dashboard/change-networth-goal-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import { formatPercent } from '@/lib/utils'

const RADIUS = 68
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// CU-068 — RN-254 a RN-256. Gauge dibujado a mano con SVG (stroke-dasharray), sin depender de los
// primitivos polares de recharts — mismo criterio ya usado en CreditBalanceCard para las barras de
// progreso. El gauge se topa en 100% (RN-255) aunque `percentReal` supere ese valor.
export function NetworthGoalCard({
  montoObjetivo,
  percentReal,
  percentCapped,
  onSave,
}: {
  montoObjetivo: number | null
  percentReal: number
  percentCapped: number
  onSave: (monto: number) => Promise<{ error: string | null }>
}) {
  const [open, setOpen] = useState(false)
  const hasGoal = montoObjetivo !== null
  const offset = CIRCUMFERENCE * (1 - percentCapped / 100)

  return (
    <Card className="flex-1">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-4">
          <p className="text-base font-semibold text-card-foreground">Networth goal</p>
          <Button type="button" onClick={() => setOpen(true)}>
            {hasGoal ? 'Change' : 'Set a goal'}
          </Button>
        </div>
        <p className="font-mono text-1xl font-regular text-card-foreground">
          {hasGoal ? formatCurrency(montoObjetivo) : '—'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center">
        {!hasGoal ? (
          <p className="max-w-xs py-8 text-center text-sm text-muted-foreground">
            Set a Networth goal to start tracking your progress.
          </p>
        ) : (
          <div className="relative flex size-40 items-center justify-center">
            <svg viewBox="0 0 160 160" className="size-40 -rotate-90">
              <circle cx="80" cy="80" r={RADIUS} strokeWidth={14} className="fill-none stroke-muted" />
              <circle
                cx="80"
                cy="80"
                r={RADIUS}
                strokeWidth={14}
                strokeLinecap="round"
                className="fill-none stroke-success"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <p className="font-mono text-2xl font-regular text-foreground">{formatPercent(percentReal)}</p>
              <p className="text-sm text-muted-foreground">of your goal</p>
            </div>
          </div>
        )}
      </CardContent>

      <ChangeNetworthGoalDialog open={open} onOpenChange={setOpen} initialValue={montoObjetivo} onSave={onSave} />
    </Card>
  )
}
