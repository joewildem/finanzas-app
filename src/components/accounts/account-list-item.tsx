import { Link } from 'react-router-dom'

import { AccountAvatar } from '@/components/accounts/account-avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, type Account } from '@/lib/accounts'

// Renglón de lista para el listado de Accounts (imagen | nombre | balance) — reemplaza la card
// bancaria completa (AccountCardTile) en este listado por decisión explícita del usuario: la vista
// de card se sentía muy apretada agrupada por tipo, esto se ve más como una tabla compacta.
export function AccountListItem({ account }: { account: Account }) {
  return (
    <Link
      to={`/settings/accounts/${account.id}`}
      className={`flex items-center gap-3 py-3 outline-none focus-visible:bg-muted ${
        account.status === 'archived' ? 'opacity-60' : ''
      }`}
    >
      <AccountAvatar account={account} className="h-10" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-card-foreground">{account.nombre}</span>
        {account.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
        {account.excluir_de_stats && <Badge variant="secondary">Excluded</Badge>}
      </div>
      <p
        className={`shrink-0 font-mono text-sm ${
          account.saldo_actual < 0 ? 'text-destructive' : 'text-card-foreground'
        }`}
      >
        {formatCurrency(account.saldo_actual)}
      </p>
    </Link>
  )
}
