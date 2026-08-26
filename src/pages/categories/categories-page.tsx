import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronDownIcon, ChevronUpIcon, Shapes01Icon } from '@hugeicons/core-free-icons'

import { ArchiveCategoryDialog } from '@/components/categories/archive-category-dialog'
import { CategoryFormDialog } from '@/components/categories/category-form-dialog'
import { CategoryGroupFormDialog } from '@/components/categories/category-group-form-dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useCategoryGroups } from '@/hooks/use-category-groups'
import { CATEGORY_FLOW_LABELS, type Category, type CategoryGroup } from '@/lib/categories'
import { getCategoryIcon } from '@/lib/category-icons'
import { supabase } from '@/lib/supabase'

type GroupDialogState = 'create' | CategoryGroup | null
type CategoryDialogState = { mode: 'create'; groupId: string } | { mode: 'edit'; category: Category } | null

// CU-009 — vista jerárquica de grupos y categorías, con toggle para incluir ocultos (mismo patrón
// que AccountsListPage). Cada modal de creación/edición es una sola instancia siempre montada,
// controlada por "qué elemento se está editando" — evita cortar la animación de salida al des-
// montar el Dialog a mitad de cierre.
export function CategoriesPage() {
  const [includeArchived, setIncludeArchived] = useState(false)
  const { groups, refetch } = useCategoryGroups(includeArchived)

  const [groupDialogState, setGroupDialogState] = useState<GroupDialogState>(null)
  const [categoryDialogState, setCategoryDialogState] = useState<CategoryDialogState>(null)

  const activeGroups = (groups ?? []).map((entry) => entry.group).filter((g) => g.status === 'active')

  async function handleReactivateGroup(groupId: string) {
    await supabase.from('categories').update({ status: 'active' }).eq('id', groupId).eq('status', 'archived')
    refetch()
  }

  async function handleReactivateCategory(categoryId: string) {
    await supabase.from('categories').update({ status: 'active' }).eq('id', categoryId).eq('status', 'archived')
    refetch()
  }

  // RN-119 — reordena un grupo intercambiando su `orden` con el del vecino inmediato en la lista ya
  // ordenada (useCategoryGroups la entrega ordenada por `orden`). Dos updates directos, sin RPC,
  // mismo patrón sin-transacción que handleReactivateGroup — riesgo de condición de carrera
  // despreciable en una app cerrada de <5 usuarios.
  async function handleMoveGroup(index: number, direction: 'up' | 'down') {
    const allGroups = (groups ?? []).map((entry) => entry.group)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= allGroups.length) return

    const a = allGroups[index]
    const b = allGroups[swapWith]
    await supabase.from('categories').update({ orden: b.orden }).eq('id', a.id)
    await supabase.from('categories').update({ orden: a.orden }).eq('id', b.id)
    refetch()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Groups and categories for your transactions.</p>
        </div>
        <Button onClick={() => setGroupDialogState('create')}>Add group</Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="include-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} />
        <label htmlFor="include-archived" className="text-sm text-muted-foreground">
          Include archived
        </label>
      </div>

      {groups && groups.length === 0 && (
        <Card>
          <CardContent className="flex min-h-64 flex-col">
            <EmptyState
              icon={Shapes01Icon}
              title="No groups yet"
              description="Add your first group to start organizing categories."
            />
          </CardContent>
        </Card>
      )}

      {groups?.map(({ group, categories }, index) => {
        const activeChildCount = categories.filter((c) => c.status === 'active').length

        return (
          <Card key={group.id} className={group.status === 'archived' ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => handleMoveGroup(index, 'up')}
                    >
                      <HugeiconsIcon icon={ChevronUpIcon} />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === (groups?.length ?? 0) - 1}
                      onClick={() => handleMoveGroup(index, 'down')}
                    >
                      <HugeiconsIcon icon={ChevronDownIcon} />
                    </Button>
                  </div>
                  <span
                    className="size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <CardTitle>{group.nombre}</CardTitle>
                  <Badge variant="secondary">{CATEGORY_FLOW_LABELS[group.flujo]}</Badge>
                  {group.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {group.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCategoryDialogState({ mode: 'create', groupId: group.id })}
                    >
                      Add category
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setGroupDialogState(group)}>
                    Edit
                  </Button>
                  {group.status === 'active' ? (
                    <ArchiveCategoryDialog
                      target={{ id: group.id, tipo: 'grupo', nombre: group.nombre }}
                      activeChildCount={activeChildCount}
                      onArchived={refetch}
                    />
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleReactivateGroup(group.id)}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <HugeiconsIcon
                            icon={getCategoryIcon(category.icono)}
                            className="size-4"
                            strokeWidth={2}
                          />
                        </div>
                        <span
                          className={`text-sm text-card-foreground ${category.status === 'archived' ? 'opacity-60' : ''}`}
                        >
                          {category.nombre}
                        </span>
                        {category.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCategoryDialogState({ mode: 'edit', category })}
                        >
                          Edit
                        </Button>
                        {category.status === 'active' ? (
                          <ArchiveCategoryDialog
                            target={{ id: category.id, tipo: 'categoria', nombre: category.nombre }}
                            onArchived={refetch}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReactivateCategory(category.id)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <CategoryGroupFormDialog
        mode={groupDialogState === 'create' ? 'create' : 'edit'}
        group={groupDialogState !== 'create' ? (groupDialogState ?? undefined) : undefined}
        existingGroups={(groups ?? []).map((entry) => entry.group)}
        open={groupDialogState !== null}
        onOpenChange={(open) => !open && setGroupDialogState(null)}
        onSuccess={() => refetch()}
      />

      <CategoryFormDialog
        mode={categoryDialogState?.mode ?? 'create'}
        category={categoryDialogState?.mode === 'edit' ? categoryDialogState.category : undefined}
        defaultGroupId={categoryDialogState?.mode === 'create' ? categoryDialogState.groupId : undefined}
        activeGroups={activeGroups}
        open={categoryDialogState !== null}
        onOpenChange={(open) => !open && setCategoryDialogState(null)}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
