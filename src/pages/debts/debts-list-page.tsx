import { useEffect, useState } from 'react'
import { CreditCardIcon } from '@hugeicons/core-free-icons'

import { DebtCard } from '@/components/debts/debt-card'
import { DebtFormDialog } from '@/components/debts/debt-form-dialog'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebts } from '@/hooks/use-debts'
import { useAddTransaction } from '@/lib/add-transaction-context'
import { supabase } from '@/lib/supabase'

// CU-056 — listado en dos pestañas ("Active"/"Paid off"), grid de DebtCard. Una sola consulta trae
// los pagos (pago_deuda) de TODAS las deudas del usuario para que cada card calcule su propio saldo
// sin una consulta por card — mismo patrón que SavingsListPage.
export function DebtsListPage() {
  const { debts, refetch } = useDebts(true)
  const [capitalByDebt, setCapitalByDebt] = useState<Record<string, number[]>>({})
  const [createOpen, setCreateOpen] = useState(false)

  // Un pago registrado desde el modal general de transacciones (al editar un pago_deuda existente)
  // no conoce el `refetch` de este listado — suscribirse evita que las cards queden desactualizadas.
  const { subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetch), [subscribe, refetch])

  useEffect(() => {
    async function loadPayments() {
      const { data, error } = await supabase
        .from('transactions')
        .select('deuda_id, monto_capital')
        .eq('tipo', 'pago_deuda')

      if (error) return
      const grouped: Record<string, number[]> = {}
      for (const row of data as { deuda_id: string | null; monto_capital: number }[]) {
        if (!row.deuda_id) continue
        ;(grouped[row.deuda_id] ??= []).push(row.monto_capital)
      }
      setCapitalByDebt(grouped)
    }
    loadPayments()
  }, [debts])

  const activeDebts = (debts ?? []).filter((d) => d.status === 'active')
  const archivedDebts = (debts ?? []).filter((d) => d.status === 'archived')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Debts</h1>
          <p className="text-sm text-muted-foreground">Track your loans and their remaining balance.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add debt</Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Paid off</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {debts && activeDebts.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-64 flex-col">
                <EmptyState
                  icon={CreditCardIcon}
                  title="No debts yet"
                  description="Add your first loan to start tracking its balance."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeDebts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} capitalPagos={capitalByDebt[debt.id] ?? []} onChanged={refetch} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {debts && archivedDebts.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-64 flex-col">
                <EmptyState icon={CreditCardIcon} title="No paid off debts yet" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedDebts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} capitalPagos={capitalByDebt[debt.id] ?? []} onChanged={refetch} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DebtFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => refetch()} />
    </div>
  )
}
