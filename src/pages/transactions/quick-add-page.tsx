import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'

// Captura rápida (`/add`): abre el modal de alta en cuanto carga, sin pasar por el Dashboard ni por
// el botón flotante. Existe para un acceso directo en la pantalla de inicio del teléfono — un toque
// y el formulario ya está abierto, que es lo que el usuario tenía antes con un formulario suelto en
// Netlify. Es la misma pantalla de alta de siempre (no una copia): monta el AddTransactionDialog
// directo en vez de usar el modal global de AddTransactionProvider, porque esta pantalla sí necesita
// enterarse de cuándo se cierra para saber a dónde ir después, y el provider no expone eso.
export function QuickAddPage() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const guardada = useRef(false)

  // La navegación vive en un efecto y no dentro de los callbacks porque el modal llama
  // `onOpenChange(false)` ANTES que `onSuccess`: navegar en ambos dejaría el destino a merced del
  // orden. El efecto corre después de los dos, cuando ya se sabe si hubo alta o no.
  useEffect(() => {
    if (open) return
    // Tras guardar, el listado de Transacciones es la confirmación: el movimiento aparece hasta
    // arriba. Si se canceló, no hay nada que confirmar y se vuelve al Dashboard.
    navigate(guardada.current ? '/transactions' : '/', { replace: true })
  }, [open, navigate])

  return (
    <AddTransactionDialog
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => {
        guardada.current = true
      }}
    />
  )
}
