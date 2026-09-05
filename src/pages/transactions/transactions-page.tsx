import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, PencilEdit01Icon, ReceiptDollarIcon, Shapes01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

import { BatchChangeAccountPopover } from '@/components/transactions/batch-change-account-popover'
import { BatchChangeDatePopover } from '@/components/transactions/batch-change-date-popover'
import { BatchDeleteDialog } from '@/components/transactions/batch-delete-dialog'
import { BatchEditNotePopover } from '@/components/transactions/batch-edit-note-popover'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'
import { DateRangeFilter, type DateRangeValue } from '@/components/transactions/date-range-filter'
import { DeleteTransactionDialog } from '@/components/transactions/delete-transaction-dialog'
import { EmptyState } from '@/components/empty-state'
import { MovementAmount } from '@/components/movement-amount'
import { TransactionErrorAlert } from '@/components/transaction-error-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategoryGroups } from '@/hooks/use-category-groups'
import { useTransactions, type TransactionWithRelations } from '@/hooks/use-transactions'
import { useAddTransaction } from '@/lib/add-transaction-context'
import { getCategoryIcon } from '@/lib/category-icons'
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, type TransactionErrorCode } from '@/lib/transaction-errors'
import { TRANSACTION_TYPE_ICONS, TRANSACTION_TYPE_LABELS, type TransactionType } from '@/lib/transactions'

const TYPE_FILTER_OPTIONS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gasto', label: 'Expense' },
  { value: 'ingreso', label: 'Income' },
  { value: 'transferencia', label: 'Transfer' },
  { value: 'pago_tarjeta', label: 'Card payment' },
  { value: 'ajuste', label: 'Balance adjustment' },
]

