import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronLeftIcon, ChevronRightIcon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { monthKeyLabel, shiftMonthKey } from '@/lib/budgets'

// CU-019/CU-020 — navegación de mes con flechas prev/next en vez de un `<input type="month">`
// nativo, mismo criterio que reemplazó los `<input type="date">` en el filtro de Transacciones.
export function MonthNav({ mes, onChange }: { mes: string; onChange: (mes: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonthKey(mes, -1))}
      >
        <HugeiconsIcon icon={ChevronLeftIcon} />
      </Button>
      <span className="w-32 text-center text-sm font-medium text-foreground">{monthKeyLabel(mes)}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next month"
        onClick={() => onChange(shiftMonthKey(mes, 1))}
      >
        <HugeiconsIcon icon={ChevronRightIcon} />
      </Button>
    </div>
  )
}
