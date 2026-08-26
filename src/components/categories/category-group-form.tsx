import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { CategoryErrorAlert } from '@/components/category-error-alert'
import { ColorPicker } from '@/components/accounts/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type CategoryErrorCode } from '@/lib/category-errors'
import { DEFAULT_ACCOUNT_COLOR } from '@/lib/accounts'

const FLOW_OPTIONS = [
  { value: 'inflow', label: 'Inflow' },
  { value: 'outflow', label: 'Outflow' },
  { value: 'investment', label: 'Investment' },
] as const

// Esquema espejo de los CHECK de la migración (supabase/migrations/..._create_categories_module.sql,
// supabase/migrations/20260811110000_add_category_group_flow_and_order.sql) — RN-022 (nombre),
// RN-023 (color, hex), RN-118 (flujo, obligatorio, sin default implícito). Mismos mensajes
// VALIDATION_XXX que cuentas para el nombre; VALIDATION_008 para el color se reutiliza tal cual.
const categoryGroupFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'VALIDATION_001')
    .max(30, 'VALIDATION_001')
    .regex(/^[\p{L}\p{N} ]+$/u, 'VALIDATION_001'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'VALIDATION_008'),
  flujo: z.enum(['inflow', 'outflow', 'investment'], { message: 'VALIDATION_001' }),
})

export type CategoryGroupFormValues = z.infer<typeof categoryGroupFormSchema>

export function CategoryGroupForm({
  formId,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  defaultValues?: Partial<CategoryGroupFormValues>
  onSubmit: (values: CategoryGroupFormValues) => void
  submitError: CategoryErrorCode | null
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryGroupFormValues>({
    resolver: zodResolver(categoryGroupFormSchema),
    defaultValues: {
      nombre: '',
      color: DEFAULT_ACCOUNT_COLOR,
      flujo: 'outflow',
      ...defaultValues,
    },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <CategoryErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="grupo_nombre">Name</Label>
        <Input id="grupo_nombre" {...register('nombre')} />
        {errors.nombre && (
          <p className="text-sm text-destructive">Enter a name between 2 and 30 characters.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="grupo_flujo">Flow type</Label>
        <Controller
          control={control}
          name="flujo"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="grupo_flujo" className="w-full">
                <SelectValue>
                  {(value: 'inflow' | 'outflow' | 'investment') =>
                    FLOW_OPTIONS.find((option) => option.value === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FLOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.flujo && <p className="text-sm text-destructive">Select a flow type.</p>}
        <p className="text-xs text-muted-foreground">
          Determines whether this group's categories appear under Inflow, Outflow, or Investment in
          Budget.
        </p>
      </div>

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <ColorPicker
            value={field.value}
            onChange={field.onChange}
            error={errors.color ? 'Enter a valid hex color (e.g. #RRGGBB).' : undefined}
          />
        )}
      />
    </form>
  )
}
