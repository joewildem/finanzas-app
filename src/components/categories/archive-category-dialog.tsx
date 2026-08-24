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
import { findCategoryErrorCodeInMessage, type CategoryErrorCode } from '@/lib/category-errors'
import { supabase } from '@/lib/supabase'

// CU-012 — archivar pide confirmación explícita (el CU lo requiere); reactivar es el mismo cambio
// de status en reversa, sin confirmación (mismo criterio que ArchiveAccountDialog). Archivar un
// grupo usa el RPC atómico (cascada, RN-034); archivar una categoría suelta es un update directo
// guardado por status, mismo patrón que ArchiveAccountDialog.
export function ArchiveCategoryDialog({
  target,
  activeChildCount = 0,
  onArchived,
}: {
  target: { id: string; tipo: 'grupo' | 'categoria'; nombre: string }
  activeChildCount?: number
  onArchived: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<CategoryErrorCode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const { error: opError } =
      target.tipo === 'grupo'
        ? await supabase.rpc('archive_category_group', { p_group_id: target.id })
        : await supabase
            .from('categories')
            .update({ status: 'archived' })
            .eq('id', target.id)
            .eq('status', 'active')

    setIsSubmitting(false)
    if (opError) {
      setError(findCategoryErrorCodeInMessage(opError.message) ?? 'SYS_001')
      return
    }

    setOpen(false)
    onArchived()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Archive</DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        {/* `contents` — mismo patrón que ArchiveAccountDialog para que Enter dispare el submit.
            `initialFocus` en el popup apunta al botón primario — sin esto, el foco por defecto
            cae en Cancel (primer elemento enfocable en el DOM) y Enter solo cerraría el modal. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>
              Archive {target.tipo === 'grupo' ? 'this group' : 'this category'}?
            </DialogTitle>
            <DialogDescription>
              {target.tipo === 'grupo' && activeChildCount > 0 && (
                <>
                  Its {activeChildCount} active {activeChildCount === 1 ? 'category' : 'categories'}{' '}
                  will also be hidden.{' '}
                </>
              )}
              It will no longer be available when recording transactions, but its history is kept.
              You can reactivate it any time.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
