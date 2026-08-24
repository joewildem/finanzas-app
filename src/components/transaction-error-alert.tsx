import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { TRANSACTION_ERROR_MESSAGES, type TransactionErrorCode } from '@/lib/transaction-errors'

export function TransactionErrorAlert({ code }: { code: TransactionErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{TRANSACTION_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
