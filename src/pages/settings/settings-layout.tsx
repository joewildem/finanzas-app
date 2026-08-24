import { NavLink, Outlet } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SETTINGS_NAV_ITEMS = [
  { label: 'Accounts', path: '/settings/accounts' },
  { label: 'Categories', path: '/settings/categories' },
] as const

// Layout de Settings: contenido del lado izquierdo (las secciones reubicadas aquí, sin cambios en
// su propio código), menú de navegación del lado derecho — orden invertido respecto al patrón
// habitual de sidebar-izquierda, por decisión explícita del usuario.
export function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      <nav className="flex shrink-0 flex-row gap-1 lg:w-48 lg:flex-col">
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

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
