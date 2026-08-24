import { useEffect, useState } from 'react'

import {
  CategoryGroupForm,
  type CategoryGroupFormValues,
} from '@/components/categories/category-group-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findCategoryErrorCodeInMessage, type CategoryErrorCode } from '@/lib/category-errors'
import type { CategoryGroup } from '@/lib/categories'
import { supabase } from '@/lib/supabase'

// CU-007 (crear) / CU-010 (editar) — mismo patrón de modal + dialog-owns-submit-state que
// AccountFormDialog.
export function CategoryGroupFormDialog({
  mode,
  group,
  existingGroups,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  group?: CategoryGroup
  existingGroups: CategoryGroup[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (group: CategoryGroup) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<CategoryErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit(values: CategoryGroupFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    const { data: saved, error } =
      mode === 'create'
        ? await supabase
            .from('categories')
            .insert({
              user_id: session.user.id,
              tipo: 'grupo',
              orden: existingGroups.reduce((max, g) => Math.max(max, g.orden), -1) + 1,
              ...values,
            })
            .select()
            .single()
        : await supabase.from('categories').update(values).eq('id', group!.id).select().single()

    setIsSubmitting(false)
    if (error || !saved) {
      setSubmitError(findCategoryErrorCodeInMessage(error?.message) ?? 'SYS_001')
      return
    }

    onSuccess(saved as CategoryGroup)
    onOpenChange(false)
  }

  const formId = `category-group-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add group' : `Edit ${group?.nombre ?? ''}`}</DialogTitle>
        </DialogHeader>
        <CategoryGroupForm
          formId={formId}
          defaultValues={group ? { nombre: group.nombre, color: group.color, flujo: group.flujo } : undefined}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create group' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
