import type { IconSvgElement } from '@hugeicons/react'
import { BankIcon, BanknoteIcon, CreditCardIcon } from '@hugeicons/core-free-icons'

import type { AccountType } from '@/lib/accounts'

// Ícono por defecto por tipo cuando la cuenta no tiene imagen (CU-001: "ícono por defecto según
// tipo"). Sin referencia de Figma para este detalle — elección razonable de Hugeicons.
export const ACCOUNT_TYPE_ICONS: Record<AccountType, IconSvgElement> = {
  debito: BankIcon,
  credito: CreditCardIcon,
  efectivo: BanknoteIcon,
}
