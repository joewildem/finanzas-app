import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { SAVINGS_ERROR_MESSAGES, type SavingsErrorCode } from '@/lib/savings-errors'

export function SavingsErrorAlert({ code }: { code: SavingsErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{SAVINGS_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
