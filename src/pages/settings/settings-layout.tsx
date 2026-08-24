import { NavLink, Outlet } from 'react-router-dom'

import { CleanDataDialog } from '@/components/settings/clean-data-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SETTINGS_NAV_ITEMS = [
  { label: 'Accounts', path: '/settings/accounts' },
  { label: 'Categories', path: '/settings/categories' },
] as const

// Layout de Settings: menú de navegación del lado izquierdo (patrón estándar de sidebar), contenido
// a la derecha — las secciones reubicadas aquí no cambian su propio código, solo su ubicación. La
// "Danger zone" vive en el propio menú (no en una sección más), separada del resto por un borde,
// para que sea visible sin importar qué página de settings esté abierta.
export function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex shrink-0 flex-col gap-4 lg:w-48">
        <nav className="flex flex-row gap-1 lg:flex-col">
          {SETTINGS_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  buttonVariants({ variant: 'ghost' }),
                  'justify-start',
                  isActive && 'bg-muted text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <p className="px-2.5 text-xs font-medium text-muted-foreground">Danger zone</p>
          <CleanDataDialog />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
