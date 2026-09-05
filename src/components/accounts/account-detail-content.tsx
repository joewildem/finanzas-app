import { useState } from 'react'
import { SearchRemoveIcon } from '@hugeicons/core-free-icons'

import { AccountAvatar } from '@/components/accounts/account-avatar'
import { AccountFormDialog } from '@/components/accounts/account-form-dialog'
import { AdjustBalanceDialog } from '@/components/accounts/adjust-balance-dialog'
import { ArchiveAccountDialog } from '@/components/accounts/archive-account-dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { CreditCardMsiSection } from '@/components/accounts/credit-card-msi-section'
import { MovementAmount } from '@/components/movement-amount'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccount } from '@/hooks/use-account'
import { useMsiPlans } from '@/hooks/use-msi-plans'
import { ACCOUNT_TYPE_LABELS, computeAvailableCredit, formatCurrency } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

// Contenido de detalle de cuenta (CU-003) — compartido entre la página de Settings
// (settings-layout.tsx, con el menú lateral) y la vista de solo-detalle enlazada desde las cards del
// Dashboard (dashboard/account-detail-page.tsx, sin ese menú, con botón "Back" propio). Cada página
// solo aporta su propio "chrome" alrededor de este componente.
export function AccountDetailContent({ accountId }: { accountId: string | undefined }) {
  const { account, movements, refetch } = useAccount(accountId)
  const { plans: msiPlans, refetch: refetchMsiPlans } = useMsiPlans()
  const [editOpen, setEditOpen] = useState(false)

  if (account === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (account === null) {
    return <EmptyState icon={SearchRemoveIcon} title="Account not found" />
  }

  async function handleReactivate() {
    if (!accountId) return
    await supabase.from('accounts').update({ status: 'active' }).eq('id', accountId).eq('status', 'archived')
    refetch()
  }

  const disponible =
    account.tipo === 'credito' && account.linea_credito != null
      ? computeAvailableCredit(account.linea_credito, account.saldo_actual)
      : null

  // MSI (sin PRD todavía, ver supabase/migrations/20260903100000_*) — planes de esta tarjeta,
  // recientes primero (useMsiPlans ya ordena por fecha desc), con su estatus a la fecha de hoy.
  const accountMsiPlans = (msiPlans ?? []).filter((plan) => plan.accountId === account.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AccountAvatar account={account} className="h-12" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-medium text-foreground">{account.nombre}</h1>
              {account.excluir_de_stats && <Badge variant="secondary">Excluded from stats</Badge>}
              {account.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.tipo]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          {account.status === 'active' ? (
            <>
              <AdjustBalanceDialog
                accountId={account.id}
                currentBalance={account.saldo_actual}
                onAdjusted={refetch}
              />
              <ArchiveAccountDialog accountId={account.id} onArchived={refetch} />
            </>
          ) : (
            <button onClick={handleReactivate} className={buttonVariants({ variant: 'outline' })}>
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Current balance</p>
              <p className="font-mono text-2xl text-card-foreground">
                {formatCurrency(account.saldo_actual)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Initial balance</p>
              <p className="font-mono text-2xl text-card-foreground">
                {formatCurrency(account.saldo_inicial)}
              </p>
            </div>
            {account.tipo === 'credito' && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Credit limit</p>
                  <p className="font-mono text-lg text-card-foreground">
                    {formatCurrency(account.linea_credito ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available credit</p>
                  <p className="font-mono text-lg text-card-foreground">
                    {disponible != null ? formatCurrency(disponible) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statement day</p>
                  <p className="text-card-foreground">{account.dia_corte}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment due day</p>
                  <p className="text-card-foreground">{account.dia_pago}</p>
                </div>
                {account.gasto_minimo_mensual != null && account.gasto_minimo_mensual > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Minimum monthly spend</p>
                    <p className="text-card-foreground">{formatCurrency(account.gasto_minimo_mensual)}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {account.tipo === 'credito' && (
        <CreditCardMsiSection
          accountId={account.id}
          plans={accountMsiPlans}
          movements={movements}
          onChanged={() => {
            refetch()
            refetchMsiPlans()
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {movements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-card-foreground">{movement.concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(movement.fecha).toLocaleDateString()}
                    </p>
                  </div>
                  <MovementAmount monto={movement.monto} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AccountFormDialog
        mode="edit"
        account={account}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
