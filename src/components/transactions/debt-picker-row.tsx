import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon, CreditCardIcon } from '@hugeicons/core-free-icons'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DEBT_TYPE_ICONS, type Debt } from '@/lib/debts'
import { cn } from '@/lib/utils'

// Fila "selection-card" para Debt — mismo shell que GoalPickerRow, pero sin emoji: usa un ícono fijo
// por `tipo` en vez del emoji de la meta. Se usa únicamente en AddTransactionDialog al editar una
// transacción `pago_deuda` existente (RN-224) — no hay flujo de alta que pase por aquí (CU-060 usa
// DebtPaymentDialog, con la deuda ya fija por el contexto desde el que se abrió).
export function DebtPickerRow({
  debts,
  debtId,
  onSelect,
}: {
  debts: Debt[]
  debtId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  const selected = debts.find((d) => d.id === debtId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
          />
        }
      >
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
            <HugeiconsIcon icon={selected ? DEBT_TYPE_ICONS[selected.tipo] : CreditCardIcon} className="size-4.5" />
          </span>
          <span className="text-sm font-medium text-foreground">Debt</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-sm', selected ? 'text-foreground' : 'text-muted-foreground')}>
            {selected?.nombre ?? 'Select'}
          </span>
          <HugeiconsIcon icon={ChevronRightIcon} className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-(--anchor-width) overflow-y-auto p-1">
        {debts.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No active debts yet.</p>
        ) : (
          debts.map((debt) => (
            <button
              key={debt.id}
              type="button"
              onClick={() => {
                onSelect(debt.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <HugeiconsIcon icon={DEBT_TYPE_ICONS[debt.tipo]} className="size-4" />
              {debt.nombre}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
