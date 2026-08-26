import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// CU-068 — modal "Change goal"/"Set a goal". Sin RPC: `onSave` hace un upsert directo sobre
// `networth_goals` (mismo patrón "capturado a mano, sin RPC" que el resto de formularios simples,
// ej. SavingsGoalFormDialog). VALIDATION_037 se valida en cliente antes de guardar.
export function ChangeNetworthGoalDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValue: number | null
  onSave: (monto: number) => Promise<{ error: string | null }>
}) {
  const [amount, setAmount] = useState<number | undefined>(initialValue ?? undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(initialValue ?? undefined)
      setErrorMessage(null)
    }
  }, [open, initialValue])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!amount || amount <= 0) {
      setErrorMessage('The goal amount must be greater than zero.')
      return
    }

    setIsSubmitting(true)
    const { error } = await onSave(amount)
    setIsSubmitting(false)
    if (error) {
      setErrorMessage('Something went wrong. Please try again.')
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initialValue ? 'Change goal' : 'Set a goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMessage && (
            <Alert variant="destructive">
              <HugeiconsIcon icon={AlertCircleIcon} />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="networth_goal_monto">Target Networth</Label>
            <CurrencyInput id="networth_goal_monto" autoFocus value={amount} onChange={setAmount} allowEmpty />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
