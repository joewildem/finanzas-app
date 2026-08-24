import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon, Target01Icon } from '@hugeicons/core-free-icons'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SavingsGoal } from '@/lib/savings-goals'
import { cn } from '@/lib/utils'

// Fila "selection-card" para Goal — mismo shell que CategoryPickerRow, pero lista plana (las metas
// no tienen grupos) mostrando el emoji de cada meta en vez de un ícono de catálogo.
export function GoalPickerRow({
  goals,
  goalId,
  onSelect,
}: {
  goals: SavingsGoal[]
  goalId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  const selected = goals.find((g) => g.id === goalId)

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
            {selected ? (
              <span className="text-base">{selected.emoji}</span>
            ) : (
              <HugeiconsIcon icon={Target01Icon} className="size-4.5" />
            )}
          </span>
          <span className="text-sm font-medium text-foreground">Goal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-sm', selected ? 'text-foreground' : 'text-muted-foreground')}>
            {selected?.nombre ?? 'Select'}
          </span>
          <HugeiconsIcon icon={ChevronRightIcon} className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-(--anchor-width) overflow-y-auto p-1">
        {goals.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No active goals yet.</p>
        ) : (
          goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => {
                onSelect(goal.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="text-base">{goal.emoji}</span>
              {goal.nombre}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
