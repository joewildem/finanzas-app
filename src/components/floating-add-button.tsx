import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon } from '@hugeicons/core-free-icons'

import { useAddTransaction } from '@/lib/add-transaction-context'

// FAB visible en <=768px (`md:hidden`), esquina inferior derecha — reemplaza al botón "Add record"
// del header en mobile (que se oculta en ese breakpoint), evitando duplicar la misma acción.
export function FloatingAddButton() {
  const { openAddTransaction } = useAddTransaction()

  return (
    <button
      type="button"
      onClick={() => openAddTransaction()}
      aria-label="Add record"
      className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
    >
      <HugeiconsIcon icon={Add01Icon} className="size-6" />
    </button>
  )
}
