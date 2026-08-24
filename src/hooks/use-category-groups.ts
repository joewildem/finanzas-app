import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Category, CategoryGroup } from '@/lib/categories'

export interface CategoryGroupWithChildren {
  group: CategoryGroup
  categories: Category[]
}

// CU-009 — vista jerárquica: una sola consulta a `categories`, agrupada en el cliente por
// `grupo_id` (volumen bajo por usuario — el propio CU descarta un endpoint de agregación
// dedicado). `includeArchived` es el mismo toggle local usado en Cuentas, no un query param.
export function useCategoryGroups(includeArchived: boolean) {
  const [groups, setGroups] = useState<CategoryGroupWithChildren[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    let query = supabase.from('categories').select('*').order('nombre', { ascending: true })
    if (!includeArchived) {
      query = query.eq('status', 'active')
    }
    const { data, error } = await query
    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const all = data as (CategoryGroup | Category)[]
    // RN-119 — el orden de despliegue de los grupos es manual (`orden`), no alfabético; las
    // categorías dentro de cada grupo siguen alfabéticas (orden del `.order('nombre')` de arriba).
    const groupRows = all
      .filter((row): row is CategoryGroup => row.tipo === 'grupo')
      .sort((a, b) => a.orden - b.orden)
    const categoryRows = all.filter((row): row is Category => row.tipo === 'categoria')

    setGroups(
      groupRows.map((group) => ({
        group,
        categories: categoryRows.filter((category) => category.grupo_id === group.id),
      })),
    )
  }, [includeArchived])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { groups, error, refetch }
}
