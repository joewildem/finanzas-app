import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BUDGET_ERROR_MESSAGES, type BudgetErrorCode } from '@/lib/budget-errors'

export function BudgetErrorAlert({ code }: { code: BudgetErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{BUDGET_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
