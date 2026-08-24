import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'

// Solo dígitos, un signo negativo al inicio (cuentas de crédito) y un punto decimal.
function cleanNumericInput(raw: string): string {
  let value = raw.replace(/[^\d.-]/g, '')
  const negative = value.startsWith('-')
  value = value.replace(/-/g, '')
  const firstDot = value.indexOf('.')
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '')
  }
  return (negative ? '-' : '') + value
}

function formatWithThousands(cleaned: string): string {
  const negative = cleaned.startsWith('-')
  const body = negative ? cleaned.slice(1) : cleaned
  const [intPart, decPart] = body.split('.')
  const withCommas = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + withCommas + (decPart !== undefined ? '.' + decPart : '')
}

function formatForDisplay(value: number | undefined, hideZero: boolean): string {
  if (value === undefined || Number.isNaN(value) || (hideZero && value === 0)) return ''
  return formatWithThousands(String(value))
}

// Input numérico con separador de miles en vivo (ej. "4,600") — sin flechas de incremento porque
// es type="text" (inputMode="decimal" trae el teclado numérico en móvil), no type="number". Usado
// para todo campo de monto de la app; `allowEmpty` deja el campo vacío emitir `undefined` en vez
// de forzar 0 — para campos opcionales como línea de crédito o gasto mínimo mensual. `variant="hero"`
// es la variante prominente sin caja (modal de registrar transacción): sin borde/fondo salvo un
// border-bottom que se resalta en foco, ancho ajustado al contenido vía `ch` (válido porque usa
// font-mono, donde 1ch = ancho de cualquier carácter).
export function CurrencyInput({
  id,
  value,
  onChange,
  disabled,
  allowEmpty = false,
  variant = 'default',
  autoFocus,
}: {
  id?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
  allowEmpty?: boolean
  variant?: 'default' | 'hero'
  autoFocus?: boolean
}) {
  // En la variante "hero" un monto en 0 (el estado inicial del modal de transacciones) se muestra
  // vacío en vez de "0" — evita que el usuario tenga que borrarlo antes de escribir la cifra real.
  const hideZero = variant === 'hero'
  const [display, setDisplay] = useState(() => formatForDisplay(value, hideZero))
  // Rastrea el último valor emitido por este input, para distinguir un cambio de `value` que es
  // "eco" del propio onChange (no resincronizar — perdería un "." final mientras el usuario
  // escribe) de un cambio externo genuino (ej. la calculadora del modal de transacciones aplicando
  // un resultado) — ese sí debe reflejarse.
  const lastEmittedRef = useRef(value)

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setDisplay(formatForDisplay(value, hideZero))
      lastEmittedRef.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = cleanNumericInput(event.target.value)
    setDisplay(formatWithThousands(cleaned))

    if (cleaned === '' || cleaned === '-') {
      const next = allowEmpty ? undefined : 0
      lastEmittedRef.current = next
      onChange(next)
      return
    }
    const numeric = parseFloat(cleaned)
    const next = Number.isNaN(numeric) ? (allowEmpty ? undefined : 0) : numeric
    lastEmittedRef.current = next
    onChange(next)
  }

  if (variant === 'hero') {
    return (
      <div className="flex w-full items-baseline justify-center gap-1 border-b-2 border-transparent transition-colors focus-within:border-brand">
        <span className="font-mono text-2xl font-normal text-brand">$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          style={{ width: `${Math.max(display.length, 1) + 1}ch` }}
          className="border-0 bg-transparent p-0 font-mono text-[32px] font-semibold text-foreground outline-none focus-visible:ring-0"
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        disabled={disabled}
        autoFocus={autoFocus}
        className="pl-6"
      />
    </div>
  )
}
