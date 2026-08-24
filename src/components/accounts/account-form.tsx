import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { AccountErrorAlert } from '@/components/account-error-alert'
import { ColorPicker } from '@/components/accounts/color-picker'
import { CurrencyInput } from '@/components/accounts/currency-input'
import { ImageAttachmentField } from '@/components/accounts/image-attachment-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { type AccountErrorCode } from '@/lib/account-errors'
import { ACCOUNT_TYPE_LABELS, DEFAULT_ACCOUNT_COLOR, type AccountType } from '@/lib/accounts'

// Esquema espejo de los CHECK de la migración (supabase/migrations/..._create_accounts_module.sql)
// — la validación de cliente no debería divergir de la fuente de verdad en la base de datos. Los
// `message` de cada regla son los códigos VALIDATION_XXX de docs/pdr/cuentas.md, mapeados a texto
// en account-errors.ts al momento de renderizar.
const accountFormSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'VALIDATION_001')
      .max(50, 'VALIDATION_001')
      .regex(/^[\p{L}\p{N} ]+$/u, 'VALIDATION_001'),
    tipo: z.enum(['debito', 'credito', 'efectivo']),
    saldo_inicial: z.number({ message: 'VALIDATION_001' }),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'VALIDATION_008'),
    excluir_de_stats: z.boolean(),
    linea_credito: z.number().optional(),
    dia_corte: z.number().int().optional(),
    dia_pago: z.number().int().optional(),
    gasto_minimo_mensual: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    // RN-004 / VALIDATION_003
    if (data.tipo !== 'credito' && data.saldo_inicial < 0) {
      ctx.addIssue({ code: 'custom', path: ['saldo_inicial'], message: 'VALIDATION_003' })
    }
    // RN-010: campos de crédito obligatorios solo si tipo=credito
    if (data.tipo === 'credito') {
      if (data.linea_credito == null || data.linea_credito <= 0) {
        ctx.addIssue({ code: 'custom', path: ['linea_credito'], message: 'VALIDATION_001' })
      }
      if (data.dia_corte == null || data.dia_corte < 1 || data.dia_corte > 31) {
        ctx.addIssue({ code: 'custom', path: ['dia_corte'], message: 'VALIDATION_005' })
      }
      if (data.dia_pago == null || data.dia_pago < 1 || data.dia_pago > 31) {
        ctx.addIssue({ code: 'custom', path: ['dia_pago'], message: 'VALIDATION_005' })
      }
      if (data.gasto_minimo_mensual != null && data.gasto_minimo_mensual < 0) {
        ctx.addIssue({ code: 'custom', path: ['gasto_minimo_mensual'], message: 'VALIDATION_006' })
      }
    }
  })

export type AccountFormValues = z.infer<typeof accountFormSchema>

// react-hook-form's `valueAsNumber` turns an empty input into `NaN`, not `undefined` — which
// Zod's `.optional()` rejects (NaN still fails the base `z.number()` check). Used for every
// optional numeric field so leaving them blank is treated as "not set", not an invalid number.
function optionalNumberValue(raw: string): number | undefined {
  return raw === '' ? undefined : Number(raw)
}

export function AccountForm({
  formId,
  mode,
  defaultValues,
  existingImageUrl,
  onSubmit,
  submitError,
}: {
  formId: string
  mode: 'create' | 'edit'
  defaultValues?: Partial<AccountFormValues>
  existingImageUrl?: string | null
  onSubmit: (values: AccountFormValues, imageFile: File | null) => void
  submitError: AccountErrorCode | null
}) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageWarning, setImageWarning] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      nombre: '',
      tipo: 'debito',
      saldo_inicial: 0,
      color: DEFAULT_ACCOUNT_COLOR,
      excluir_de_stats: false,
      ...defaultValues,
    },
  })

  const tipo = watch('tipo')
  const isCredito = tipo === 'credito'
  const isEdit = mode === 'edit'

  function handleFileSelected(file: File) {
    setImageWarning(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((values) => onSubmit(values, imageFile))}
      className="flex flex-col gap-4"
    >
      <AccountErrorAlert code={submitError} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Name</Label>
        <Input id="nombre" {...register('nombre')} />
        {errors.nombre && (
          <p className="text-sm text-destructive">Enter a name between 2 and 50 characters.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Type</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue>{(value: AccountType) => ACCOUNT_TYPE_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {ACCOUNT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {isEdit && <p className="text-xs text-muted-foreground">Type can't be changed after creation.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="saldo_inicial">Initial balance</Label>
          <Controller
            control={control}
            name="saldo_inicial"
            render={({ field }) => (
              <CurrencyInput
                id="saldo_inicial"
                value={field.value}
                onChange={field.onChange}
                disabled={isEdit}
              />
            )}
          />
          {errors.saldo_inicial && (
            <p className="text-sm text-destructive">
              {isCredito ? 'Enter a valid amount.' : 'Initial balance cannot be negative for this account type.'}
            </p>
          )}
          {isEdit && <p className="text-xs text-muted-foreground">Use "Adjust balance" to change this.</p>}
        </div>
      </div>

      {isCredito && (
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="linea_credito">Credit limit</Label>
            <Controller
              control={control}
              name="linea_credito"
              render={({ field }) => (
                <CurrencyInput id="linea_credito" value={field.value} onChange={field.onChange} allowEmpty />
              )}
            />
            {errors.linea_credito && <p className="text-sm text-destructive">This field is required.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gasto_minimo_mensual">Minimum monthly spend (optional)</Label>
            <Controller
              control={control}
              name="gasto_minimo_mensual"
              render={({ field }) => (
                <CurrencyInput
                  id="gasto_minimo_mensual"
                  value={field.value}
                  onChange={field.onChange}
                  allowEmpty
                />
              )}
            />
            {errors.gasto_minimo_mensual && (
              <p className="text-sm text-destructive">Amount cannot be negative.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dia_corte">Statement day</Label>
            <Input
              id="dia_corte"
              type="number"
              min={1}
              max={31}
              {...register('dia_corte', { setValueAs: optionalNumberValue })}
            />
            {errors.dia_corte && <p className="text-sm text-destructive">Day must be between 1 and 31.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dia_pago">Payment due day</Label>
            <Input
              id="dia_pago"
              type="number"
              min={1}
              max={31}
              {...register('dia_pago', { setValueAs: optionalNumberValue })}
            />
            {errors.dia_pago && <p className="text-sm text-destructive">Day must be between 1 and 31.</p>}
          </div>
        </div>
      )}

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

      <div className="flex flex-col gap-2">
        <Label>Image (optional)</Label>
        <ImageAttachmentField
          file={imageFile}
          previewUrl={imagePreview}
          existingImageUrl={existingImageUrl}
          onFileSelected={handleFileSelected}
          onRemove={() => {
            setImageFile(null)
            setImagePreview(null)
          }}
          onInvalidFile={setImageWarning}
        />
        {imageWarning && <p className="text-sm text-muted-foreground">{imageWarning}</p>}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="excluir_de_stats">Exclude from aggregate views</Label>
          <p className="text-xs text-muted-foreground">
            Stays available for everyday use — just left out of totals and reports.
          </p>
        </div>
        <Controller
          control={control}
          name="excluir_de_stats"
          render={({ field }) => (
            <Switch id="excluir_de_stats" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>
    </form>
  )
}
