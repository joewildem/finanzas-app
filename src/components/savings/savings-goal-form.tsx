import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar01Icon, CancelCircleIcon } from '@hugeicons/core-free-icons'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { EmojiInput } from '@/components/savings/emoji-input'
import { SavingsErrorAlert } from '@/components/savings-error-alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type SavingsErrorCode } from '@/lib/savings-errors'
import { DEFAULT_GOAL_EMOJI } from '@/lib/savings-goals'

// Esquema espejo de las CHECK de la migración — RN-120 (nombre), RN-124 (fecha límite). RN-121
// (monto_objetivo > 0) y RN-122 (monto_inicial >= 0) usan los mismos códigos VALIDATION que cuentas/
// transacciones, ya reutilizados en todo el resto de la app.
const savingsGoalFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'VALIDATION_001')
    .max(50, 'VALIDATION_001')
    .regex(/^[\p{L}\p{N} ]+$/u, 'VALIDATION_001'),
  emoji: z.string().trim().min(1, 'VALIDATION_025').max(8, 'VALIDATION_025'),
  monto_objetivo: z
    .number({ message: 'VALIDATION_001' })
    .positive('VALIDATION_012'),
  monto_inicial: z.number().min(0, 'VALIDATION_006'),
  fecha_limite: z.string().nullable(),
})

export type SavingsGoalFormValues = z.infer<typeof savingsGoalFormSchema>

export function SavingsGoalForm({
  formId,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  defaultValues?: Partial<SavingsGoalFormValues>
  onSubmit: (values: SavingsGoalFormValues) => void
  submitError: SavingsErrorCode | null
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SavingsGoalFormValues>({
    resolver: zodResolver(savingsGoalFormSchema),
    defaultValues: {
      nombre: '',
      emoji: DEFAULT_GOAL_EMOJI,
      monto_objetivo: undefined,
      monto_inicial: 0,
      fecha_limite: null,
      ...defaultValues,
    },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SavingsErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="meta_nombre">Name</Label>
        <div className="flex h-8 items-center gap-1 rounded-lg border border-input bg-transparent pr-2.5 pl-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Controller
            control={control}
            name="emoji"
            render={({ field }) => <EmojiInput value={field.value} onChange={field.onChange} />}
          />
          <input
            id="meta_nombre"
            {...register('nombre')}
            placeholder="Trip to Canada"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
        {(errors.nombre || errors.emoji) && (
          <p className="text-sm text-destructive">
            {errors.nombre ? 'Enter a name between 2 and 50 characters.' : "That emoji isn't valid."}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meta_objetivo">Target amount</Label>
        <Controller
          control={control}
          name="monto_objetivo"
          render={({ field }) => (
            <CurrencyInput id="meta_objetivo" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.monto_objetivo && (
          <p className="text-sm text-destructive">The amount must be a number greater than zero.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meta_inicial">Starting amount (optional)</Label>
        <Controller
          control={control}
          name="monto_inicial"
          render={({ field }) => (
            <CurrencyInput id="meta_inicial" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.monto_inicial && <p className="text-sm text-destructive">Amount cannot be negative.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Target date (optional)</Label>
        <Controller
          control={control}
          name="fecha_limite"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-muted-foreground" />
                  {field.value ? format(new Date(field.value), 'd MMM yyyy') : 'No target date'}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-fit p-0">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                  />
                </PopoverContent>
              </Popover>
              {field.value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear target date"
                  onClick={() => field.onChange(null)}
                >
                  <HugeiconsIcon icon={CancelCircleIcon} />
                </Button>
              )}
            </div>
          )}
        />
        {errors.fecha_limite && (
          <p className="text-sm text-destructive">The target date must be today or a future date.</p>
        )}
      </div>
    </form>
  )
}
