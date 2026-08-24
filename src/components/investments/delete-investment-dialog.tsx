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
import { findInvestmentErrorCodeInMessage, type InvestmentErrorCode } from '@/lib/investment-errors'
import type { Investment } from '@/lib/investments'
import { supabase } from '@/lib/supabase'

// CU-054 — eliminación física y permanente (a diferencia del resto de la app, no hay "archivar"
// aquí: `status = inactivo` ya cumple ese rol). Solo se monta desde una fila de la tabla de
// inactivos, así que ya se sabe por estado local que el instrumento está inactivo; RLS (política
// `investments_delete_inactive_own`) también lo exige, así que un `delete` con 0 filas afectadas
// puede deberse a una carrera con otra pestaña que lo reactivó — se distingue con un `select` de
// existencia antes de mostrar el error genérico.
export function DeleteInvestmentDialog({
  investment,
  onDeleted,
}: {
  investment: Investment
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<InvestmentErrorCode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const { data: deleted, error: opError } = await supabase
      .from('investments')
      .delete()
      .eq('id', investment.id)
      .eq('status', 'inactivo')
      .select()

    if (opError) {
      setIsSubmitting(false)
      setError(findInvestmentErrorCodeInMessage(opError) ?? 'SYS_001')
      return
    }

    if (!deleted || deleted.length === 0) {
      const { data: stillExists } = await supabase
        .from('investments')
        .select('id')
        .eq('id', investment.id)
        .maybeSingle()
      setIsSubmitting(false)
      setError(stillExists ? 'BIZ_030' : 'BIZ_027')
      return
    }

    setIsSubmitting(false)
    setOpen(false)
    onDeleted()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Delete</DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Delete {investment.ticker}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the instrument and its entire balance history. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
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
