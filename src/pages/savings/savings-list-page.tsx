import { useEffect, useState } from 'react'
import { Target01Icon } from '@hugeicons/core-free-icons'

import { SavingsGoalFormDialog } from '@/components/savings/savings-goal-form-dialog'
import { SavingsGoalCard } from '@/components/savings/savings-goal-card'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import { useAddTransaction } from '@/lib/add-transaction-context'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/transactions'

// CU-043 — listado en dos pestañas ("In progress" / "Completed"), grid de SavingsGoalCard. Una
// sola consulta trae los movimientos de TODAS las metas del usuario (activas y archivadas) para
// que cada card calcule su propio `monto_aportado_actual` sin una consulta por card.
export function SavingsListPage() {
  const { goals, refetch } = useSavingsGoals(true)
  const [movementsByGoal, setMovementsByGoal] = useState<Record<string, Pick<Transaction, 'monto'>[]>>({})
  const [createOpen, setCreateOpen] = useState(false)

  // El chip "Savings" del modal global de transacciones no conoce el `refetch` de este listado —
  // suscribirse evita que las cards queden desactualizadas hasta que el usuario recargue. `goals`
  // siempre cambia de referencia en cada refetch (nueva consulta), así que también dispara el efecto
  // de abajo que recarga `movementsByGoal`.
  const { subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetch), [subscribe, refetch])

  useEffect(() => {
    async function loadMovements() {
      const { data, error } = await supabase
        .from('transactions')
        .select('meta_id, monto')
        .in('tipo', ['aportacion_meta', 'retiro_meta'])

      if (error) return
      const grouped: Record<string, Pick<Transaction, 'monto'>[]> = {}
      for (const row of data as { meta_id: string | null; monto: number }[]) {
        if (!row.meta_id) continue
        ;(grouped[row.meta_id] ??= []).push({ monto: row.monto })
      }
      setMovementsByGoal(grouped)
    }
    loadMovements()
  }, [goals])

  const activeGoals = (goals ?? []).filter((g) => g.status === 'active')
  const archivedGoals = (goals ?? []).filter((g) => g.status === 'archived')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Savings</h1>
          <p className="text-sm text-muted-foreground">Track your progress toward your savings goals.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add goal</Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">In progress</TabsTrigger>
          <TabsTrigger value="archived">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {goals && activeGoals.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-64 flex-col">
                <EmptyState
                  icon={Target01Icon}
                  title="No goals yet"
                  description="Add your first savings goal to start tracking progress."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => (
                <SavingsGoalCard
                  key={goal.id}
                  goal={goal}
                  movimientos={movementsByGoal[goal.id] ?? []}
                  onChanged={refetch}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {goals && archivedGoals.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-64 flex-col">
                <EmptyState icon={Target01Icon} title="No completed goals yet" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedGoals.map((goal) => (
                <SavingsGoalCard
                  key={goal.id}
                  goal={goal}
                  movimientos={movementsByGoal[goal.id] ?? []}
                  onChanged={refetch}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SavingsGoalFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
