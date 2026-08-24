import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// CU-035 — "Eliminar" en lote, mismo patrón de confirmación explícita que DeleteTransactionDialog
// (CU-018), aplicado a un conteo en vez de a una sola fila. `onConfirm` corre el RPC y devuelve si
// tuvo éxito — el diálogo solo se cierra a sí mismo cuando sí lo tuvo, para que un error quede
// visible (se muestra fuera de este componente, en la barra de acciones) sin perder el contexto.
export function BatchDeleteDialog({
  count,
  disabled,
  isSubmitting,
  onConfirm,
}: {
  count: number
  disabled: boolean
  isSubmitting: boolean
  onConfirm: () => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    const succeeded = await onConfirm()
    if (succeeded) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" disabled={disabled} />}>
        Delete
      </DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>
              Delete {count} {count === 1 ? 'transaction' : 'transactions'}?
            </DialogTitle>
            <DialogDescription>
              This can't be undone. The balance of every account involved will be adjusted to
              reverse its effect, and any linked side (transfer or card payment) will be deleted too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
