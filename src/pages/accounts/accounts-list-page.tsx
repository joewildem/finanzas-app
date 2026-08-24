import { useState } from 'react'
import { Wallet01Icon } from '@hugeicons/core-free-icons'
import { Link } from 'react-router-dom'

import { AccountCardTile } from '@/components/accounts/account-card-tile'
import { AccountFormDialog } from '@/components/accounts/account-form-dialog'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAccounts } from '@/hooks/use-accounts'

// CU-002 — listado de cuentas, activas por defecto con toggle para incluir archivadas.
export function AccountsListPage() {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { accounts, refetch } = useAccounts(includeArchived)

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

      {accounts && accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} to={`/settings/accounts/${account.id}`}>
              <AccountCardTile account={account} />
            </Link>
          ))}
        </div>
      )}

      <AccountFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
