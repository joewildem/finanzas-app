import { CurrencyInput } from '@/components/accounts/currency-input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/accounts'
import type { ContributionPlanResult } from '@/lib/investments'

// CU-053 — captura de monto_aportacion (RN-170, efímero: no hay botón "confirmar", el resultado se
// recalcula en cada tecleo y vive únicamente en `PortfolioTable` vía las columnas Suggested/New %).
// `portfolioConfigured` es la guarda local de RN-169 (al menos un activo, suma = 100%) — sin ella no
// hay llamada a servidor que devuelva BIZ_029, es una condición evaluable con los datos ya cargados.
export function ContributionSimulator({
  montoAportacion,
  onChangeMonto,
  portfolioConfigured,
  plan,
}: {
  montoAportacion: number | undefined
  onChangeMonto: (value: number | undefined) => void
  portfolioConfigured: boolean
  plan: ContributionPlanResult | null
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Label htmlFor="monto_aportacion">Next contribution</Label>
            <CurrencyInput id="monto_aportacion" value={montoAportacion} onChange={onChangeMonto} allowEmpty />
          </div>
          {plan && (
            <div className="text-right text-sm text-muted-foreground">
              <p>
                Projected total: <span className="font-mono text-foreground">{formatCurrency(plan.totalProyectado)}</span>
              </p>
              <p>
                Total shortfall: <span className="font-mono text-foreground">{formatCurrency(plan.faltanteTotal)}</span>
              </p>
            </div>
          )}
        </div>
        {!portfolioConfigured && (
          <p className="text-sm text-muted-foreground">
            Set up your portfolio first: you need active instruments whose target allocation adds up to 100%.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
