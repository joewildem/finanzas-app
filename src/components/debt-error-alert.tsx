import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { DEBT_ERROR_MESSAGES, type DebtErrorCode } from '@/lib/debt-errors'

export function DebtErrorAlert({ code }: { code: DebtErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{DEBT_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
