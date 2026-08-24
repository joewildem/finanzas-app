import { CurrencyInput } from '@/components/accounts/currency-input'
import { DeleteInvestmentDialog } from '@/components/investments/delete-investment-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/accounts'
import type { Investment, InvestmentStatus } from '@/lib/investments'
import { cn } from '@/lib/utils'

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
  return value === undefined ? '—' : `${value.toFixed(2)}%`
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
                          {row.investment.porcentaje_objetivo.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.investment.balance_actual)}</TableCell>
                        <TableCell className="text-right font-mono">{formatPercent(row.porcentajeActual)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            (row.diferencia ?? 0) < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {row.diferencia === undefined ? '—' : formatCurrency(row.diferencia)}
                        </TableCell>
                        {showSimulation && (
                          <TableCell className="text-right font-mono text-card-foreground">
                            {formatCurrency(row.suggestedContribution ?? 0)}
                          </TableCell>
                        )}
                        {showSimulation && (
                          <TableCell className="text-right font-mono">{formatPercent(row.newPercent)}</TableCell>
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
                          {row.investment.porcentaje_objetivo.toFixed(2)}% · {formatCurrency(row.investment.balance_actual)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current % / Diff</p>
                        <p
                          className={cn(
                            'font-mono',
                            (row.diferencia ?? 0) < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {formatPercent(row.porcentajeActual)} ·{' '}
                          {row.diferencia === undefined ? '—' : formatCurrency(row.diferencia)}
                        </p>
                      </div>
                      {showSimulation && (
                        <div>
                          <p className="text-xs text-muted-foreground">Suggested / New %</p>
                          <p className="font-mono text-card-foreground">
                            {formatCurrency(row.suggestedContribution ?? 0)} · {formatPercent(row.newPercent)}
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
