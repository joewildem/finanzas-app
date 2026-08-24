import { HugeiconsIcon } from '@hugeicons/react'

import { ACCOUNT_TYPE_ICONS } from '@/lib/account-icons'
import { ACCOUNT_IMAGE_ASPECT_CLASS, type Account } from '@/lib/accounts'
import { cn } from '@/lib/utils'

// Miniatura rectangular (no circular) de la cuenta — misma relación de aspecto que el resto de la
// imagen de cuenta (ACCOUNT_IMAGE_ASPECT_CLASS), solo que en pequeño; con fallback al color+icono
// del tipo de cuenta cuando no hay imagen cargada.
export function AccountAvatar({ account, className }: { account: Account; className?: string }) {
  return (
    <div
      className={cn(
        `h-10 w-auto shrink-0 overflow-hidden rounded-lg ring-1 ring-border ${ACCOUNT_IMAGE_ASPECT_CLASS}`,
        className,
      )}
    >
      {account.imagen_url ? (
        <img src={account.imagen_url} alt="" className="size-full object-cover" />
      ) : (
        <div
          className="flex size-full items-center justify-center"
          style={{ backgroundColor: account.color }}
        >
          <HugeiconsIcon icon={ACCOUNT_TYPE_ICONS[account.tipo]} className="size-4 text-white" />
        </div>
      )}
    </div>
  )
}