// CU-016 — historial general con filtros por tipo, cuenta, categoría y rango de fechas. Las
// transacciones enlazadas (transferencia/pago a tarjeta) aparecen como dos renglones
// independientes, uno por cuenta — no se deduplican aquí (ver docs/pdr/transacciones.md, CU-016).
// Las de `tipo = ajuste` se listan pero sin acciones de editar/eliminar ni checkbox de selección
// (RN-056/RN-107). CU-017 (editar) reutiliza el mismo AddTransactionDialog del alta, en modo
// edición. CU-035 (batch actions) agrega un "modo selección" con checkboxes y una barra de
// acciones en lote.
export function TransactionsPage() {
  const [tipo, setTipo] = useState<TransactionType | 'all'>('all')
  const [accountId, setAccountId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>({})
  // `DateRangeFilter` es dueño de su propio estado de preset/rango (ver ese archivo) — al limpiar
  // filtros desde aquí, cambiar su `key` lo remonta de vuelta a "All" en vez de dejarlo mostrando
  // un preset visualmente obsoleto mientras el filtro real ya se limpió.
  const [dateFilterResetKey, setDateFilterResetKey] = useState(0)

  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchError, setBatchError] = useState<TransactionErrorCode | null>(null)
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const { accounts } = useAccounts(false)
  const { groups } = useCategoryGroups(false)
  const flatCategories = useMemo(() => (groups ?? []).flatMap((entry) => entry.categories), [groups])

  const { transactions, refetch } = useTransactions({
    tipo,
    accountId: accountId === 'all' ? undefined : accountId,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    fechaDesde: dateRange.fechaDesde,
    fechaHasta: dateRange.fechaHasta,
  })

  // El botón "Add record" del header (fuera de esta página) abre el AddTransactionDialog global de
  // AddTransactionProvider, que no conoce el `refetch` de este listado — suscribirse aquí evita que
  // el listado quede desactualizado tras registrar un movimiento desde ese botón en vez del propio.
  const { subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetch), [subscribe, refetch])

  const hasFilters = tipo !== 'all' || accountId !== 'all' || categoryId !== 'all' || !!dateRange.fechaDesde

  function clearFilters() {
    setTipo('all')
    setAccountId('all')
    setCategoryId('all')
    setDateRange({})
    setDateFilterResetKey((key) => key + 1)
  }

  function openAdd() {
    setEditingTransaction(null)
    setAddOpen(true)
  }

  function openEdit(transaction: TransactionWithRelations) {
    setEditingTransaction(transaction)
    setAddOpen(true)
  }

  // --- CU-035 — modo selección ---

  const selectableTransactions = (transactions ?? []).filter((t) => t.tipo !== 'ajuste')
  const allSelected = selectableTransactions.length > 0 && selectableTransactions.every((t) => selectedIds.has(t.id))
  const selectedList = (transactions ?? []).filter((t) => selectedIds.has(t.id))
  const hasLinkedInSelection = selectedList.some((t) => t.transaccion_relacionada_id !== null)

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBatchError(null)
  }

  function toggleRowSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableTransactions.map((t) => t.id)))
  }

  async function runBatchUpdate(payload: { account_id?: string; fecha?: string; nota?: string }): Promise<boolean> {
    if (selectedIds.size === 0) {
      setBatchError('VALIDATION_023')
      return false
    }
    setBatchSubmitting(true)
    setBatchError(null)
    const { error } = await supabase.rpc('batch_update_transactions', {
      p_ids: Array.from(selectedIds),
      p_account_id: payload.account_id ?? null,
      p_fecha: payload.fecha ?? null,
      p_nota: payload.nota ?? null,
    })
    setBatchSubmitting(false)
    if (error) {
      setBatchError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
      return false
    }
    refetch()
    exitSelectionMode()
    return true
  }

  async function runBatchDelete(): Promise<boolean> {
    if (selectedIds.size === 0) {
      setBatchError('VALIDATION_023')
      return false
    }
    setBatchSubmitting(true)
    setBatchError(null)
    const { error } = await supabase.rpc('batch_delete_transactions', { p_ids: Array.from(selectedIds) })
    setBatchSubmitting(false)
    if (error) {
      setBatchError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
      return false
    }
    refetch()
    exitSelectionMode()
    return true
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">Every movement across your accounts, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}>
            {selectionMode ? 'Cancel' : 'Select'}
          </Button>
          <Button onClick={openAdd}>Add record</Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={tipo} onValueChange={(value) => setTipo((value as TransactionType | 'all') ?? 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(value: TransactionType | 'all') => (value === 'all' ? 'All' : TRANSACTION_TYPE_LABELS[value])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Account</label>
            <Select value={accountId} onValueChange={(value) => setAccountId(value ?? 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(value: string) =>
                    value === 'all' ? 'All' : ((accounts ?? []).find((a) => a.id === value)?.nombre ?? 'All')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(accounts ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(value: string) =>
                    value === 'all' ? 'All' : (flatCategories.find((c) => c.id === value)?.nombre ?? 'All')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {flatCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateRangeFilter key={dateFilterResetKey} onChange={setDateRange} />

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {selectionMode && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <BatchChangeAccountPopover
              accounts={accounts ?? []}
              disabled={selectedIds.size === 0 || hasLinkedInSelection}
              onConfirm={(newAccountId) => runBatchUpdate({ account_id: newAccountId })}
            />
            <BatchChangeDatePopover
              disabled={selectedIds.size === 0}
              onConfirm={(date) => runBatchUpdate({ fecha: format(date, 'yyyy-MM-dd') })}
            />
            <BatchEditNotePopover
              disabled={selectedIds.size === 0}
              onConfirm={(nota) => runBatchUpdate({ nota })}
            />
            <BatchDeleteDialog
              count={selectedIds.size}
              disabled={selectedIds.size === 0}
              isSubmitting={batchSubmitting}
              onConfirm={runBatchDelete}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Exit selection mode"
              onClick={exitSelectionMode}
              className="ml-auto"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </Button>
            {batchError && (
              <div className="w-full">
                <TransactionErrorAlert code={batchError} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex min-h-64 flex-col p-0">
          {transactions && transactions.length === 0 ? (
            <EmptyState
              icon={ReceiptDollarIcon}
              title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
              description={hasFilters ? 'Try a different filter.' : 'Add your first record to see it here.'}
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {(transactions ?? []).map((transaction) => {
                const isAdjustment = transaction.tipo === 'ajuste'
                // Una compra a meses se edita desde el detalle de la tarjeta, no desde aquí: su
                // plazo y mes de inicio no caben en el modal general, y editarla ahí la dejaría sin
                // esos campos. Sí se puede eliminar, que revierte el saldo como cualquier otra.
                const isMsiPurchase = transaction.tipo === 'compra_msi'
                const isExpenseOrIncome = transaction.tipo === 'gasto' || transaction.tipo === 'ingreso'
                const icon = isExpenseOrIncome
                  ? getCategoryIcon(transaction.category?.icono)
                  : (TRANSACTION_TYPE_ICONS[transaction.tipo] ?? Shapes01Icon)
                const label = isExpenseOrIncome
                  ? (transaction.category?.nombre ?? transaction.concepto)
                  : transaction.concepto

                return (
                  <div key={transaction.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {selectionMode && (
                        <Checkbox
                          checked={selectedIds.has(transaction.id)}
                          disabled={isAdjustment}
                          onCheckedChange={() => toggleRowSelected(transaction.id)}
                          aria-label={isAdjustment ? 'Balance adjustments cannot be selected' : 'Select transaction'}
                        />
                      )}
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <HugeiconsIcon icon={icon} className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm text-card-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.account?.nombre ?? '—'} · {format(new Date(transaction.fecha), 'd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <MovementAmount monto={transaction.monto} className="mr-1" />
                      {!isAdjustment && !selectionMode && (
                        <>
                          {!isMsiPurchase && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit transaction"
                              onClick={() => openEdit(transaction)}
                            >
                              <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
                            </Button>
                          )}
                          <DeleteTransactionDialog
                            transactionId={transaction.id}
                            isLinked={transaction.transaccion_relacionada_id !== null}
                            onDeleted={refetch}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editingTransaction={editingTransaction}
        onSuccess={refetch}
      />
    </div>
  )
}
