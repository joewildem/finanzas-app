import { useRef, useState } from 'react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

// CU-081 — archivar sella la fecha del corte (`archivada_en = hoy`), no solo cambia el estatus. Eso
// es lo que hace que la suscripción desaparezca de este mes en adelante pero siga contando en los
// meses en que sí se pagó: sin la fecha, archivar borraría gasto histórico de las gráficas.
// Reactivar la limpia, devolviendo los cobros futuros.
export function ArchiveSubscriptionDialog({
  subscriptionId,
  open,
  onOpenChange,
  onArchived,
}: {
  subscriptionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchived: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(false)

    const { error: opError } = await supabase
      .from('subscriptions')
      .update({ status: 'archived', archivada_en: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', subscriptionId)
      .eq('status', 'active')

    setIsSubmitting(false)
    if (opError) {
      setError(true)
      return
    }

    onOpenChange(false)
    onArchived()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) setError(false)
      }}
    >
      <DialogContent initialFocus={confirmRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Archive this subscription?</DialogTitle>
            <DialogDescription>
              It stops counting from today on — no more charges on the calendar, and it leaves the
              active totals. The months you already paid for keep showing it. You can reactivate it
              any time.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
