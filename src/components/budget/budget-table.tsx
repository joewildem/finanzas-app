import { Fragment } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon } from '@hugeicons/core-free-icons'

import { AvailableChip } from '@/components/budget/available-chip'
import { CurrencyInput } from '@/components/accounts/currency-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/accounts'
import type { Category, CategoryGroup } from '@/lib/categories'
import { getCategoryIcon } from '@/lib/category-icons'
import { DEBT_TYPE_ICONS, type Debt } from '@/lib/debts'
import type { SavingsGoal } from '@/lib/savings-goals'
import { cn } from '@/lib/utils'

const CELL_PADDING = 'py-3'
const GOALS_GROUP_ID = 'goals'
const DEBTS_GROUP_ID = 'debts'

function sumFor(categories: Category[], values: Record<string, number | undefined>): number {
  return categories.reduce((sum, category) => sum + (values[category.id] ?? 0), 0)
}

function availableColorClass(assigned: number, current: number, isIncome: boolean): string {
  if (!assigned || assigned <= 0) return 'text-foreground'
  const overBudget = current > assigned
  if (!overBudget) return 'text-foreground'
  return isIncome ? 'text-success' : 'text-destructive'
}

const AMOUNT_COL_WIDTH = 'w-[140px]'

export function BudgetTable({
  title,
  groups,
  amounts,
  actuals,
  isIncome,
  shadeGroupRows = false,
  openGroups,
  onToggleGroup,
  onChangeAmount,
  goals,
  debts,
  emptyMessage,
}: {
  title: string
  groups: { group: CategoryGroup; categories: Category[] }[]
  amounts: Record<string, number | undefined>
  actuals: Record<string, number>
  isIncome: boolean
  shadeGroupRows?: boolean
  openGroups: Record<string, boolean>
  onToggleGroup: (groupId: string) => void
  onChangeAmount: (key: string, value: number | undefined) => void
  // RN-150/RN-151 — cada meta activa es su propio renglón presupuestable, con "real" mensual
  // calculado igual que una categoría (a diferencia del antiguo pseudo-registro único de Ahorros,
  // que solo aceptaba un monto asignado sin "real"/"disponible").
  goals?: SavingsGoal[]
  // RN-222/RN-223 — mismo patrón que goals: cada deuda activa es su propio renglón presupuestable,
  // con "real" mensual = capital + interés pagado en el mes (a diferencia del saldo de la deuda,
  // que solo cuenta capital).
  debts?: Debt[]
  emptyMessage?: string
}) {
  const hasGoals = (goals?.length ?? 0) > 0
  const hasDebts = (debts?.length ?? 0) > 0
  const isEmpty = groups.length === 0 && !hasGoals && !hasDebts
  const goalsOpen = openGroups[GOALS_GROUP_ID] ?? true
  const goalsAssigned = hasGoals ? goals!.reduce((sum, goal) => sum + (amounts[goal.id] ?? 0), 0) : 0
  const goalsCurrent = hasGoals ? goals!.reduce((sum, goal) => sum + (actuals[goal.id] ?? 0), 0) : 0
  const debtsOpen = openGroups[DEBTS_GROUP_ID] ?? true
  const debtsAssigned = hasDebts ? debts!.reduce((sum, debt) => sum + (amounts[debt.id] ?? 0), 0) : 0
  const debtsCurrent = hasDebts ? debts!.reduce((sum, debt) => sum + (actuals[debt.id] ?? 0), 0) : 0

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="rounded-lg border border-border">
        {/* `table-fixed` + anchos explícitos en el `<thead>` — sin esto, cifras grandes en los
            inputs de Assigned hacían crecer/encoger las columnas al escribir. */}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className={CELL_PADDING}>Name</TableHead>
              <TableHead className={cn(CELL_PADDING, AMOUNT_COL_WIDTH, 'text-right')}>Assigned</TableHead>
              <TableHead className={cn(CELL_PADDING, AMOUNT_COL_WIDTH, 'text-right')}>Current</TableHead>
              <TableHead className={cn(CELL_PADDING, AMOUNT_COL_WIDTH, 'text-right')}>Available</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage ?? 'Nothing to show yet.'}
                </TableCell>
              </TableRow>
            )}

            {groups.map(({ group, categories }) => {
              const groupAssigned = sumFor(categories, amounts)
              const groupCurrent = categories.reduce((sum, category) => sum + (actuals[category.id] ?? 0), 0)
              const isOpen = openGroups[group.id] ?? true

              return (
                <Fragment key={group.id}>
                  <TableRow
                    className={cn('cursor-pointer select-none', shadeGroupRows && 'bg-muted/40 hover:bg-muted/60')}
                    onClick={() => onToggleGroup(group.id)}
                  >
                    <TableCell className={CELL_PADDING}>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={ChevronRightIcon}
                          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
                        />
                        <span className="font-medium text-foreground">{group.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                      {formatCurrency(groupAssigned)}
                    </TableCell>
                    <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                      {formatCurrency(groupCurrent)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL_PADDING,
                        'text-right font-mono',
                        availableColorClass(groupAssigned, groupCurrent, isIncome),
                      )}
                    >
                      {formatCurrency(groupAssigned - groupCurrent)}
                    </TableCell>
                  </TableRow>

                  {isOpen &&
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className={CELL_PADDING}>
                          <div className="flex items-center gap-2 pl-6">
                            <HugeiconsIcon
                              icon={getCategoryIcon(category.icono)}
                              className="size-4 shrink-0 text-muted-foreground"
                              strokeWidth={2}
                            />
                            <span className="text-card-foreground">{category.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn(CELL_PADDING, AMOUNT_COL_WIDTH)}>
                          <CurrencyInput
                            value={amounts[category.id]}
                            onChange={(value) => onChangeAmount(category.id, value)}
                            allowEmpty
                          />
                        </TableCell>
                        <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-muted-foreground')}>
                          {formatCurrency(actuals[category.id] ?? 0)}
                        </TableCell>
                        <TableCell className={cn(CELL_PADDING, 'text-right')}>
                          <AvailableChip
                            assigned={amounts[category.id] ?? 0}
                            current={actuals[category.id] ?? 0}
                            isIncome={isIncome}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              )
            })}

            {hasGoals && (
              <Fragment>
                <TableRow
                  className={cn('cursor-pointer select-none', shadeGroupRows && 'bg-muted/40 hover:bg-muted/60')}
                  onClick={() => onToggleGroup(GOALS_GROUP_ID)}
                >
                  <TableCell className={CELL_PADDING}>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={ChevronRightIcon}
                        className={cn('size-4 shrink-0 text-muted-foreground transition-transform', goalsOpen && 'rotate-90')}
                      />
                      <span className="font-medium text-foreground">Savings</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                    {formatCurrency(goalsAssigned)}
                  </TableCell>
                  <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                    {formatCurrency(goalsCurrent)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL_PADDING,
                      'text-right font-mono',
                      availableColorClass(goalsAssigned, goalsCurrent, isIncome),
                    )}
                  >
                    {formatCurrency(goalsAssigned - goalsCurrent)}
                  </TableCell>
                </TableRow>

                {goalsOpen &&
                  goals!.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className={CELL_PADDING}>
                        <div className="flex items-center gap-2 pl-6">
                          <span className="flex size-4 shrink-0 items-center justify-center text-sm leading-none">
                            {goal.emoji}
                          </span>
                          <span className="text-card-foreground">{goal.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, AMOUNT_COL_WIDTH)}>
                        <CurrencyInput
                          value={amounts[goal.id]}
                          onChange={(value) => onChangeAmount(goal.id, value)}
                          allowEmpty
                        />
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-muted-foreground')}>
                        {formatCurrency(actuals[goal.id] ?? 0)}
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, 'text-right')}>
                        <AvailableChip
                          assigned={amounts[goal.id] ?? 0}
                          current={actuals[goal.id] ?? 0}
                          isIncome={isIncome}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            )}

            {hasDebts && (
              <Fragment>
                <TableRow
                  className={cn('cursor-pointer select-none', shadeGroupRows && 'bg-muted/40 hover:bg-muted/60')}
                  onClick={() => onToggleGroup(DEBTS_GROUP_ID)}
                >
                  <TableCell className={CELL_PADDING}>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={ChevronRightIcon}
                        className={cn('size-4 shrink-0 text-muted-foreground transition-transform', debtsOpen && 'rotate-90')}
                      />
                      <span className="font-medium text-foreground">Debts</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                    {formatCurrency(debtsAssigned)}
                  </TableCell>
                  <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-foreground')}>
                    {formatCurrency(debtsCurrent)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL_PADDING,
                      'text-right font-mono',
                      availableColorClass(debtsAssigned, debtsCurrent, isIncome),
                    )}
                  >
                    {formatCurrency(debtsAssigned - debtsCurrent)}
                  </TableCell>
                </TableRow>

                {debtsOpen &&
                  debts!.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell className={CELL_PADDING}>
                        <div className="flex items-center gap-2 pl-6">
                          <HugeiconsIcon
                            icon={DEBT_TYPE_ICONS[debt.tipo]}
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                          />
                          <span className="text-card-foreground">{debt.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, AMOUNT_COL_WIDTH)}>
                        <CurrencyInput
                          value={amounts[debt.id]}
                          onChange={(value) => onChangeAmount(debt.id, value)}
                          allowEmpty
                        />
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, 'text-right font-mono text-muted-foreground')}>
                        {formatCurrency(actuals[debt.id] ?? 0)}
                      </TableCell>
                      <TableCell className={cn(CELL_PADDING, 'text-right')}>
                        <AvailableChip
                          assigned={amounts[debt.id] ?? 0}
                          current={actuals[debt.id] ?? 0}
                          isIncome={isIncome}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
