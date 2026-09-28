import { useEffect, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { evaluateCalculatorExpression, formatCalcExpression } from '@/lib/calculator'
import { cn } from '@/lib/utils'

type CalcKey =
  | { kind: 'digit'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'percent' }
  | { kind: 'negate' }
  | { kind: 'clear' }
  | { kind: 'delete' }
  | { kind: 'equals' }

const KEYPAD: CalcKey[] = [
  { kind: 'clear' },
  { kind: 'delete' },
  { kind: 'percent' },
  { kind: 'op', value: '/' },
  { kind: 'digit', value: '7' },
  { kind: 'digit', value: '8' },
  { kind: 'digit', value: '9' },
  { kind: 'op', value: '*' },
  { kind: 'digit', value: '4' },
  { kind: 'digit', value: '5' },
  { kind: 'digit', value: '6' },
  { kind: 'op', value: '-' },
  { kind: 'digit', value: '1' },
  { kind: 'digit', value: '2' },
  { kind: 'digit', value: '3' },
  { kind: 'op', value: '+' },
  { kind: 'negate' },
  { kind: 'digit', value: '0' },
  { kind: 'digit', value: '.' },
  { kind: 'equals' },
]

function keyLabel(key: CalcKey): string {
  switch (key.kind) {
    case 'digit':
      return key.value
    case 'op':
      return key.value === '*' ? '×' : key.value === '/' ? '÷' : key.value
    case 'percent':
      return '%'
    case 'negate':
      return '+/-'
    case 'clear':
      return 'AC'
    case 'delete':
      return 'DEL'
    case 'equals':
      return '='
  }
}

function keyVariant(key: CalcKey): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (key.kind) {
    case 'digit':
      return 'secondary'
    case 'equals':
      return 'default'
    case 'clear':
      return 'destructive'
    default:
      return 'outline'
  }
}

// Aplica una tecla sobre la expresión actual — puerto de `performCalcAction` del spec (sección
// 4.1), sin el parche de "="/"+/-" hecho con `eval()`: usa `evaluateCalculatorExpression` (sin
// eval, ver src/lib/calculator.ts).
export function applyCalcKey(expression: string, key: CalcKey): string {
  switch (key.kind) {
    case 'digit': {
      if (expression === '0' && key.value !== '.') return key.value
      if (key.value === '.' && expression.endsWith('.')) return expression
      return expression + key.value
    }
    case 'op': {
      const last = expression.slice(-1)
      if ('+-*/'.includes(last)) return expression.slice(0, -1) + key.value
      return expression + key.value
    }
    case 'percent': {
      const last = expression.slice(-1)
      if (last === '%' || '+-*/'.includes(last) || expression === '') return expression
      return expression + '%'
    }
    case 'negate': {
      const result = evaluateCalculatorExpression(expression)
      if (result === null) return expression
      return String(result * -1)
    }
    case 'clear':
      return '0'
    case 'delete': {
      const next = expression.slice(0, -1)
      return next === '' ? '0' : next
    }
    case 'equals': {
      const result = evaluateCalculatorExpression(expression)
      return result === null ? expression : String(result)
    }
  }
}

// Calculadora como un segundo Dialog de base-ui completamente independiente — no un panel dentro
// del modal "Add record" ni una vista que lo reemplaza. `modal={false}` y sin `Backdrop` propio:
// no debe atenuar ni volver inert al modal principal, ambos quedan usables/visibles a la vez. Se
// posiciona con `fixed` + `calc()` relativo al centro del viewport, desplazado a la derecha del
// ancho del modal principal (`max-w-lg` = 32rem) más el espacio de la pestaña que lo activa — ver
// AddTransactionDialog; en móvil no hay ese "a un lado", así que ocupa el lugar del teclado. "="
// escribe el resultado en el monto sin cerrar (el usuario espera verlo de los dos lados) y "Done"
// lo aplica y cierra; X y Escape solo cierran, sin tocar el monto.
export function CalculatorDialog({
  open,
  onOpenChange,
  expression,
  onExpressionChange,
  onDone,
  onResult,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expression: string
  onExpressionChange: (next: string) => void
  onDone: () => void
  // "=" escribe el resultado en el monto del formulario sin cerrar la calculadora: el usuario
  // espera ver el número de los dos lados a la vez. "Done" sigue siendo aplicar y cerrar.
  onResult?: (value: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) containerRef.current?.focus()
  }, [open])

  function press(key: CalcKey) {
    const next = applyCalcKey(expression, key)
    onExpressionChange(next)
    if (key.kind === 'equals') {
      const parsed = parseFloat(next)
      // Mismo recorte que "Done": un monto negativo no existe en el formulario.
      if (Number.isFinite(parsed)) onResult?.(Math.max(parsed, 0))
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const { key } = event
    if (/^[0-9]$/.test(key) || key === '.') {
      event.preventDefault()
      press({ kind: 'digit', value: key })
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      event.preventDefault()
      press({ kind: 'op', value: key })
    } else if (key === '%') {
      event.preventDefault()
      press({ kind: 'percent' })
    } else if (key === 'Enter' || key === '=') {
      event.preventDefault()
      press({ kind: 'equals' })
    } else if (key === 'Backspace') {
      event.preventDefault()
      press({ kind: 'delete' })
    } else if (key === 'Delete') {
      event.preventDefault()
      press({ kind: 'clear' })
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          ref={containerRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={cn(
            'fixed top-1/2 left-[calc(50%+19rem)] z-50 flex w-64 -translate-y-1/2 flex-col gap-3 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-lg outline-none duration-100',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            // En un teléfono no hay "a la derecha del modal": ese `left-[calc(50%+19rem)]` la dejaba
            // fuera de la pantalla. Ahí ocupa el lugar del teclado — anclada abajo, a todo el ancho
            // y subiendo desde el borde, que es de donde el usuario espera que salga un teclado.
            'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]',
            'max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom max-md:data-closed:zoom-out-100 max-md:data-closed:slide-out-to-bottom',
          )}
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="font-heading text-base leading-none font-medium">
              Calculator
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={<Button variant="ghost" size="icon-sm" aria-label="Dismiss calculator" />}
            >
              <HugeiconsIcon icon={Cancel01Icon} />
            </DialogPrimitive.Close>
          </div>

          <div className="rounded-lg bg-muted px-4 py-6 text-right font-mono text-3xl break-all text-foreground">
            {formatCalcExpression(expression)}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {KEYPAD.map((key, index) => (
              <Button
                key={index}
                type="button"
                variant={keyVariant(key)}
                // Más alta en móvil: ahí se toca con el pulgar y ocupa el lugar de un teclado.
                className="h-11 text-sm max-md:h-14 max-md:text-base"
                onClick={() => press(key)}
              >
                {keyLabel(key)}
              </Button>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={onDone}>
            Done
          </Button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
