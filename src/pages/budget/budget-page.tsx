import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BudgetErrorAlert } from '@/components/budget-error-alert'
import { BudgetTable } from '@/components/budget/budget-table'
import { CopyBudgetDialog } from '@/components/budget/copy-budget-dialog'
import { MonthNav } from '@/components/budget/month-nav'
import { useBudgets } from '@/hooks/use-budgets'
import { useCategoryGroups } from '@/hooks/use-category-groups'
import { useDebts } from '@/hooks/use-debts'
import { useMonthlyActuals } from '@/hooks/use-monthly-actuals'
import { useMonthlyDebtActuals } from '@/hooks/use-monthly-debt-actuals'
import { useMonthlyGoalActuals } from '@/hooks/use-monthly-goal-actuals'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import { useAddTransaction } from '@/lib/add-transaction-context'
import { formatCurrency } from '@/lib/accounts'
import { findBudgetErrorCodeInMessage, type BudgetErrorCode } from '@/lib/budget-errors'
import { currentMonthKey } from '@/lib/budgets'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const AUTOSAVE_DEBOUNCE_MS = 700

function keyToPayload(key: string, monto: number | undefined, goalIds: Set<string>, debtIds: Set<string>) {
  if (goalIds.has(key)) return { category_id: null, meta_id: key, deuda_id: null, monto: monto ?? null }
  if (debtIds.has(key)) return { category_id: null, meta_id: null, deuda_id: key, monto: monto ?? null }
  return { category_id: key, meta_id: null, deuda_id: null, monto: monto ?? null }
}

