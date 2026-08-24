import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

const CONFIRM_PHRASE = 'DELETE MY DATA'

// Borra todo el contenido del usuario (cuentas, categorías, transacciones, presupuesto, metas,
// inversiones, deudas) vía el RPC clean_my_data y vuelve a sembrar las categorías por defecto —
// mismo estado que un primer login. Nunca toca el renglón de login/perfil. Irreversible, así que
// exige escribir la frase exacta antes de habilitar el botón de confirmar, y al terminar hace un
// full reload en vez de intentar refrescar cada hook de la app por separado.
export function CleanDataDialog() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(false)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(false)

    const { error: opError } = await supabase.rpc('clean_my_data')

    if (opError) {
      setIsSubmitting(false)
      setError(true)
      return
    }

    window.location.href = '/'
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmText('')
          setError(false)
        }
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="sm" className="w-full justify-start" />}>
        Clean my data
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (confirmText === CONFIRM_PHRASE) handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Clean my data</DialogTitle>
            <DialogDescription>
              This permanently deletes all your accounts, categories, transactions, budget,
              savings goals, investments, and debts — everything starts over as if you had just
              logged in for the first time. Your login itself isn't affected. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clean-data-confirm">
              Type <span className="font-mono font-medium text-foreground">{CONFIRM_PHRASE}</span>{' '}
              to confirm
            </Label>
            <Input
              id="clean-data-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={confirmText !== CONFIRM_PHRASE || isSubmitting}
            >
              {isSubmitting ? 'Deleting…' : 'Delete everything'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
