import type { IconSvgElement } from '@hugeicons/react'
import {
  BanknoteArrowUpIcon,
  Calendar03Icon,
  CardExchange01Icon,
  MoneyBag01Icon,
  PiggyBankIcon,
  SelfTransferIcon,
  SlidersHorizontalIcon,
} from '@hugeicons/core-free-icons'

export type TransactionType =
  | 'ajuste'
  | 'gasto'
  | 'ingreso'
  | 'transferencia'
  | 'pago_tarjeta'
  | 'aportacion_meta'
  | 'retiro_meta'
  | 'pago_deuda'
  | 'compra_msi'

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  tipo: TransactionType
  category_id: string | null
  transaccion_relacionada_id: string | null
  meta_id: string | null
  deuda_id: string | null
  monto_capital: number | null
  monto_interes: number | null
  msi_meses: number | null
  msi_mes_inicio: string | null
  concepto: string
  monto: number
  nota: string | null
  fecha: string
  created_at: string
  updated_at: string
}

// CU-016 (listado) — etiqueta e ícono por tipo de movimiento. `gasto`/`ingreso` se muestran con el
// ícono de su categoría en vez de este mapa (ver TransactionRow); quedan aquí solo por completitud
// de tipo.
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  ajuste: 'Balance adjustment',
  gasto: 'Expense',
  ingreso: 'Income',
  transferencia: 'Transfer',
  pago_tarjeta: 'Card payment',
  aportacion_meta: 'Goal contribution',
  retiro_meta: 'Goal withdrawal',
  pago_deuda: 'Debt payment',
  compra_msi: 'Installment purchase',
}

export const TRANSACTION_TYPE_ICONS: Partial<Record<TransactionType, IconSvgElement>> = {
  ajuste: SlidersHorizontalIcon,
  transferencia: SelfTransferIcon,
  pago_tarjeta: CardExchange01Icon,
  aportacion_meta: PiggyBankIcon,
  retiro_meta: MoneyBag01Icon,
  pago_deuda: BanknoteArrowUpIcon,
  compra_msi: Calendar03Icon,
}
