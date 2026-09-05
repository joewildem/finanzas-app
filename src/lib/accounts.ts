import type { TransactionType } from '@/lib/transactions'

export type AccountType = 'debito' | 'credito' | 'efectivo'
export type AccountStatus = 'active' | 'archived'

export interface Account {
  id: string
  user_id: string
  nombre: string
  tipo: AccountType
  saldo_inicial: number
  saldo_actual: number
  imagen_url: string | null
  color: string
  excluir_de_stats: boolean
  linea_credito: number | null
  dia_corte: number | null
  dia_pago: number | null
  gasto_minimo_mensual: number | null
  status: AccountStatus
  created_at: string
  updated_at: string
}

// El historial de una cuenta trae todos sus movimientos, no solo los ajustes — `tipo` estaba
// declarado como `'ajuste'` desde que solo se usaba para pintar concepto/monto/fecha, y quedaba
// mintiendo sobre lo que la consulta realmente devuelve (`select('*')`, ver use-account.ts).
export interface AccountTransaction {
  id: string
  user_id: string
  account_id: string
  tipo: TransactionType
  concepto: string
  monto: number
  fecha: string
  msi_meses: number | null
  created_at: string
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  debito: 'Debit',
  credito: 'Credit',
  efectivo: 'Cash',
}

export const DEFAULT_ACCOUNT_COLOR = '#9CA3AF'

// Tamaño fijo para la imagen de cuenta (relación de tarjeta bancaria estándar, 85.6x53.98mm) —
// se usa tanto en el preview de carga como en las cards del listado, para que ambos coincidan.
export const ACCOUNT_IMAGE_ASPECT_RATIO = '1.586 / 1'
export const ACCOUNT_IMAGE_ASPECT_CLASS = 'aspect-[1.586/1]'

// RN-013: crédito disponible, calculado al vuelo — nunca se almacena.
export function computeAvailableCredit(lineaCredito: number, saldoActual: number): number {
  return lineaCredito - Math.abs(saldoActual)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Igual que `formatCurrency` pero con el signo siempre explícito ("+$4,100.00" / "-$890.00"). Se usa
// en el historial de movimientos, donde el signo es la información principal de la fila: distingue de
// un vistazo lo que entró de lo que salió. El cero no lleva signo.
export function formatCurrencySigned(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'exceptZero',
  }).format(amount)
}
