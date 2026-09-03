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
  return formatWithThousands(value.toFixed(2))
}

// Input numérico con separador de miles en vivo (ej. "4,600") — sin flechas de incremento porque
// es type="text" (inputMode="decimal" trae el teclado numérico en móvil), no type="number". Usado
// para todo campo de monto de la app; `allowEmpty` deja el campo vacío emitir `undefined` en vez
// de forzar 0 — para campos opcionales como línea de crédito o gasto mínimo mensual. `variant="hero"`
// es la variante prominente sin caja (modal de registrar transacción): sin borde/fondo salvo un
// border-bottom que se resalta en foco, ancho ajustado al contenido vía `ch` (válido porque usa
// font-mono, donde 1ch = ancho de cualquier carácter). `variant="flat"` es la celda "Assigned" de la
// tabla de Budget (estilo YNAB): se ve como texto plano hasta que se le da clic, momento en el que
// aparece el recuadro — mismo truco de `focus-within` que "hero", pero con borde/ring en vez de
// solo un border-bottom, porque aquí sí se espera la sensación de "campo" al enfocar.
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
  variant?: 'default' | 'hero' | 'flat'
  autoFocus?: boolean
}) {
  // En la variante "hero" un monto en 0 (el estado inicial del modal de transacciones) se muestra
  // vacío en vez de "0" — evita que el usuario tenga que borrarlo antes de escribir la cifra real.
  const hideZero = variant === 'hero'
  const [display, setDisplay] = useState(() => formatForDisplay(value, hideZero))
  // Solo relevante para `variant="flat"` — el signo "$" se muestra pegado al monto en reposo
  // ("$1,000.00") y desaparece mientras se edita, en vez de quedar fijo lejos del número.
  const [isFocused, setIsFocused] = useState(false)
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

  // Al salir del campo, el número se reformatea con dos decimales fijos ("80" -> "80.00") — mientras
  // se escribe se deja libre (no se le fuerzan decimales a cada tecleo, forzarlos ahí estorbaría al
  // escribir el punto decimal).
  function handleBlur() {
    setDisplay(formatForDisplay(lastEmittedRef.current, hideZero))
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
          onBlur={handleBlur}
          disabled={disabled}
          autoFocus={autoFocus}
          style={{ width: `${Math.max(display.length, 1) + 1}ch` }}
          className="border-0 bg-transparent p-0 font-mono text-[32px] font-semibold text-foreground outline-none focus-visible:ring-0"
        />
      </div>
    )
  }

  if (variant === 'flat') {
    // En reposo el "$" va pegado al monto ("$1,000.00"), como si fuera texto plano; al enfocar
    // desaparece — mostrarlo fijo a la izquierda de una caja ancha lo dejaba lejos del número.
    const shownValue = isFocused || display === '' ? display : `$${display}`
    return (
      <div className="-mx-2 flex h-8 items-center justify-end rounded-lg border border-transparent px-2 transition-colors hover:bg-muted/40 focus-within:border-ring focus-within:bg-background focus-within:ring-3 focus-within:ring-ring/50 focus-within:hover:bg-background">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={shownValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            handleBlur()
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder="$0.00"
          className="w-full min-w-0 border-0 bg-transparent p-0 text-right font-mono text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
        onBlur={handleBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        className="pl-6"
      />
    </div>
  )
}
