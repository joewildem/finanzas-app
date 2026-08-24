import { useEffect, useState } from 'react'

import { CategoryForm, type CategoryFormValues } from '@/components/categories/category-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import type { Category, CategoryGroup } from '@/lib/categories'
import { findCategoryErrorCodeInMessage, type CategoryErrorCode } from '@/lib/category-errors'
import { supabase } from '@/lib/supabase'

// CU-008 (crear) / CU-011 (editar, incluye mover de grupo — RN-033) — mismo patrón de modal que
// AccountFormDialog/CategoryGroupFormDialog.
export function CategoryFormDialog({
  mode,
  category,
  activeGroups,
  defaultGroupId,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  category?: Category
  activeGroups: CategoryGroup[]
  defaultGroupId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (category: Category) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<CategoryErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit(values: CategoryFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    const { data: saved, error } =
      mode === 'create'
        ? await supabase
            .from('categories')
            .insert({ user_id: session.user.id, tipo: 'categoria', ...values })
            .select()
            .single()
        : await supabase.from('categories').update(values).eq('id', category!.id).select().single()

    setIsSubmitting(false)
    if (error || !saved) {
      setSubmitError(findCategoryErrorCodeInMessage(error?.message) ?? 'SYS_001')
      return
    }

    onSuccess(saved as Category)
    onOpenChange(false)
  }

  const formId = `category-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add category' : `Edit ${category?.nombre ?? ''}`}</DialogTitle>
        </DialogHeader>
        <CategoryForm
          formId={formId}
          activeGroups={activeGroups}
          defaultValues={
            category
              ? { nombre: category.nombre, grupo_id: category.grupo_id, icono: category.icono }
              : { grupo_id: defaultGroupId }
          }
          onSubmit={handleSubmit}
          submitError={submitError}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create category' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
