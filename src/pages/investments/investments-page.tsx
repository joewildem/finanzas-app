import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Briefcase01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'

import { EmptyState } from '@/components/empty-state'
import { InvestmentErrorAlert } from '@/components/investment-error-alert'
import { ContributionSimulator } from '@/components/investments/contribution-simulator'
import { ExposureBreakdown } from '@/components/investments/exposure-breakdown'
import { InvestmentFormDialog } from '@/components/investments/investment-form-dialog'
import { PortfolioConfigBar } from '@/components/investments/portfolio-config-bar'
import { PortfolioTable, type PortfolioTableRow } from '@/components/investments/portfolio-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useBudgets } from '@/hooks/use-budgets'
import { useCategoryGroups } from '@/hooks/use-category-groups'
import { useInvestmentBalanceHistory } from '@/hooks/use-investment-balance-history'
import { useInvestments } from '@/hooks/use-investments'
import { formatCurrency } from '@/lib/accounts'
import { currentMonthKey } from '@/lib/budgets'
import { findInvestmentErrorCodeInMessage, type InvestmentErrorCode } from '@/lib/investment-errors'
import {
  computeActiveStats,
  computeBalanceUpdatedDates,
  computeContributionPlan,
  computeExposureBreakdown,
  computeInactiveStats,
  computePortfolioTotals,
  YAHOO_FINANCE_PORTFOLIO_URL,
  type Investment,
  type InvestmentStatus,
} from '@/lib/investments'
import { supabase } from '@/lib/supabase'

interface PendingRow {
  porcentajeObjetivo: number
  balanceActual: number
  status: InvestmentStatus
}

