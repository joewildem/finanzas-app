import { Link } from 'react-router-dom'

import { ACCOUNT_IMAGE_ASPECT_CLASS, computeAvailableCredit, formatCurrency, type Account } from '@/lib/accounts'
import { formatPercent } from '@/lib/utils'

// CU-063 — mismo shell visual que AccountCardTile (imagen de fondo o degradado por color, scrim
// para legibilidad) y misma estructura de contenido: nombre y saldo centrados, un renglón anclado
// abajo. Lo propio de una tarjeta de crédito es qué ocupa ese renglón: la barra de utilización de
// línea (RN-234) en vez del tipo de cuenta, que aquí no aporta nada porque siempre es `credito`.
//
// El avance de gasto del ciclo (RN-236/RN-237) **no se muestra aquí por ahora**: la regla y su
// cálculo siguen vigentes —el hook `use-credit-cards-cycle-spend` está intacto— pero su lugar en la
// interfaz está por decidirse. Cuando se reintegre, el criterio a respetar es que la card mida y se
// estructure igual tenga o no `gasto_minimo_mensual` configurado.
//
// Enlaza al detalle de cuenta del Dashboard, igual que AccountCardTile.
export function CreditBalanceCard({ account }: { account: Account }) {
  const hasImage = Boolean(account.imagen_url)
  const lineaCredito = account.linea_credito ?? 0
  const porcentajeUtilizado = lineaCredito > 0 ? Math.abs(account.saldo_actual) / lineaCredito : 0
  const disponible = computeAvailableCredit(lineaCredito, account.saldo_actual)

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
