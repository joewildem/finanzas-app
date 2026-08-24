import { cn } from '@/lib/utils'

// CU-052, paso 4 del flujo — mientras el usuario edita, el sistema recalcula en pantalla la suma de
// los porcentajes objetivo del conjunto activo resultante (RN-159: debe cerrar en exactamente 100%,
// o 0 si no queda ningún instrumento activo) y la diferencia respecto a 100%.
export function PortfolioConfigBar({ sumActivePercent }: { sumActivePercent: number }) {
  const isValid = sumActivePercent === 0 || Math.abs(sumActivePercent - 100) < 0.005
  const diff = 100 - sumActivePercent

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm',
        isValid ? 'border-border bg-muted/40' : 'border-destructive/40 bg-destructive/10',
      )}
    >
      <span className="text-muted-foreground">Active instruments target allocation</span>
      <span className={cn('font-mono font-medium', isValid ? 'text-foreground' : 'text-destructive')}>
        {sumActivePercent.toFixed(2)}%
        {!isValid && sumActivePercent !== 0 && (
          <span className="ml-2 font-sans font-normal">
            ({diff > 0 ? `${diff.toFixed(2)}% short of 100%` : `${Math.abs(diff).toFixed(2)}% over 100%`})
          </span>
        )}
      </span>
    </div>
  )
}
