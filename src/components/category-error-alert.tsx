import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { CATEGORY_ERROR_MESSAGES, type CategoryErrorCode } from '@/lib/category-errors'

export function CategoryErrorAlert({ code }: { code: CategoryErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{CATEGORY_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
