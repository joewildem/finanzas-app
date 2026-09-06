import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { SUBSCRIPTION_ERROR_MESSAGES, type SubscriptionErrorCode } from '@/lib/subscription-errors'

export function SubscriptionErrorAlert({ code }: { code: SubscriptionErrorCode | null }) {
  if (!code) return null

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{SUBSCRIPTION_ERROR_MESSAGES[code]}</AlertDescription>
    </Alert>
  )
}
