import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { INVESTMENT_ERROR_MESSAGES, type InvestmentErrorCode } from '@/lib/investment-errors'

export function InvestmentErrorAlert({ code }: { code: InvestmentErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{INVESTMENT_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
