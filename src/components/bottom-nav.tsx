import { HugeiconsIcon } from '@hugeicons/react'
import {
  ChartLineData01Icon,
  CreditCardIcon,
  Home01Icon,
  MoreHorizontalIcon,
  PiggyBankIcon,
  ReceiptTextIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const PRIMARY_ITEMS = [
  { label: 'Dashboard', path: '/', icon: Home01Icon, end: true },
  { label: 'Budget', path: '/budget', icon: Wallet01Icon, end: false },
  { label: 'Savings', path: '/savings', icon: PiggyBankIcon, end: false },
  { label: 'Investments', path: '/investments', icon: ChartLineData01Icon, end: false },
] as const

const MORE_ITEMS = [
  { label: 'Debts', path: '/debts', icon: CreditCardIcon },
  { label: 'Transactions', path: '/transactions', icon: ReceiptTextIcon },
] as const

// Bottom tab bar visible en <=768px (`md:hidden`) — sustituye a la navegación del header, que en
// mobile solo conserva logo centrado + avatar (ver AppShellHeader). El fondo translúcido con blur es
// una aproximación web al material "Liquid Glass" de iOS 26: no existe API de navegador que
// reproduzca ese material nativo (renderizado por el sistema operativo), así que esto evoca el look
// sin depender de React Native / módulos nativos.
export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMoreActive = MORE_ITEMS.some((item) => location.pathname.startsWith(item.path))

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/70 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-1">
        {PRIMARY_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground',
                isActive && 'text-foreground',
              )
            }
          >
            <HugeiconsIcon icon={item.icon} className="size-5" />
            <span className="text-[11px] font-medium">{item.label}</span>
          </NavLink>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground outline-none',
                  isMoreActive && 'text-foreground',
                )}
              />
            }
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-5" />
            <span className="text-[11px] font-medium">More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" sideOffset={12}>
            {MORE_ITEMS.map((item) => (
              <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                <HugeiconsIcon icon={item.icon} />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
