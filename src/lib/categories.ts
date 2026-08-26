export type CategoryKind = 'grupo' | 'categoria'
export type CategoryStatus = 'active' | 'archived'
export type CategoryFlow = 'inflow' | 'outflow' | 'investment'

export const CATEGORY_FLOW_LABELS: Record<CategoryFlow, string> = {
  inflow: 'Inflow',
  outflow: 'Outflow',
  investment: 'Investment',
}

export interface CategoryGroup {
  id: string
  user_id: string
  tipo: 'grupo'
  nombre: string
  grupo_id: null
  color: string
  icono: null
  flujo: CategoryFlow
  orden: number
  status: CategoryStatus
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  tipo: 'categoria'
  nombre: string
  grupo_id: string
  color: null
  icono: string
  flujo: null
  orden: null
  status: CategoryStatus
  created_at: string
  updated_at: string
}

export const DEFAULT_CATEGORY_ICON = 'generic'
