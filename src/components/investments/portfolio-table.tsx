import { CurrencyInput } from '@/components/accounts/currency-input'
import { DeleteInvestmentDialog } from '@/components/investments/delete-investment-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatCurrencySigned } from '@/lib/accounts'
import { classifyAllocation, type Investment, type InvestmentStatus } from '@/lib/investments'
import { cn, formatPercent as formatPercentValue } from '@/lib/utils'

export interface PortfolioTableRow {
  investment: Investment
  porcentajeActual?: number
  diferencia?: number
  porcentajeDelTotal?: number
  updatedAt?: string | null
  suggestedContribution?: number
  newPercent?: number
  pending: { porcentajeObjetivo: number; balanceActual: number; status: InvestmentStatus }
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? '—' : formatPercentValue(value)
}

// Formato condicional de las columnas de diagnóstico. Todas miden lo mismo —qué tan lejos está un
// instrumento de su objetivo— pero responden preguntas distintas, y por eso no comparten paleta.

// "Current %" dice hacia qué lado se desvió la cartera: rojo por debajo del objetivo, verde por
// encima, y sin color mientras esté dentro de la tolerancia.
function currentPercentClass(actual: number | undefined, objetivo: number): string {
  const drift = classifyAllocation(actual, objetivo)
  if (drift === 'under') return 'text-destructive'
  if (drift === 'over') return 'text-success'
  return 'text-card-foreground'
}

// "New %" responde otra cosa: si la aportación simulada alcanza a acercar el instrumento a su
// objetivo. Ahí la dirección del desvío da igual —quedarse corto y pasarse son el mismo problema—,
// así que un solo color de advertencia marca lo que sigue lejos.
function newPercentClass(nuevo: number | undefined, objetivo: number): string {
  return classifyAllocation(nuevo, objetivo) === 'onTarget' ? 'text-card-foreground' : 'text-warning'
}

