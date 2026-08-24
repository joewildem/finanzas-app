import { useState } from 'react'
import { Wallet01Icon } from '@hugeicons/core-free-icons'

import { AccountFormDialog } from '@/components/accounts/account-form-dialog'
import { AccountListItem } from '@/components/accounts/account-list-item'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAccounts } from '@/hooks/use-accounts'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/lib/accounts'

const ACCOUNT_TYPE_ORDER: AccountType[] = ['debito', 'credito', 'efectivo']

// CU-002 — listado de cuentas, activas por defecto con toggle para incluir archivadas. Agrupado
// por tipo (Debit/Credit/Cash) como una lista compacta en vez de la card bancaria completa — esa
// vista se sentía muy apretada una vez que Accounts se movió a Settings (ancho reducido).
export function AccountsListPage() {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { accounts, refetch } = useAccounts(includeArchived)

  const groupedAccounts = ACCOUNT_TYPE_ORDER.map((tipo) => ({
    tipo,
    accounts: (accounts ?? []).filter((account) => account.tipo === tipo),
  })).filter((group) => group.accounts.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground">Your debit, credit, and cash accounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add account</Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="include-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
        <label htmlFor="include-archived" className="text-sm text-muted-foreground">
          Include archived accounts
        </label>
      </div>

      {accounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex min-h-64 flex-col">
            <EmptyState
              icon={Wallet01Icon}
              title="No accounts yet"
              description="Add your first account to start tracking balances."
            />
          </CardContent>
        </Card>
      )}

      {groupedAccounts.map(({ tipo, accounts: accountsInGroup }) => (
        <Card key={tipo}>
          <CardHeader>
            <CardTitle>{ACCOUNT_TYPE_LABELS[tipo]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {accountsInGroup.map((account) => (
                <AccountListItem key={account.id} account={account} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <AccountFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