// CU-050 (consultar) + CU-052 (configurar en lote) + CU-053 (simular aportación), en una sola
// pantalla — mismo criterio que Budget: dos tablas más un modo de edición explícito, pero a
// diferencia de Budget el guardado aquí NO es autosave: es un solo lote atómico (RN-162), con
// Save/Cancel explícitos.
export function InvestmentsPage() {
  const { investments, refetch: refetchInvestments } = useInvestments()
  const { history, refetch: refetchHistory } = useInvestmentBalanceHistory()
  const { groups } = useCategoryGroups(false)
  const mes = currentMonthKey()
  const { budgets } = useBudgets(mes)

  const [createOpen, setCreateOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<Record<string, PendingRow>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [errorCode, setErrorCode] = useState<InvestmentErrorCode | null>(null)
  const [montoAportacion, setMontoAportacion] = useState<number | undefined>(undefined)
  const [prefilled, setPrefilled] = useState(false)

  // RN-171 — pre-llena el monto de aportación con el total presupuestado del grupo "Investment" del
  // mes en curso (mismo criterio que el chip Investment de add-transaction-dialog.tsx para
  // identificar el grupo por nombre). Solo una vez por carga — el usuario siempre puede sobrescribirlo.
  useEffect(() => {
    if (prefilled || !groups || !budgets) return
    const investmentGroup = groups.find((entry) => entry.group.nombre === 'Investment')
    if (investmentGroup) {
      const categoryIds = new Set(investmentGroup.categories.map((c) => c.id))
      const total = budgets.filter((b) => b.category_id && categoryIds.has(b.category_id)).reduce((sum, b) => sum + b.monto, 0)
      if (total > 0) setMontoAportacion(total)
    }
    setPrefilled(true)
  }, [groups, budgets, prefilled])

  const activeInvestments = useMemo(() => (investments ?? []).filter((i) => i.status === 'activo'), [investments])
  const inactiveInvestments = useMemo(() => (investments ?? []).filter((i) => i.status === 'inactivo'), [investments])

  const totals = useMemo(() => computePortfolioTotals(investments ?? []), [investments])
  const activeStatsById = useMemo(() => {
    const map = new Map(computeActiveStats(activeInvestments).map((s) => [s.investment.id, s]))
    return map
  }, [activeInvestments])
  const inactiveStatsById = useMemo(() => {
    const map = new Map(computeInactiveStats(inactiveInvestments, totals.totalGeneral).map((s) => [s.investment.id, s]))
    return map
  }, [inactiveInvestments, totals.totalGeneral])
  const balanceUpdatedDates = useMemo(() => computeBalanceUpdatedDates(history ?? []), [history])

  const groupBreakdown = useMemo(() => computeExposureBreakdown(investments ?? [], 'grupo_activo'), [investments])
  const typeBreakdown = useMemo(() => computeExposureBreakdown(investments ?? [], 'tipo_activo'), [investments])

  // RN-169 — precondición local del simulador: al menos un activo, suma exacta de 100%.
  const sumActiveObjetivo = activeInvestments.reduce((sum, i) => sum + i.porcentaje_objetivo, 0)
  const portfolioConfigured = activeInvestments.length > 0 && Math.abs(sumActiveObjetivo - 100) < 0.005

  const plan =
    portfolioConfigured && montoAportacion && montoAportacion > 0
      ? computeContributionPlan(activeInvestments, montoAportacion)
      : null
  const planByInvestmentId = useMemo(
    () => (plan ? new Map(plan.rows.map((r) => [r.investment.id, r])) : null),
    [plan],
  )

  function seedPending() {
    const initial: Record<string, PendingRow> = {}
    for (const investment of investments ?? []) {
      initial[investment.id] = {
        porcentajeObjetivo: investment.porcentaje_objetivo,
        balanceActual: investment.balance_actual,
        status: investment.status,
      }
    }
    setPending(initial)
  }

  function handleStartEditing() {
    seedPending()
    setErrorCode(null)
    setEditing(true)
  }

  function handleCancelEditing() {
    setEditing(false)
    setPending({})
    setErrorCode(null)
  }

  function handleChangePending(investmentId: string, field: 'porcentajeObjetivo' | 'balanceActual', value: number) {
    setPending((prev) => ({ ...prev, [investmentId]: { ...prev[investmentId], [field]: value } }))
  }

  function handleChangeStatus(investmentId: string, status: InvestmentStatus) {
    setPending((prev) => ({
      ...prev,
      [investmentId]: {
        ...prev[investmentId],
        status,
        // RN-160 — desactivar fuerza el porcentaje objetivo a cero de inmediato en pantalla.
        porcentajeObjetivo: status === 'inactivo' ? 0 : prev[investmentId].porcentajeObjetivo,
      },
    }))
  }

  const sumActivePercentPending = Object.values(pending).reduce(
    (sum, p) => sum + (p.status === 'activo' ? p.porcentajeObjetivo : 0),
    0,
  )

  async function handleSave() {
    setIsSaving(true)
    setErrorCode(null)

    const items = (investments ?? []).map((investment) => {
      const p = pending[investment.id]
      return {
        investment_id: investment.id,
        porcentaje_objetivo: p.porcentajeObjetivo,
        balance_actual: p.balanceActual,
        status: p.status,
      }
    })

    const { error } = await supabase.rpc('save_portfolio_config', { p_items: items })
    setIsSaving(false)

    if (error) {
      setErrorCode(findInvestmentErrorCodeInMessage(error.message) ?? 'SYS_001')
      return
    }

    setEditing(false)
    setPending({})
    refetchInvestments()
    refetchHistory()
  }

  function buildRows(list: Investment[]): PortfolioTableRow[] {
    return list.map((investment) => {
      const planRow = planByInvestmentId?.get(investment.id)
      return {
        investment,
        porcentajeActual: activeStatsById.get(investment.id)?.porcentajeActual,
        diferencia: activeStatsById.get(investment.id)?.diferencia,
        porcentajeDelTotal: inactiveStatsById.get(investment.id)?.porcentajeDelTotal,
        updatedAt: balanceUpdatedDates.byInvestment.get(investment.id) ?? null,
        suggestedContribution: planRow?.aportacionSugerida,
        newPercent: planRow?.nuevoPorcentaje,
        pending: pending[investment.id] ?? {
          porcentajeObjetivo: investment.porcentaje_objetivo,
          balanceActual: investment.balance_actual,
          status: investment.status,
        },
      }
    })
  }

  const isEmpty = investments !== undefined && investments.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Investments</h1>
          <p className="text-sm text-muted-foreground">Track your portfolio and plan your next contribution.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={YAHOO_FINANCE_PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Yahoo Finance
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
          </a>
          {!editing && (
            <>
              <Button variant="outline" onClick={handleStartEditing} disabled={isEmpty}>
                Configure portfolio
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Add instrument</Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="outline" onClick={handleCancelEditing} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      <InvestmentErrorAlert code={errorCode} />

      {editing && <PortfolioConfigBar sumActivePercent={sumActivePercentPending} />}

      {isEmpty ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col">
            <EmptyState
              icon={Briefcase01Icon}
              title="No instruments yet"
              description="Add your first instrument to start tracking your portfolio."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Active portfolio</p>
                <p className="font-mono text-xl font-medium text-card-foreground">
                  {formatCurrency(totals.totalActivo)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Total portfolio</p>
                <p className="font-mono text-xl font-medium text-card-foreground">
                  {formatCurrency(totals.totalGeneral)}
                </p>
                {balanceUpdatedDates.latest && (
                  <p className="text-xs text-muted-foreground">Last updated {balanceUpdatedDates.latest}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {!editing && (
            <ContributionSimulator
              montoAportacion={montoAportacion}
              onChangeMonto={setMontoAportacion}
              portfolioConfigured={portfolioConfigured}
              plan={plan}
            />
          )}

          <PortfolioTable
            title="Active instruments"
            variant="active"
            rows={buildRows(activeInvestments)}
            editing={editing}
            showSimulation={!editing && plan !== null}
            onChangePending={handleChangePending}
            onChangeStatus={handleChangeStatus}
            onEdit={setEditingInvestment}
            onDeleted={refetchInvestments}
            emptyMessage="No active instruments yet."
          />

          <PortfolioTable
            title="Inactive instruments"
            variant="inactive"
            rows={buildRows(inactiveInvestments)}
            editing={editing}
            onChangePending={handleChangePending}
            onChangeStatus={handleChangeStatus}
            onEdit={setEditingInvestment}
            onDeleted={refetchInvestments}
            emptyMessage="No inactive instruments."
          />

          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ExposureBreakdown title="Exposure by asset group" rows={groupBreakdown} />
              <ExposureBreakdown title="Exposure by asset type" rows={typeBreakdown} />
            </div>
          )}
        </>
      )}

      <InvestmentFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetchInvestments()}
      />
      <InvestmentFormDialog
        mode="edit"
        investment={editingInvestment ?? undefined}
        open={editingInvestment !== null}
        onOpenChange={(open) => !open && setEditingInvestment(null)}
        onSuccess={() => refetchInvestments()}
      />
    </div>
  )
}
