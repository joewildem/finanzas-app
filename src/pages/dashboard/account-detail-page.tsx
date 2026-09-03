import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { useNavigate, useParams } from 'react-router-dom'

import { AccountDetailContent } from '@/components/accounts/account-detail-content'
import { Button } from '@/components/ui/button'

// Vista de detalle de cuenta enlazada desde las cards de la pestaña Balance del Dashboard
// (AccountCardTile/CreditBalanceCard) — mismo contenido que account-detail-page.tsx de Settings,
// pero sin el menú lateral (esta ruta vive fuera de /settings) y con su propio botón "Back" en vez
// de la navegación del sidebar.
export function DashboardAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" className="w-fit" onClick={() => navigate('/')}>
        <HugeiconsIcon icon={ArrowLeft01Icon} />
        Back
      </Button>

      <AccountDetailContent accountId={accountId} />
    </div>
  )
}
