import { useParams } from 'react-router-dom'

import { AccountDetailContent } from '@/components/accounts/account-detail-content'

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  return <AccountDetailContent accountId={accountId} />
}
