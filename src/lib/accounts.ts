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

export interface AccountTransaction {
  id: string
  user_id: string
  account_id: string
  tipo: 'ajuste'
  concepto: string
  monto: number
  fecha: string
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
