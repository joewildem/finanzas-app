import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/accounts'
import { monthKeyLabel } from '@/lib/budgets'
import type { MonthDue } from '@/hooks/use-credit-cards-due'

interface Linea {
  accountId: string
  nombre: string
  monto: number
  saldada: boolean
}

// Un renglón del indicador: el monto grande y, al pasar el cursor, el desglose por tarjeta. El
// desglose es la razón de ser del indicador — el total dice cuánto, no de dónde sale. El titular y
// el desglose miden siempre lo mismo: quien los arma decide qué (pendiente o total), no este
// componente.
function DueBlock({
  label,
  mes,
  monto,
  lineas,
  emphasis,
}: {
  label: string
  mes: string
  monto: number
  lineas: Linea[]
  emphasis: boolean
}) {
  const montoClass = emphasis ? 'text-card-foreground' : 'text-muted-foreground'

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-medium text-muted-foreground">
        {label} <span className="text-sm">· {monthKeyLabel(mes)}</span>
      </p>
      {lineas.length === 0 ? (
        <p className={`font-mono text-2xl font-regular ${montoClass}`}>{formatCurrency(monto)}</p>
      ) : (
        <Tooltip>
          {/* `underline decoration-dotted` como única señal de que hay algo que ver — mismo recurso
              que ya usa el calendario de pagos para los montos con desglose. */}
          <TooltipTrigger
            render={
              <span
                className={`cursor-default font-mono text-2xl font-regular underline decoration-dotted underline-offset-8 ${montoClass}`}
              />
            }
          >
            {formatCurrency(monto)}
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex min-w-56 flex-col gap-1.5">
              {lineas.map((linea) => (
                <div key={linea.accountId} className="flex items-baseline justify-between gap-4">
                  <span className="text-muted-foreground">{linea.nombre}</span>
                  <span className="font-mono text-popover-foreground">
                    {linea.saldada ? <span className="text-success">Paid</span> : formatCurrency(linea.monto)}
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

// CU-063 — "To pay" responde a una pregunta distinta de "Total credit cards": ese es el saldo que
// se debe (RN-241), este es lo que hay que desembolsar en el mes. El segundo bloque es el mes
// siguiente, que todavía se está formando y aún no toca pagar.
export function CreditCardsDueSummary({
  aPagar,
  acumulando,
}: {
  aPagar: MonthDue | null
  acumulando: MonthDue | null
}) {
  // Sin nada pendiente no se muestra un cero grande: se dice que está al corriente y ya.
  if (!aPagar) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium text-muted-foreground">To pay</p>
        <p className="text-2xl font-regular text-muted-foreground">All settled</p>
      </div>
    )
  }

  // Una tarjeta sin nada en el mes no ensucia el desglose; una ya saldada sí aparece, porque
  // "pagada" también es información cuando se revisa qué falta.
  const lineasAPagar: Linea[] = aPagar.porTarjeta
    .filter((c) => c.total > 0)
    .map((c) => ({ accountId: c.accountId, nombre: c.nombre, monto: c.pendiente, saldada: c.pendiente === 0 }))

  const lineasAcumulando: Linea[] = (acumulando?.porTarjeta ?? [])
    .filter((c) => c.total > 0)
    .map((c) => ({ accountId: c.accountId, nombre: c.nombre, monto: c.total, saldada: false }))

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        <DueBlock label="To pay" mes={aPagar.mes} monto={aPagar.pendiente} lineas={lineasAPagar} emphasis />
        {acumulando && acumulando.total > 0 && (
          <DueBlock
            label="Building up"
            mes={acumulando.mes}
            monto={acumulando.total}
            lineas={lineasAcumulando}
            emphasis={false}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