// CU-042 (editar) + CU-047 (real/% consumido/disponible) combinados en una sola vista estilo YNAB,
// por decisión explícita del usuario, en dos tablas — "Inflow" (grupos con flujo inflow) y
// "Outflow" (grupos con flujo outflow + metas de ahorro activas al final) — en vez de tarjetas
// separadas. `amounts` es el estado local "pendiente" de edición (llaveado por `category_id` o
// `meta_id`, ambos uuid — no colisionan); `snapshot` es la última versión confirmada guardada. El
// guardado es automático (debounced) en cada edición, sin botón — ver `trySave` más abajo. Cada
// meta activa es su propio renglón presupuestable (RN-150 en docs/pdr/ahorros.md), reemplazando el
// antiguo pseudo-registro único de Ahorros (`categoria_reservada`, retirado).
export function BudgetPage() {
  const [mes, setMes] = useState(currentMonthKey())
  const { budgets, refetch: refetchBudgets } = useBudgets(mes)
  const { actuals: categoryActuals, refetch: refetchActuals } = useMonthlyActuals(mes)
  const { actuals: goalActuals, refetch: refetchGoalActuals } = useMonthlyGoalActuals(mes)
  const { actuals: debtActuals, refetch: refetchDebtActuals } = useMonthlyDebtActuals(mes)
  const { groups } = useCategoryGroups(false)
  const { goals } = useSavingsGoals(false)
  const { debts } = useDebts(false)

  const actuals = useMemo(
    () => ({ ...(categoryActuals ?? {}), ...(goalActuals ?? {}), ...(debtActuals ?? {}) }),
    [categoryActuals, goalActuals, debtActuals],
  )

  const refetchAllActuals = useCallback(() => {
    refetchActuals()
    refetchGoalActuals()
    refetchDebtActuals()
  }, [refetchActuals, refetchGoalActuals, refetchDebtActuals])

  // El botón global "Add record" del header (fuera de esta página, vía AddTransactionProvider) no
  // conoce el `refetch` de esta página — se suscribe a cualquier alta exitosa, sin importar desde
  // dónde se haya abierto el modal, mismo patrón usado en TransactionsPage. Solo `actuals` puede
  // cambiar por una transacción nueva; `budgets` no se ve afectado. `refetchAllActuals` debe
  // resuscribirse cuando `mes` cambia (`refetchActuals`/`refetchGoalActuals` son `useCallback`
  // dependientes de `mes`) — omitir esa dependencia dejaría el listener refrescando el mes viejo.
  const { subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetchAllActuals), [subscribe, refetchAllActuals])

  const [amounts, setAmounts] = useState<Record<string, number | undefined>>({})
  const [snapshot, setSnapshot] = useState<Record<string, number | undefined>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [errorCode, setErrorCode] = useState<BudgetErrorCode | null>(null)

  const goalIds = useMemo(() => new Set((goals ?? []).map((g) => g.id)), [goals])
  const debtIds = useMemo(() => new Set((debts ?? []).map((d) => d.id)), [debts])

  // Sembrado de `amounts`/`snapshot` una sola vez por mes (no en cada refetch posterior de
  // `budgets`) — el autoguardado dispara sus propios `refetchBudgets()`, y si este efecto
  // reaccionara a cada uno pisaría cualquier edición hecha por el usuario mientras ese guardado
  // seguía en vuelo.
  const seededMesRef = useRef<string | null>(null)
  useEffect(() => {
    if (!budgets || seededMesRef.current === mes) return
    seededMesRef.current = mes
    const initial: Record<string, number | undefined> = {}
    for (const budget of budgets) {
      const key = budget.category_id ?? budget.meta_id
      if (key) initial[key] = budget.monto
    }
    setAmounts(initial)
    setSnapshot(initial)
    setErrorCode(null)
  }, [budgets, mes])

  const amountsRef = useRef(amounts)
  amountsRef.current = amounts
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const mesRef = useRef(mes)
  mesRef.current = mes
  const goalIdsRef = useRef(goalIds)
  goalIdsRef.current = goalIds
  const debtIdsRef = useRef(debtIds)
  debtIdsRef.current = debtIds
  const isSavingRef = useRef(false)

  async function trySave() {
    if (isSavingRef.current) return
    const currentAmounts = amountsRef.current
    const currentSnapshot = snapshotRef.current
    const keys = new Set([...Object.keys(currentAmounts), ...Object.keys(currentSnapshot)])
    const dirtyKeys = [...keys].filter(
      (key) => (currentAmounts[key] ?? undefined) !== (currentSnapshot[key] ?? undefined),
    )
    if (dirtyKeys.length === 0) return

    isSavingRef.current = true
    setErrorCode(null)
    const items = dirtyKeys.map((key) =>
      keyToPayload(key, currentAmounts[key], goalIdsRef.current, debtIdsRef.current),
    )
    const { error } = await supabase.rpc('save_budgets', { p_mes: mesRef.current, p_items: items })
    isSavingRef.current = false

    if (error) {
      setErrorCode(findBudgetErrorCodeInMessage(error.message) ?? 'SYS_001')
      return
    }
    setSnapshot((prev) => {
      const next = { ...prev }
      for (const key of dirtyKeys) next[key] = currentAmounts[key]
      return next
    })
    refetchBudgets()
    refetchAllActuals()
    // Cualquier edición que haya llegado mientras esta llamada estaba en vuelo ya quedó reflejada
    // en `amountsRef` — se reintenta de inmediato en vez de esperar otro debounce.
    trySave()
  }

  function handleChangeAmount(key: string, value: number | undefined) {
    setAmounts((prev) => ({ ...prev, [key]: value }))
  }

  function handleToggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !(prev[groupId] ?? true) }))
  }

  const isDirty = useMemo(() => {
    const keys = new Set([...Object.keys(amounts), ...Object.keys(snapshot)])
    for (const key of keys) {
      if ((amounts[key] ?? undefined) !== (snapshot[key] ?? undefined)) return true
    }
    return false
  }, [amounts, snapshot])

  useEffect(() => {
    if (!isDirty) return
    const timeout = setTimeout(() => {
      trySave()
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts, snapshot])

  // RN-118 (categorías) — el grupo declara su flujo explícitamente; ya no se identifica por nombre.
  // El orden dentro de cada tabla viene heredado de `groups` (useCategoryGroups ya lo entrega
  // ordenado por `orden`, RN-119). `investment` se agregó como tercer valor de `flujo` (antes un
  // subconjunto de outflow) — gana su propia tabla, separada de Outflow.
  const incomeGroups = useMemo(() => (groups ?? []).filter((g) => g.group.flujo === 'inflow'), [groups])
  const outflowGroups = useMemo(() => (groups ?? []).filter((g) => g.group.flujo === 'outflow'), [groups])
  const investmentGroups = useMemo(() => (groups ?? []).filter((g) => g.group.flujo === 'investment'), [groups])

  const sumGroups = (entries: typeof incomeGroups) =>
    entries.reduce(
      (sum, entry) => sum + entry.categories.reduce((s, category) => s + (amounts[category.id] ?? 0), 0),
      0,
    )
  const incomeTotal = sumGroups(incomeGroups)
  const outflowTotal = sumGroups(outflowGroups)
  const investmentTotal = sumGroups(investmentGroups)
  const goalsTotal = (goals ?? []).reduce((sum, goal) => sum + (amounts[goal.id] ?? 0), 0)
  const debtsTotal = (debts ?? []).reduce((sum, debt) => sum + (amounts[debt.id] ?? 0), 0)
  // RN-075 — ingreso presupuestado menos grupos Outflow, grupos Investment, metas de ahorro activas
  // y deudas activas.
  const toAssign = incomeTotal - outflowTotal - investmentTotal - goalsTotal - debtsTotal

  function handleCopied() {
    seededMesRef.current = null
    refetchBudgets()
    refetchAllActuals()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Budget</h1>
          <p className="text-sm text-muted-foreground">
            Plan how much you expect to spend or receive each month.
          </p>
        </div>
        <CopyBudgetDialog mesDestino={mes} onCopied={handleCopied} />
      </div>

      <div className="flex items-center justify-between">
        <MonthNav mes={mes} onChange={setMes} />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">To assign</p>
          <p className={cn('text-lg font-medium', toAssign < 0 ? 'text-destructive' : 'text-foreground')}>
            {formatCurrency(toAssign)}
          </p>
        </div>
      </div>

      <BudgetErrorAlert code={errorCode} />

      <BudgetTable
        title="Inflow"
        groups={incomeGroups}
        amounts={amounts}
        actuals={actuals}
        isIncome
        openGroups={openGroups}
        onToggleGroup={handleToggleGroup}
        onChangeAmount={handleChangeAmount}
        emptyMessage="No income categories yet."
      />

      <BudgetTable
        title="Outflow"
        groups={outflowGroups}
        amounts={amounts}
        actuals={actuals}
        isIncome={false}
        shadeGroupRows
        openGroups={openGroups}
        onToggleGroup={handleToggleGroup}
        onChangeAmount={handleChangeAmount}
        goals={goals ?? []}
        debts={debts ?? []}
        emptyMessage="No categories yet."
      />

      <BudgetTable
        title="Investment"
        groups={investmentGroups}
        amounts={amounts}
        actuals={actuals}
        isIncome={false}
        shadeGroupRows
        openGroups={openGroups}
        onToggleGroup={handleToggleGroup}
        onChangeAmount={handleChangeAmount}
        emptyMessage="No investment categories yet."
      />
    </div>
  )
}
