import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar01Icon, CancelCircleIcon } from '@hugeicons/core-free-icons'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { DebtErrorAlert } from '@/components/debt-error-alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEBT_TYPE_LABELS, type DebtType } from '@/lib/debts'
import { type DebtErrorCode } from '@/lib/debt-errors'

const DEBT_TYPES = Object.keys(DEBT_TYPE_LABELS) as DebtType[]

// react-hook-form's `valueAsNumber` turns an empty input into `NaN`, not `undefined` — Zod's
// `.optional()` rejects that. Same helper as account-form.tsx, for `dia_pago`.
function optionalNumberValue(raw: string): number | undefined {
  return raw === '' ? undefined : Number(raw)
}

// Esquema espejo de las CHECK de la migración — RN-195 (nombre), RN-196 (tipo), RN-197
// (monto_original), RN-198 (tasa_interes), RN-199 (pago_mensual_esperado/dia_pago).
const debtFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'VALIDATION_001')
    .max(50, 'VALIDATION_001')
    .regex(/^[\p{L}\p{N} ]+$/u, 'VALIDATION_001'),
  tipo: z.enum(DEBT_TYPES as [DebtType, ...DebtType[]]),
  monto_original: z.number({ message: 'VALIDATION_001' }).positive('VALIDATION_012'),
  tasa_interes: z.number().min(0, 'VALIDATION_006'),
  pago_mensual_esperado: z.number().positive('VALIDATION_012').optional(),
  dia_pago: z.number().int().min(1, 'VALIDATION_005').max(31, 'VALIDATION_005').optional(),
  fecha_liquidacion_estimada: z.string().nullable(),
})

export type DebtFormValues = z.infer<typeof debtFormSchema>

export function DebtForm({
  formId,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  defaultValues?: Partial<DebtFormValues>
  onSubmit: (values: DebtFormValues) => void
  submitError: DebtErrorCode | null
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      nombre: '',
      tipo: 'auto',
      monto_original: undefined,
      tasa_interes: 0,
      pago_mensual_esperado: undefined,
      dia_pago: undefined,
      fecha_liquidacion_estimada: null,
      ...defaultValues,
    },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <DebtErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="debt_nombre">Name</Label>
        <Input id="debt_nombre" {...register('nombre')} placeholder="Honda Civic loan" />
        {errors.nombre && <p className="text-sm text-destructive">Enter a name between 2 and 50 characters.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="debt_tipo">Type</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="debt_tipo" className="w-full">
                  <SelectValue>{(value: DebtType) => DEBT_TYPE_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DEBT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="debt_monto_original">Original amount</Label>
          <Controller
            control={control}
            name="monto_original"
            render={({ field }) => (
              <CurrencyInput id="debt_monto_original" value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.monto_original && (
            <p className="text-sm text-destructive">The amount must be a number greater than zero.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="debt_tasa_interes">Interest rate (%, optional)</Label>
          <Input
            id="debt_tasa_interes"
            type="number"
            step="0.01"
            min={0}
            {...register('tasa_interes', { valueAsNumber: true })}
          />
          {errors.tasa_interes && <p className="text-sm text-destructive">Amount cannot be negative.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="debt_pago_mensual">Expected monthly payment (optional)</Label>
          <Controller
            control={control}
            name="pago_mensual_esperado"
            render={({ field }) => (
              <CurrencyInput id="debt_pago_mensual" value={field.value} onChange={field.onChange} allowEmpty />
            )}
          />
          {errors.pago_mensual_esperado && (
            <p className="text-sm text-destructive">The amount must be a number greater than zero.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="debt_dia_pago">Payment day (optional)</Label>
          <Input
            id="debt_dia_pago"
            type="number"
            min={1}
            max={31}
            {...register('dia_pago', { setValueAs: optionalNumberValue })}
          />
          {errors.dia_pago && <p className="text-sm text-destructive">Day must be between 1 and 31.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Estimated payoff date (optional)</Label>
          <Controller
            control={control}
            name="fecha_liquidacion_estimada"
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
                    {field.value ? format(new Date(field.value), 'd MMM yyyy') : 'No estimated date'}
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
                    aria-label="Clear estimated payoff date"
                    onClick={() => field.onChange(null)}
                  >
                    <HugeiconsIcon icon={CancelCircleIcon} />
                  </Button>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </form>
  )
}
