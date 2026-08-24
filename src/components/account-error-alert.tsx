import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ACCOUNT_ERROR_MESSAGES, type AccountErrorCode } from '@/lib/account-errors'

export function AccountErrorAlert({ code }: { code: AccountErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{ACCOUNT_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
