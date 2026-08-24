import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { InvestmentErrorAlert } from '@/components/investment-error-alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INVESTMENT_GROUPS, INVESTMENT_TYPES } from '@/lib/investments'
import { type InvestmentErrorCode } from '@/lib/investment-errors'

// Esquema espejo de las CHECK de la migración — RN-140 (ticker, unicidad se valida al guardar, no
// aquí), RN-142 (catálogos cerrados). `balance_actual` es opcional porque solo se presenta en modo
// `create` (RN-156 — en edición, ese campo vive exclusivamente en CU-052).
const investmentFormSchema = z.object({
  ticker: z.string().trim().min(1, 'VALIDATION_001').max(20, 'VALIDATION_001'),
  nombre: z.string().trim().min(2, 'VALIDATION_001').max(120, 'VALIDATION_001'),
  grupo_activo: z.enum(INVESTMENT_GROUPS),
  tipo_activo: z.enum(INVESTMENT_TYPES),
  balance_actual: z.number().min(0, 'VALIDATION_006').optional(),
})

export type InvestmentFormValues = z.infer<typeof investmentFormSchema>

export function InvestmentForm({
  formId,
  mode,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  mode: 'create' | 'edit'
  defaultValues?: Partial<InvestmentFormValues>
  onSubmit: (values: InvestmentFormValues) => void
  submitError: InvestmentErrorCode | null
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      ticker: '',
      nombre: '',
      grupo_activo: INVESTMENT_GROUPS[0],
      tipo_activo: INVESTMENT_TYPES[0],
      balance_actual: 0,
      ...defaultValues,
    },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <InvestmentErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticker">Ticker</Label>
        <Input id="ticker" {...register('ticker')} />
        {errors.ticker && <p className="text-sm text-destructive">Enter a ticker between 1 and 20 characters.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Name</Label>
        <Input id="nombre" {...register('nombre')} />
        {errors.nombre && <p className="text-sm text-destructive">Enter a name between 2 and 120 characters.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="grupo_activo">Asset group</Label>
          <Controller
            control={control}
            name="grupo_activo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="grupo_activo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo_activo">Asset type</Label>
          <Controller
            control={control}
            name="tipo_activo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tipo_activo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {mode === 'create' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="balance_actual">Current balance (optional)</Label>
          <Controller
            control={control}
            name="balance_actual"
            render={({ field }) => (
              <CurrencyInput id="balance_actual" value={field.value} onChange={field.onChange} allowEmpty />
            )}
          />
          {errors.balance_actual && <p className="text-sm text-destructive">Amount cannot be negative.</p>}
        </div>
      )}
    </form>
  )
}
