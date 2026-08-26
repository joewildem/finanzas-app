import type { CycleSpend } from '@/hooks/use-credit-cards-cycle-spend'
import { ACCOUNT_IMAGE_ASPECT_CLASS, computeAvailableCredit, formatCurrency, type Account } from '@/lib/accounts'
import { formatPercent } from '@/lib/utils'

// CU-063 — mismo shell visual que AccountCardTile (imagen de fondo o degradado por color, scrim
// para legibilidad), pero con contenido propio de tarjeta de crédito: barra de utilización de línea
// de crédito (RN-234) y, si `gasto_minimo_mensual` está configurado, una segunda barra con el
// avance de gasto del ciclo de corte en curso (RN-236/RN-237) — ambas ancladas abajo en vez del
// renglón "tipo" que usa AccountCardTile, porque aquí no aplica (siempre es `credito`).
export function CreditBalanceCard({ account, cycleSpend }: { account: Account; cycleSpend?: CycleSpend }) {
  const hasImage = Boolean(account.imagen_url)
  const lineaCredito = account.linea_credito ?? 0
  const porcentajeUtilizado = lineaCredito > 0 ? Math.abs(account.saldo_actual) / lineaCredito : 0
  const disponible = computeAvailableCredit(lineaCredito, account.saldo_actual)

  const gastoMinimo = account.gasto_minimo_mensual ?? 0
  const showCycle = gastoMinimo > 0 && cycleSpend !== undefined
  const porcentajeAvanceMinimo = showCycle ? Math.min(cycleSpend!.gasto_ciclo_actual / gastoMinimo, 1) : 0

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${ACCOUNT_IMAGE_ASPECT_CLASS}`}
      style={
        hasImage
          ? undefined
          : {
              background: `linear-gradient(135deg, ${account.color}, color-mix(in srgb, ${account.color} 55%, black))`,
            }
      }
    >
      {hasImage && (
        <img src={account.imagen_url!} alt="" className="absolute inset-0 size-full object-cover" />
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t ${hasImage ? 'from-black/80 via-black/10' : 'from-black/40'} to-transparent`}
      />

      <div className="relative flex h-full flex-col p-4">
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <p className="truncate text-sm font-medium text-white/80">{account.nombre}</p>
          <p className="font-mono text-2xl font-medium text-white">{formatCurrency(account.saldo_actual)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-destructive"
                style={{ width: `${Math.min(porcentajeUtilizado, 1) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-white/70">
              <span>{formatPercent(porcentajeUtilizado * 100)} used</span>
              <span>{formatCurrency(disponible)} available</span>
            </div>
          </div>

          {showCycle && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${porcentajeAvanceMinimo * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-white/70">
                {formatCurrency(cycleSpend!.gasto_ciclo_actual)} of {formatCurrency(gastoMinimo)} this cycle
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
