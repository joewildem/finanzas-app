import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar01Icon } from '@hugeicons/core-free-icons'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { SubscriptionAvatar } from '@/components/subscriptions/subscription-avatar'
import { SubscriptionErrorAlert } from '@/components/subscriptions/subscription-error-alert'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAccounts } from '@/hooks/use-accounts'
import { formatDate, parseDate } from '@/lib/dates'
import { type SubscriptionErrorCode } from '@/lib/subscription-errors'
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_CATEGORY_LABELS,
  SUBSCRIPTION_CYCLE_LABELS,
  SUBSCRIPTION_CYCLES,
  type SubscriptionCategory,
  type SubscriptionCycle,
} from '@/lib/subscriptions'

// El Select de Base UI necesita un valor de cadena para cada opción; este centinela representa
// "sin método de pago" y se traduce a null al guardar.
const NO_PAYMENT_METHOD = '__none__'

const INPUT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm'

// Esquema espejo de las CHECK de la migración 20260905100000. `tiene_fin` no existe en la base: es
// el switch que decide si el selector de fecha de fin está disponible, y al apagarlo la fecha se
// limpia — así "sin fecha de fin" es un solo estado y no dos que puedan contradecirse.
const subscriptionFormSchema = z
  .object({
    nombre: z.string().trim().min(2, 'VALIDATION_001').max(50, 'VALIDATION_001'),
    categoria: z.enum(SUBSCRIPTION_CATEGORIES as [SubscriptionCategory, ...SubscriptionCategory[]]),
    sitio_web: z.string().trim().max(253).nullable(),
    monto: z.number({ message: 'VALIDATION_012' }).positive('VALIDATION_012'),
    ciclo: z.enum(SUBSCRIPTION_CYCLES as [SubscriptionCycle, ...SubscriptionCycle[]]),
    fecha_inicio: z.string().min(1, 'VALIDATION_001'),
    tiene_fin: z.boolean(),
    fecha_fin: z.string().nullable(),
    es_prueba: z.boolean(),
    metodo_pago: z.string().nullable(),
    nota: z.string().trim().max(500).nullable(),
  })
  .refine((values) => !values.fecha_fin || values.fecha_fin >= values.fecha_inicio, {
    message: 'VALIDATION_041',
    path: ['fecha_fin'],
  })

export type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>

export function SubscriptionForm({
  formId,
  defaultValues,
  onSubmit,
  submitError,
}: {
  formId: string
  defaultValues?: Partial<SubscriptionFormValues>
  onSubmit: (values: SubscriptionFormValues) => void
  submitError: SubscriptionErrorCode | null
}) {
  // Solo para ofrecer los nombres en el selector de método de pago. No se guarda el id de la
  // cuenta: el módulo no tiene relación con `accounts` (ver la migración).
  const { accounts } = useAccounts(false)

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      nombre: '',
      categoria: 'other',
      sitio_web: null,
      monto: undefined,
      ciclo: 'monthly',
      fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
      tiene_fin: false,
      fecha_fin: null,
      es_prueba: false,
      metodo_pago: null,
      nota: null,
      ...defaultValues,
    },
  })

  const sitioWeb = useWatch({ control, name: 'sitio_web' })
  const categoria = useWatch({ control, name: 'categoria' })
  const nombre = useWatch({ control, name: 'nombre' })
  const tieneFin = useWatch({ control, name: 'tiene_fin' })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SubscriptionErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="sub_nombre">Name</Label>
        <div className="flex items-center gap-2">
          {/* El logo se deriva del sitio web, no se carga: por eso el preview vive junto al nombre
              y se actualiza conforme se escribe el dominio, en vez de ser un campo más. */}
          <SubscriptionAvatar
            subscription={{ nombre: nombre || '?', sitio_web: sitioWeb, categoria }}
            className="size-8"
          />
          <input
            id="sub_nombre"
            {...register('nombre')}
            placeholder="Netflix"
            className={INPUT_CLASS}
          />
        </div>
        {errors.nombre && (
          <p className="text-sm text-destructive">Enter a name between 2 and 50 characters.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sub_sitio_web">Website (optional)</Label>
        <Controller
          control={control}
          name="sitio_web"
          render={({ field }) => (
            <input
              id="sub_sitio_web"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value || null)}
              placeholder="netflix.com"
              inputMode="url"
              className={INPUT_CLASS}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">Used to find the logo. Leave it empty to use the initial.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub_categoria">Category</Label>
          <Controller
            control={control}
            name="categoria"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="sub_categoria" className="w-full">
                  <SelectValue>
                    {(value: SubscriptionCategory) => SUBSCRIPTION_CATEGORY_LABELS[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SUBSCRIPTION_CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sub_ciclo">Billing cycle</Label>
          <Controller
            control={control}
            name="ciclo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="sub_ciclo" className="w-full">
                  <SelectValue>{(value: SubscriptionCycle) => SUBSCRIPTION_CYCLE_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_CYCLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SUBSCRIPTION_CYCLE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sub_monto">Amount</Label>
        <Controller
          control={control}
          name="monto"
          render={({ field }) => <CurrencyInput id="sub_monto" value={field.value} onChange={field.onChange} />}
        />
        {errors.monto && (
          <p className="text-sm text-destructive">The amount must be a number greater than zero.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Start date</Label>
        <Controller
          control={control}
          name="fecha_inicio"
          render={({ field }) => (
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                }
              >
                <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-muted-foreground" />
                {formatDate(field.value)}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-fit p-0">
                <Calendar
                  mode="single"
                  selected={parseDate(field.value)}
                  onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                />
              </PopoverContent>
            </Popover>
          )}
        />
        <p className="text-xs text-muted-foreground">
          The whole payment schedule is built from this date and the billing cycle.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sub_tiene_fin">Has an end date</Label>
          <Controller
            control={control}
            name="tiene_fin"
            render={({ field }) => (
              <Switch
                id="sub_tiene_fin"
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked)
                  if (!checked) setValue('fecha_fin', null)
                }}
              />
            )}
          />
        </div>
        {tieneFin && (
          <Controller
            control={control}
            name="fecha_fin"
            render={({ field }) => (
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-muted-foreground" />
                  {field.value ? formatDate(field.value) : 'Pick an end date'}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-fit p-0">
                  <Calendar
                    mode="single"
                    selected={field.value ? parseDate(field.value) : undefined}
                    onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        )}
        {errors.fecha_fin && (
          <p className="text-sm text-destructive">The end date must be on or after the start date.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="sub_es_prueba">Free trial</Label>
          <p className="text-xs text-muted-foreground">Highlights it so you can cancel before it charges.</p>
        </div>
        <Controller
          control={control}
          name="es_prueba"
          render={({ field }) => (
            <Switch id="sub_es_prueba" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sub_metodo_pago">Paid with (optional)</Label>
        <Controller
          control={control}
          name="metodo_pago"
          render={({ field }) => (
            <Select
              value={field.value ?? NO_PAYMENT_METHOD}
              onValueChange={(value) => field.onChange(value === NO_PAYMENT_METHOD ? null : value)}
            >
              <SelectTrigger id="sub_metodo_pago" className="w-full">
                <SelectValue>
                  {(value: string) => (value === NO_PAYMENT_METHOD ? 'Not set' : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PAYMENT_METHOD}>Not set</SelectItem>
                {(accounts ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.nombre}>
                    {account.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Saved as text — renaming the account later won't update this.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sub_nota">Note (optional)</Label>
        <Controller
          control={control}
          name="nota"
          render={({ field }) => (
            <textarea
              id="sub_nota"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value || null)}
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          )}
        />
      </div>
    </form>
  )
}
