import { formatCurrencySigned } from '@/lib/accounts'
import { cn } from '@/lib/utils'

// Monto de un renglón del historial de movimientos, con el mismo tratamiento en todas las pantallas
// donde ese historial aparece: detalle de cuenta, detalle de meta de ahorro, detalle de deuda y el
// listado general de transacciones. Rojo y en negativo lo que salió, verde y en positivo lo que
// entró. El signo se muestra siempre —no solo cuando es negativo— porque en una lista de movimientos
// es el dato que más rápido se lee, y mostrarlo únicamente en un sentido obligaba a deducir el otro.
//
// Vive como componente y no como un par de helpers sueltos para que las cuatro pantallas no puedan
// divergir: antes cada una repetía la misma expresión ternaria por su cuenta.
export function MovementAmount({ monto, className }: { monto: number; className?: string }) {
  return (
    <p
      className={cn(
        'font-mono text-sm',
        monto < 0 && 'text-destructive',
        monto > 0 && 'text-success',
        monto === 0 && 'text-card-foreground',
        className,
      )}
    >
      {formatCurrencySigned(monto)}
    </p>
  )
}
