import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'

// Prefill del modal global para el chip "Savings" (RPC create_goal_contribution) — abierto desde el
// detalle de una meta o desde el menú de acciones de su card, con el tipo y la meta ya elegidos,
// para que solo falte capturar monto/cuenta/fecha/nota.
export interface AddTransactionPrefill {
  chip: 'goal_contribution'
  goalId: string
}

interface AddTransactionContextValue {
  openAddTransaction: (onSuccess?: () => void, prefill?: AddTransactionPrefill) => void
  subscribe: (listener: () => void) => () => void
}

const AddTransactionContext = createContext<AddTransactionContextValue | null>(null)

// Monta un único AddTransactionDialog a nivel de AppShell (CU-013) para que cualquier botón
// "Add record" — header, Dashboard, y los que vengan después — lo abra sin duplicar estado ni
// prop-drilling entre páginas. El botón del header no sabe qué página está montada, así que no
// puede pasarle un `onSuccess` específico (a diferencia del botón propio de CU-016, que usa su
// propia instancia de AddTransactionDialog con `onSuccess={refetch}` directo) — `subscribe` deja
// que cualquier página se registre para enterarse de un alta exitosa sin importar desde dónde se
// haya abierto el modal, evitando que el listado quede desactualizado tras usar el botón global.
export function AddTransactionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<AddTransactionPrefill | undefined>(undefined)
  const onSuccessRef = useRef<(() => void) | undefined>(undefined)
  const listenersRef = useRef<Set<() => void>>(new Set())

  function openAddTransaction(onSuccess?: () => void, nextPrefill?: AddTransactionPrefill) {
    onSuccessRef.current = onSuccess
    setPrefill(nextPrefill)
    setOpen(true)
  }

  function subscribe(listener: () => void) {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }

  function handleSuccess() {
    onSuccessRef.current?.()
    listenersRef.current.forEach((listener) => listener())
  }

  return (
    <AddTransactionContext.Provider value={{ openAddTransaction, subscribe }}>
      {children}
      <AddTransactionDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
        initialChip={prefill?.chip}
        initialGoalId={prefill?.goalId}
      />
    </AddTransactionContext.Provider>
  )
}

export function useAddTransaction(): AddTransactionContextValue {
  const context = useContext(AddTransactionContext)
  if (!context) {
    throw new Error('useAddTransaction must be used within an AddTransactionProvider')
  }
  return context
}
