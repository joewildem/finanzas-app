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
import { supabase } from '@/lib/supabase'

// CU-005 — archivar pide confirmación explícita (el CU lo requiere); reactivar es el mismo
// cambio de status en reversa, sin confirmación (no está en el flujo documentado para ese caso).
export function ArchiveAccountDialog({
  accountId,
  onArchived,
}: {
  accountId: string
  onArchived: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    const { error } = await supabase
      .from('accounts')
      .update({ status: 'archived' })
      .eq('id', accountId)
      .eq('status', 'active')

    setIsSubmitting(false)
    if (!error) {
      setOpen(false)
      onArchived()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Archive</DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        {/* `contents` so the form doesn't become a single grid item and break DialogContent's
            header/footer grid layout — wraps everything so Enter submits (standing modal
            convention: Esc/outside-click-to-close is free from base-ui, Enter-to-submit isn't).
            `initialFocus` on the popup points at the primary button — without it, base-ui's
            default "focus first tabbable element" lands on Cancel (it's first in DOM order),
            so Enter would just close the dialog instead of confirming. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Archive this account?</DialogTitle>
            <DialogDescription>
              It will no longer be available for new transactions, but its history is kept and
              stays visible in reports. You can reactivate it any time from the accounts list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Archiving…' : 'Archive account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