// CU-050 (lectura) / CU-052 (edición en lote) — un solo componente para ambas tablas del
// portafolio, parametrizado por `variant` (columnas de diagnóstico distintas: activos muestran
// %actual/diferencia, inactivos muestran %del total) y por `editing` (mismas columnas de edición
// — %objetivo, balance, interruptor de estado — sin importar la variante, ya que desactivar un
// activo o activar un inactivo es exactamente lo que mueve una fila de una tabla a la otra en el
// siguiente guardado). RN-154 — fallback responsive: `<Table>` oculta en móvil, lista de `Card`
// apiladas en su lugar con los mismos datos.
export function PortfolioTable({
  title,
  variant,
  rows,
  editing,
  showSimulation = false,
  onChangePending,
  onChangeStatus,
  onEdit,
  onDeleted,
  emptyMessage,
}: {
  title: string
  variant: 'active' | 'inactive'
  rows: PortfolioTableRow[]
  editing: boolean
  showSimulation?: boolean
  onChangePending: (investmentId: string, field: 'porcentajeObjetivo' | 'balanceActual', value: number) => void
  onChangeStatus: (investmentId: string, status: InvestmentStatus) => void
  onEdit: (investment: Investment) => void
  onDeleted: () => void
  emptyMessage: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Type</TableHead>
                  {editing ? (
                    <>
                      <TableHead className="text-right">Target %</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                    </>
                  ) : variant === 'active' ? (
                    <>
                      <TableHead className="text-right">Target %</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Current %</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      {showSimulation && <TableHead className="text-right">Suggested</TableHead>}
                      {showSimulation && <TableHead className="text-right">New %</TableHead>}
                      <TableHead className="text-right">Updated</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">% of total</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.investment.id}>
                    <TableCell className="font-medium text-card-foreground">{row.investment.ticker}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{row.investment.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{row.investment.grupo_activo}</TableCell>
                    <TableCell className="text-muted-foreground">{row.investment.tipo_activo}</TableCell>

                    {editing ? (
                      <>
                        <TableCell className="w-28">
                          <CurrencyInput
                            value={row.pending.porcentajeObjetivo}
                            onChange={(value) => onChangePending(row.investment.id, 'porcentajeObjetivo', value ?? 0)}
                          />
                        </TableCell>
                        <TableCell className="w-32">
                          <CurrencyInput
                            value={row.pending.balanceActual}
                            onChange={(value) => onChangePending(row.investment.id, 'balanceActual', value ?? 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={row.pending.status === 'activo'}
                            onCheckedChange={(checked) =>
                              onChangeStatus(row.investment.id, checked ? 'activo' : 'inactivo')
                            }
                          />
                        </TableCell>
                      </>
                    ) : variant === 'active' ? (
                      <>
                        <TableCell className="text-right font-mono">
                          {formatPercent(row.investment.porcentaje_objetivo)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.investment.balance_actual)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            currentPercentClass(row.porcentajeActual, row.investment.porcentaje_objetivo),
                          )}
                        >
                          {formatPercent(row.porcentajeActual)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            (row.diferencia ?? 0) < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {row.diferencia === undefined ? '—' : formatCurrencySigned(row.diferencia)}
                        </TableCell>
                        {showSimulation && (
                          <TableCell
                            className={cn(
                              'text-right font-mono',
                              // Sin aportación sugerida no hay nada que hacer con esta fila: en gris
                              // deja de competir por la atención con las que sí reciben dinero.
                              (row.suggestedContribution ?? 0) > 0
                                ? 'text-card-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {formatCurrency(row.suggestedContribution ?? 0)}
                          </TableCell>
                        )}
                        {showSimulation && (
                          <TableCell
                            className={cn(
                              'text-right font-mono',
                              newPercentClass(row.newPercent, row.investment.porcentaje_objetivo),
                            )}
                          >
                            {formatPercent(row.newPercent)}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {row.updatedAt ?? '—'}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right font-mono">{formatCurrency(row.investment.balance_actual)}</TableCell>
                        <TableCell className="text-right font-mono">{formatPercent(row.porcentajeDelTotal)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {row.updatedAt ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEdit(row.investment)}>
                              Edit
                            </Button>
                            <DeleteInvestmentDialog investment={row.investment} onDeleted={onDeleted} />
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <Card key={row.investment.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">{row.investment.ticker}</p>
                      <p className="text-xs text-muted-foreground">{row.investment.nombre}</p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {row.investment.grupo_activo}
                      <br />
                      {row.investment.tipo_activo}
                    </p>
                  </div>

                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Target %</span>
                        <CurrencyInput
                          value={row.pending.porcentajeObjetivo}
                          onChange={(value) => onChangePending(row.investment.id, 'porcentajeObjetivo', value ?? 0)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Balance</span>
                        <CurrencyInput
                          value={row.pending.balanceActual}
                          onChange={(value) => onChangePending(row.investment.id, 'balanceActual', value ?? 0)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Active</span>
                        <Switch
                          checked={row.pending.status === 'activo'}
                          onCheckedChange={(checked) =>
                            onChangeStatus(row.investment.id, checked ? 'activo' : 'inactivo')
                          }
                        />
                      </div>
                    </div>
                  ) : variant === 'active' ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Target / Balance</p>
                        <p className="font-mono text-card-foreground">
                          {formatPercent(row.investment.porcentaje_objetivo)} · {formatCurrency(row.investment.balance_actual)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current % / Diff</p>
                        <p className="font-mono">
                          <span
                            className={currentPercentClass(
                              row.porcentajeActual,
                              row.investment.porcentaje_objetivo,
                            )}
                          >
                            {formatPercent(row.porcentajeActual)}
                          </span>
                          <span className="text-muted-foreground"> · </span>
                          <span
                            className={
                              (row.diferencia ?? 0) < 0 ? 'text-destructive' : 'text-success'
                            }
                          >
                            {row.diferencia === undefined ? '—' : formatCurrencySigned(row.diferencia)}
                          </span>
                        </p>
                      </div>
                      {showSimulation && (
                        <div>
                          <p className="text-xs text-muted-foreground">Suggested / New %</p>
                          <p className="font-mono">
                            <span
                              className={
                                (row.suggestedContribution ?? 0) > 0
                                  ? 'text-card-foreground'
                                  : 'text-muted-foreground'
                              }
                            >
                              {formatCurrency(row.suggestedContribution ?? 0)}
                            </span>
                            <span className="text-muted-foreground"> · </span>
                            <span
                              className={newPercentClass(row.newPercent, row.investment.porcentaje_objetivo)}
                            >
                              {formatPercent(row.newPercent)}
                            </span>
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Updated</p>
                        <p className="text-card-foreground">{row.updatedAt ?? '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Balance / % of total</p>
                          <p className="font-mono text-card-foreground">
                            {formatCurrency(row.investment.balance_actual)} · {formatPercent(row.porcentajeDelTotal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Updated</p>
                          <p className="text-card-foreground">{row.updatedAt ?? '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(row.investment)}>
                          Edit
                        </Button>
                        <DeleteInvestmentDialog investment={row.investment} onDeleted={onDeleted} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
