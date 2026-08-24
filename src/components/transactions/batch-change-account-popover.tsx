import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Account } from '@/lib/accounts'

// CU-035 — "Cambiar cuenta". Elegir una cuenta en la lista es la confirmación (mismo criterio de
// un solo clic que AccountPickerRow) — no hay paso de confirmación aparte. `disabled` cubre RN-108/
// BIZ_022: la selección incluye una transacción enlazada, y reasignar solo un lado rompería el par.
export function BatchChangeAccountPopover({
  accounts,
  disabled,
  onConfirm,
}: {
  accounts: Account[]
  disabled: boolean
  onConfirm: (accountId: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            title={disabled ? "Can't change the account of a linked transaction (transfer or card payment)." : undefined}
          />
        }
      >
        Change account
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {accounts.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No accounts.</p>
        ) : (
          accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                setOpen(false)
                onConfirm(account.id)
              }}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {account.nombre}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
