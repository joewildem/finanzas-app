import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CategoryErrorAlert } from '@/components/category-error-alert'
import { CategoryIconPicker } from '@/components/categories/category-icon-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_CATEGORY_ICON, type CategoryGroup } from '@/lib/categories'
import { type CategoryErrorCode } from '@/lib/category-errors'

// Esquema espejo de los CHECK de la migración — RN-026 (nombre), RN-027 (grupo_id obligatorio).
const categoryFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'VALIDATION_001')
    .max(30, 'VALIDATION_001')
    .regex(/^[\p{L}\p{N} ]+$/u, 'VALIDATION_001'),
  grupo_id: z.string().min(1, 'VALIDATION_001'),
  icono: z.string(),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function CategoryForm({
  formId,
  activeGroups,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  activeGroups: CategoryGroup[]
  defaultValues?: Partial<CategoryFormValues>
  onSubmit: (values: CategoryFormValues) => void
  submitError: CategoryErrorCode | null
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      nombre: '',
      grupo_id: activeGroups[0]?.id ?? '',
      icono: DEFAULT_CATEGORY_ICON,
      ...defaultValues,
    },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <CategoryErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="categoria_nombre">Name</Label>
        <Input id="categoria_nombre" {...register('nombre')} />
        {errors.nombre && (
          <p className="text-sm text-destructive">Enter a name between 2 and 30 characters.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="grupo_id">Group</Label>
        <Controller
          control={control}
          name="grupo_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="grupo_id" className="w-full">
                <SelectValue>
                  {(value: string) => activeGroups.find((group) => group.id === value)?.nombre}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.grupo_id && <p className="text-sm text-destructive">Select a group.</p>}
      </div>

      <Controller
        control={control}
        name="icono"
        render={({ field }) => <CategoryIconPicker value={field.value} onChange={field.onChange} />}
      />
    </form>
  )
}
