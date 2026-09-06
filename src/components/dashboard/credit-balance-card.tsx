import { Link } from 'react-router-dom'

import type { CycleSpend } from '@/hooks/use-credit-cards-cycle-spend'
import { ACCOUNT_IMAGE_ASPECT_CLASS, computeAvailableCredit, formatCurrency, type Account } from '@/lib/accounts'
import { formatPercent } from '@/lib/utils'

// CU-063 — mismo shell visual que AccountCardTile (imagen de fondo o degradado por color, scrim
// para legibilidad) y misma estructura de contenido: nombre y saldo centrados, un renglón anclado
// abajo. Lo propio de una tarjeta de crédito es qué ocupa ese renglón: la barra de utilización de
// línea (RN-234) en vez del tipo de cuenta, que aquí no aporta nada porque siempre es `credito`.
//
// El avance de gasto del ciclo (RN-236/RN-237) vive como chip junto al saldo y no como una segunda
// barra: solo algunas tarjetas tienen `gasto_minimo_mensual`, y colgar de él un bloque entero hacía
// que unas cards se estructuraran distinto de otras dentro de la misma cuadrícula.
//
// Enlaza al detalle de cuenta del Dashboard, igual que AccountCardTile.
export function CreditBalanceCard({ account, cycleSpend }: { account: Account; cycleSpend?: CycleSpend }) {
  const hasImage = Boolean(account.imagen_url)
  const lineaCredito = account.linea_credito ?? 0
  const porcentajeUtilizado = lineaCredito > 0 ? Math.abs(account.saldo_actual) / lineaCredito : 0
  const disponible = computeAvailableCredit(lineaCredito, account.saldo_actual)

  const gastoMinimo = account.gasto_minimo_mensual ?? 0
  const showCycle = gastoMinimo > 0 && cycleSpend !== undefined

  return (
    <Link
      to={`/accounts/${account.id}`}
      className={`relative block overflow-hidden rounded-xl ${ACCOUNT_IMAGE_ASPECT_CLASS}`}
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

        {/* El hueco del chip se reserva siempre, tenga o no la tarjeta un mínimo configurado. Es la
            única forma de que dos cards lado a lado empiecen el nombre a la misma altura: dentro del
            bloque centrado, el chip lo hacía más alto y empujaba el nombre hacia arriba solo en las
            tarjetas que lo tienen. Aquí el espacio existe siempre y lo único que cambia es si está
            ocupado. */}
        <div className="flex h-6 shrink-0 items-center">
          {showCycle && (
            <span className="truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80">
              Cycle: {formatCurrency(cycleSpend!.gasto_ciclo_actual)} / {formatCurrency(gastoMinimo)}
            </span>
          )}
        </div>

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
      </div>
    </Link>
  )
}
