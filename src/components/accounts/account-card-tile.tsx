import { Badge } from '@/components/ui/badge'
import { ACCOUNT_IMAGE_ASPECT_CLASS, ACCOUNT_TYPE_LABELS, formatCurrency, type Account } from '@/lib/accounts'

// CU-002 — card estilo tarjeta bancaria: usa la imagen cargada en CU-001/CU-004 como fondo si
// existe; si no, un degradado a partir de `color` para que toda cuenta se vea "con tarjeta" de
// forma consistente, no solo las que tienen foto. Misma relación de aspecto que el campo de carga
// de imagen (ACCOUNT_IMAGE_ASPECT_CLASS) — lo que se recorta en el formulario es lo que se ve aquí.
export function AccountCardTile({ account }: { account: Account }) {
  const hasImage = Boolean(account.imagen_url)
  const hasBadges = account.excluir_de_stats || account.status === 'archived'

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${ACCOUNT_IMAGE_ASPECT_CLASS} ${
        account.status === 'archived' ? 'opacity-60' : ''
      }`}
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

      {/* Scrim para legibilidad del texto — más fuerte sobre foto, sutil sobre color plano. */}
      <div
        className={`absolute inset-0 bg-gradient-to-t ${
          hasImage ? 'from-black/80 via-black/10' : 'from-black/40'
        } to-transparent`}
      />

      <div className="relative flex h-full flex-col p-4">
        {hasBadges && (
          <div className="flex flex-col items-end gap-1 self-end">
            {account.excluir_de_stats && (
              <Badge variant="secondary" className="bg-white/15 text-white">
                Excluded
              </Badge>
            )}
            {account.status === 'archived' && (
              <Badge variant="secondary" className="bg-white/15 text-white">
                Archived
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-1 items-center justify-start pt-3">
          <p className="font-mono text-3xl font-medium text-white">
            {formatCurrency(account.saldo_actual)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-white/80">{account.nombre}</p>
          <p className="text-xs text-white/70">{ACCOUNT_TYPE_LABELS[account.tipo]}</p>
        </div>
      </div>
    </div>
  )
}
