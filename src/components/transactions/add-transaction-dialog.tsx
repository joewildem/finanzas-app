import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, CancelCircleIcon, ChevronDownIcon, Note01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { AccountPickerRow } from '@/components/transactions/account-picker-row'
import { CalculatorDialog } from '@/components/transactions/calculator-dialog'
import { CategoryPickerRow } from '@/components/transactions/category-picker-row'
import { DatePickerRow } from '@/components/transactions/date-picker-row'
import { DebtPickerRow } from '@/components/transactions/debt-picker-row'
import { GoalPickerRow } from '@/components/transactions/goal-picker-row'
import { TransactionErrorAlert } from '@/components/transaction-error-alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategoryGroups } from '@/hooks/use-category-groups'
import { useDebts } from '@/hooks/use-debts'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import type { TransactionWithRelations } from '@/hooks/use-transactions'
import type { AccountType } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, type TransactionErrorCode } from '@/lib/transaction-errors'
import { cn } from '@/lib/utils'

type MovementChip =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'investment'
  | 'card_payment'
  | 'goal_contribution'
  | 'goal_withdrawal'
  | 'debt_payment'

const PRIMARY_CHIPS: { value: MovementChip; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

const TRANSFER_ELIGIBLE_TYPES: AccountType[] = ['debito', 'efectivo']

// Estado activo de los chips (Expense/Income/Transfer/Investment) — color de marca (Figma
// `lime/10` bg + `lime/12` texto, ya definido como `bg-brand`/`text-brand-foreground` en
// src/index.css), en vez del tratamiento neutro anterior.
const CHIP_ACTIVE_CLASS = 'bg-brand text-brand-foreground shadow-sm'
const CHIP_INACTIVE_CLASS = 'text-muted-foreground hover:text-foreground'

// CU-013 (registrar gasto/ingreso), CU-014 (transferencia), CU-015 (pago a tarjeta) y CU-017
// (editar) comparten este único componente — CU-017 no es un modal aparte (regla formalizada en
// docs/pdr/transacciones.md): pasar `editingTransaction` conmuta a modo edición, donde tipo/cuenta
// quedan de solo lectura (RN-051) y el submit llama a `update_transaction` en vez de a los RPC de
// alta. Invocable desde cualquier botón "Add record" vía AddTransactionProvider en modo alta, o
// directamente desde el listado (CU-016) en modo edición. La calculadora es un segundo Dialog
// independiente (CalculatorDialog), abierto/cerrado con la pestaña del borde derecho.
export function AddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  editingTransaction = null,
  initialChip,
  initialGoalId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  editingTransaction?: TransactionWithRelations | null
  // Prefill de alta (ver AddTransactionPrefill en add-transaction-context.tsx) — "Contribute"
  // desde el detalle de una meta o su card ya llega con el tipo y la meta elegidos.
  initialChip?: MovementChip
  initialGoalId?: string
}) {
  const isEditMode = editingTransaction !== null

  const [chip, setChip] = useState<MovementChip>('expense')
  const [showMore, setShowMore] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)

  const [amount, setAmount] = useState(0)
  const [calcExpression, setCalcExpression] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [deudaId, setDeudaId] = useState('')
  const [interestAmount, setInterestAmount] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [fecha, setFecha] = useState(() => new Date())
  const [nota, setNota] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<TransactionErrorCode | null>(null)

  const { accounts } = useAccounts(false)
  const { groups } = useCategoryGroups(false)
  const { goals } = useSavingsGoals(false)
  const { debts } = useDebts(false)

  function resetFormState() {
    setChip('expense')
    setShowMore(false)
    setAmount(0)
    setCalcExpression('0')
    setCategoryId('')
    setGoalId('')
    setDeudaId('')
    setInterestAmount(0)
    setAccountId('')
    setFromAccountId('')
    setToAccountId('')
    setFecha(new Date())
    setNota('')
    setSubmitError(null)
  }

  // Cambiar de chip interactivamente siempre limpia la categoría/meta/deuda elegida — cada tipo
  // tiene su propio catálogo permitido (RN-039), una elegida bajo un tipo no es válida bajo otro.
  function selectChip(next: MovementChip) {
    setChip(next)
    setCategoryId('')
    setGoalId('')
    setDeudaId('')
    setInterestAmount(0)
  }

  // CU-017 — reconstruye el estado del formulario a partir de la transacción a editar. El chip
  // "Investment" no es un `tipo` propio en la base de datos (reutiliza `gasto`, RN-039) así que se
  // infiere buscando a qué grupo pertenece la categoría ya asignada (`flujo = 'investment'`). Para
  // transferencia/pago a tarjeta, la fila clickeada solo trae su propio lado — se resuelve el otro
  // consultando el documento enlazado, únicamente para mostrarlo (ambos quedan de solo lectura).
  async function populateFromTransaction(tx: TransactionWithRelations) {
    let derivedChip: MovementChip = 'expense'
    if (tx.tipo === 'ingreso') derivedChip = 'income'
    else if (tx.tipo === 'transferencia') derivedChip = 'transfer'
    else if (tx.tipo === 'pago_tarjeta') derivedChip = 'card_payment'
    else if (tx.tipo === 'aportacion_meta') derivedChip = 'goal_contribution'
    else if (tx.tipo === 'retiro_meta') derivedChip = 'goal_withdrawal'
    else if (tx.tipo === 'pago_deuda') derivedChip = 'debt_payment'
    else {
      const groupEntry = (groups ?? []).find((entry) => entry.categories.some((c) => c.id === tx.category_id))
      derivedChip = groupEntry?.group.flujo === 'investment' ? 'investment' : 'expense'
    }

    setChip(derivedChip)
    setShowMore(derivedChip === 'investment' || derivedChip === 'card_payment' || derivedChip === 'goal_contribution' || derivedChip === 'goal_withdrawal')
    setAmount(Math.abs(tx.monto))
    setCalcExpression(String(Math.abs(tx.monto)))
    setCategoryId(tx.category_id ?? '')
    setGoalId(tx.meta_id ?? '')
    setDeudaId(tx.deuda_id ?? '')
    setInterestAmount(tx.monto_interes ?? 0)
    setFecha(new Date(tx.fecha))
    setNota(tx.nota ?? '')
    setSubmitError(null)

    if (tx.tipo === 'transferencia' || tx.tipo === 'pago_tarjeta') {
      setAccountId('')
      let relatedAccountId = ''
      if (tx.transaccion_relacionada_id) {
        const { data } = await supabase
          .from('transactions')
          .select('account_id')
          .eq('id', tx.transaccion_relacionada_id)
          .maybeSingle()
        relatedAccountId = (data as { account_id: string } | null)?.account_id ?? ''
      }
      if (tx.monto < 0) {
        setFromAccountId(tx.account_id)
        setToAccountId(relatedAccountId)
      } else {
        setFromAccountId(relatedAccountId)
        setToAccountId(tx.account_id)
      }
    } else {
      setAccountId(tx.account_id)
      setFromAccountId('')
      setToAccountId('')
    }
  }

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        populateFromTransaction(editingTransaction)
      } else {
        resetFormState()
        if (initialChip) {
          setChip(initialChip)
          setShowMore(true)
          if (initialGoalId) setGoalId(initialGoalId)
        }
      }
    }
    setCalculatorOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTransaction, initialChip, initialGoalId])

  // RN-039/RN-118 — el grupo permitido para gasto/ingreso/investment se decide por `flujo`,
  // estructural desde que 'investment' se agregó como tercer valor del enum (ya no por nombre de
  // grupo — ver changelog de categorias.md).
  const filteredGroups = useMemo(
    () =>
      (groups ?? []).filter((entry) => {
        if (chip === 'investment') return entry.group.flujo === 'investment'
        return entry.group.flujo === (chip === 'income' ? 'inflow' : 'outflow')
      }),
    [groups, chip],
  )

  const transferEligibleAccounts = (accounts ?? []).filter((a) => TRANSFER_ELIGIBLE_TYPES.includes(a.tipo))
  const creditAccounts = (accounts ?? []).filter((a) => a.tipo === 'credito')
  const isCardPayment = chip === 'card_payment'
  const fromOptions = isCardPayment
    ? transferEligibleAccounts
    : transferEligibleAccounts.filter((a) => a.id !== toAccountId)
  const toOptions = isCardPayment ? creditAccounts : transferEligibleAccounts.filter((a) => a.id !== fromAccountId)

  function toggleCalculator() {
    setCalculatorOpen((wasOpen) => {
      if (!wasOpen) setCalcExpression(amount ? String(amount) : '0')
      return !wasOpen
    })
  }

  function handleCalculatorDone() {
    const parsed = parseFloat(calcExpression)
    setAmount(Number.isFinite(parsed) ? Math.max(parsed, 0) : 0)
    setCalculatorOpen(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    if (!amount || amount <= 0) {
      setSubmitError('VALIDATION_012')
      return
    }

    const fechaStr = format(fecha, 'yyyy-MM-dd')
    const showsCategory = chip === 'expense' || chip === 'income' || chip === 'investment'
    const showsGoal = chip === 'goal_contribution' || chip === 'goal_withdrawal'
    const showsDebt = chip === 'debt_payment'

    if (isEditMode && editingTransaction) {
      if (showsCategory && !categoryId) {
        setSubmitError('VALIDATION_001')
        return
      }
      if (showsGoal && !goalId) {
        setSubmitError('VALIDATION_001')
        return
      }
      if (showsDebt) {
        if (!deudaId) {
          setSubmitError('VALIDATION_001')
          return
        }
        if (interestAmount > amount) {
          setSubmitError('VALIDATION_035')
          return
        }
      }
      setIsSubmitting(true)
      const { error } = await supabase.rpc('update_transaction', {
        p_transaction_id: editingTransaction.id,
        p_monto: amount,
        p_category_id: showsCategory ? categoryId : null,
        p_fecha: fechaStr,
        p_nota: nota || null,
        p_meta_id: showsGoal ? goalId : null,
        p_deuda_id: showsDebt ? deudaId : null,
        p_monto_capital: showsDebt ? Math.max(amount - interestAmount, 0) : null,
        p_monto_interes: showsDebt ? interestAmount : null,
      })
      setIsSubmitting(false)
      if (error) {
        setSubmitError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
        return
      }
      onOpenChange(false)
      onSuccess?.()
      return
    }

    if (showsGoal) {
      if (!goalId || !accountId) {
        setSubmitError('VALIDATION_001')
        return
      }
      setIsSubmitting(true)
      const { error } = await supabase.rpc(
        chip === 'goal_contribution' ? 'create_goal_contribution' : 'create_goal_withdrawal',
        {
          p_meta_id: goalId,
          p_account_id: accountId,
          p_monto: amount,
          p_fecha: fechaStr,
          p_nota: nota || null,
        },
      )
      setIsSubmitting(false)
      if (error) {
        setSubmitError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
        return
      }
      onOpenChange(false)
      onSuccess?.()
      return
    }

    if (chip === 'transfer' || chip === 'card_payment') {
      if (!fromAccountId || !toAccountId) {
        setSubmitError('VALIDATION_001')
        return
      }
      if (fromAccountId === toAccountId) {
        setSubmitError('VALIDATION_014')
        return
      }
      setIsSubmitting(true)
      const { error } = await supabase.rpc(chip === 'transfer' ? 'create_transfer' : 'create_credit_card_payment', {
        p_cuenta_origen_id: fromAccountId,
        p_cuenta_destino_id: toAccountId,
        p_monto: amount,
        p_fecha: fechaStr,
        p_nota: nota || null,
      })
      setIsSubmitting(false)
      if (error) {
        setSubmitError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
        return
      }
      onOpenChange(false)
      onSuccess?.()
      return
    }

    if (!categoryId || !accountId) {
      setSubmitError('VALIDATION_001')
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase.rpc('create_transaction', {
      p_account_id: accountId,
      p_tipo: chip === 'income' ? 'ingreso' : 'gasto',
      p_monto: amount,
      p_category_id: categoryId,
      p_fecha: fechaStr,
      p_nota: nota || null,
    })
    setIsSubmitting(false)
    if (error) {
      setSubmitError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
      return
    }
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* `overflow-visible` + `p-0` en el Popup: el scroll vive en el wrapper interno, para que
            la pestaña de la calculadora (hermana de ese wrapper, ver más abajo) pueda protruir
            fuera del modal en vez de que `overflow-y-auto` la recorte — en CSS, fijar `overflow-y`
            a algo distinto de `visible` fuerza también a `overflow-x` a recortar. */}
        <DialogContent className="max-w-lg overflow-visible p-0">
          <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit record' : 'Add record'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="contents">
              <div className="flex flex-col gap-4">
              <TransactionErrorAlert code={submitError} />

              <div className="relative flex items-center py-2">
                <CurrencyInput id="monto" variant="hero" autoFocus value={amount} onChange={(value) => setAmount(value ?? 0)} />
                {amount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(0)}
                    aria-label="Clear amount"
                    className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={CancelCircleIcon} className="size-5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                  {PRIMARY_CHIPS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isEditMode}
                      onClick={() => selectChip(option.value)}
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                        isEditMode && 'disabled:cursor-default',
                        chip === option.value ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS,
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {showMore && (
                  <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                    <button
                      type="button"
                      disabled={isEditMode}
                      onClick={() => selectChip('investment')}
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                        isEditMode && 'disabled:cursor-default',
                        chip === 'investment' ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS,
                      )}
                    >
                      Investment
                    </button>
                    <button
                      type="button"
                      disabled={isEditMode}
                      onClick={() => selectChip('card_payment')}
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                        isEditMode && 'disabled:cursor-default',
                        chip === 'card_payment' ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS,
                      )}
                    >
                      Card payment
                    </button>
                    <button
                      type="button"
                      disabled={isEditMode}
                      onClick={() => selectChip('goal_contribution')}
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                        isEditMode && 'disabled:cursor-default',
                        chip === 'goal_contribution' ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS,
                      )}
                    >
                      Savings
                    </button>
                  </div>
                )}

                {/* "Withdraw from goal" ya no es un chip elegible al crear (CU-048 se abre desde un
                    botón dedicado en el contexto de la meta, con un modal restringido — ver
                    WithdrawGoalDialog). Solo se muestra aquí, sin interacción, como indicador de
                    tipo al editar una transacción de retiro ya existente (CU-017). */}
                {isEditMode && chip === 'goal_withdrawal' && (
                  <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                    <span
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-center text-sm font-medium',
                        CHIP_ACTIVE_CLASS,
                      )}
                    >
                      Withdraw from goal
                    </span>
                  </div>
                )}

                {/* Mismo criterio que "Withdraw from goal": un pago de deuda no cabe como chip
                    seleccionable al crear (necesita capital+interés, no un solo monto hero) — se
                    registra desde DebtPaymentDialog. Aquí solo se muestra como indicador de tipo al
                    editar una transacción pago_deuda ya existente (RN-224). */}
                {isEditMode && chip === 'debt_payment' && (
                  <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                    <span
                      className={cn(
                        'flex-1 rounded-full py-1.5 text-center text-sm font-medium',
                        CHIP_ACTIVE_CLASS,
                      )}
                    >
                      Debt payment
                    </span>
                  </div>
                )}

                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="flex items-center justify-center gap-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showMore ? 'Less' : 'More'}
                    <HugeiconsIcon icon={ChevronDownIcon} className={cn('size-3.5 transition-transform', showMore && 'rotate-180')} />
                  </button>
                )}
              </div>

              {chip === 'transfer' || chip === 'card_payment' ? (
                <>
                  <AccountPickerRow
                    label="From"
                    accounts={fromOptions}
                    accountId={fromAccountId}
                    onSelect={setFromAccountId}
                    disabled={isEditMode}
                  />
                  <AccountPickerRow
                    label="To"
                    accounts={toOptions}
                    accountId={toAccountId}
                    onSelect={setToAccountId}
                    disabled={isEditMode}
                  />
                </>
              ) : chip === 'goal_contribution' || chip === 'goal_withdrawal' ? (
                <>
                  <GoalPickerRow goals={goals ?? []} goalId={goalId} onSelect={setGoalId} />
                  <AccountPickerRow
                    label={chip === 'goal_contribution' ? 'From' : 'To'}
                    accounts={transferEligibleAccounts}
                    accountId={accountId}
                    onSelect={setAccountId}
                    disabled={isEditMode}
                  />
                </>
              ) : chip === 'debt_payment' ? (
                <>
                  <DebtPickerRow debts={debts ?? []} debtId={deudaId} onSelect={setDeudaId} />
                  <AccountPickerRow
                    label="Account"
                    accounts={transferEligibleAccounts}
                    accountId={accountId}
                    onSelect={setAccountId}
                    disabled={isEditMode}
                  />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit_debt_interest">Interest</Label>
                    <CurrencyInput
                      id="edit_debt_interest"
                      value={interestAmount}
                      onChange={(value) => setInterestAmount(value ?? 0)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <CategoryPickerRow groups={filteredGroups} categoryId={categoryId} onSelect={setCategoryId} />
                  <AccountPickerRow
                    label="Account"
                    accounts={accounts ?? []}
                    accountId={accountId}
                    onSelect={setAccountId}
                    disabled={isEditMode}
                  />
                </>
              )}

              <DatePickerRow value={fecha} onChange={setFecha} />

              <div className="flex w-full items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <HugeiconsIcon icon={Note01Icon} className="size-4.5" />
                </span>
                <input
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  maxLength={140}
                  placeholder="Add a note"
                  aria-label="Note"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>

            <DialogFooter className={isEditMode ? 'sm:justify-end' : 'sm:justify-between'}>
              {!isEditMode && (
                <Button type="button" variant="ghost" onClick={resetFormState}>
                  Clear form
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !amount}>
                  {isSubmitting ? 'Saving…' : isEditMode ? 'Save changes' : 'Add record'}
                </Button>
              </div>
            </DialogFooter>
            </form>
          </div>

          {/* Pestaña que abre/cierra la calculadora — completamente fuera del modal (a la derecha
              de su borde, no montada sobre él), permanece visible con la calculadora abierta
              (queda entre ambos modales), único control persistente para el toggle. Fuera del
              wrapper con scroll de arriba para no quedar recortada por su `overflow-y-auto`. */}
          <button
            type="button"
            onClick={toggleCalculator}
            aria-label={calculatorOpen ? 'Close calculator' : 'Open calculator'}
            className="absolute top-1/2 left-full z-[60] ml-2 flex h-14 w-6 -translate-y-1/2 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted/70"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className={cn('size-4 transition-transform', calculatorOpen && 'rotate-180')} />
          </button>
        </DialogContent>
      </Dialog>

      <CalculatorDialog
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        expression={calcExpression}
        onExpressionChange={setCalcExpression}
        onDone={handleCalculatorDone}
      />
    </>
  )
}
