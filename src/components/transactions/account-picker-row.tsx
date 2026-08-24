import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { BankIcon, ChevronRightIcon } from '@hugeicons/core-free-icons'

import { AccountAvatar } from '@/components/accounts/account-avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ACCOUNT_TYPE_ICONS } from '@/lib/account-icons'
import type { Account } from '@/lib/accounts'
import { cn } from '@/lib/utils'

// Fila "selection-card" para Account/From/To — a diferencia de Category, el panel no lista
// nombres: es una cuadrícula con la miniatura real de cada cuenta (mismo `AccountAvatar` que CU-003
// usa en el detalle de Cuentas — imagen cargada si existe, o el ícono por defecto según tipo si no
// hay imagen, sin dejar huecos en la grid) para selección visual rápida. El trigger conserva el
// nombre de la cuenta elegida. `disabled` (CU-017: la cuenta no es editable al editar un movimiento
// existente, RN-051) renderiza el mismo resumen visual sin Popover — no solo deshabilita el botón,
// para que no quede foco/hover fantasma en un control que nunca hace nada.
export function AccountPickerRow({
  label,
  accounts,
  accountId,
  onSelect,
  disabled = false,
}: {
  label: string
  accounts: Account[]
  accountId: string
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  const selected = accounts.find((a) => a.id === accountId)

  const summary = (
    <>
      <span className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
          <HugeiconsIcon icon={selected ? ACCOUNT_TYPE_ICONS[selected.tipo] : BankIcon} className="size-4.5" />
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn('text-sm', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected?.nombre ?? 'Select account'}
        </span>
        {!disabled && <HugeiconsIcon icon={ChevronRightIcon} className="size-4 text-muted-foreground" />}
      </span>
    </>
  )

  if (disabled) {
    return (
      <div className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2.5 opacity-70">
        {summary}
      </div>
    )
  }

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
        {summary}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-2">
        {accounts.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Nothing to choose from yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                title={account.nombre}
                onClick={() => {
                  onSelect(account.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-accent',
                  account.id === accountId && 'ring-2 ring-foreground/30',
                )}
              >
                <AccountAvatar account={account} className="h-10 w-auto" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
