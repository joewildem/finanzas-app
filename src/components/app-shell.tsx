import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowUpRight01Icon,
  GalleryVerticalEndIcon,
  Logout01Icon,
  Settings01Icon,
  User02Icon,
} from '@hugeicons/core-free-icons'
import { NavLink, useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AddTransactionProvider, useAddTransaction } from '@/lib/add-transaction-context'
import { getAvatarUrl, useAuthSession } from '@/lib/auth-context'
import { NAV_ITEMS } from '@/lib/nav-items'
import { signOut } from '@/lib/sign-out'
import { cn } from '@/lib/utils'

function AppShellHeader() {
  const navigate = useNavigate()
  const { openAddTransaction } = useAddTransaction()
  const session = useAuthSession()
  const avatarUrl = getAvatarUrl(session)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="relative flex h-14 items-center border-b border-border px-6">
      {/* Centrado respecto al ancho total del header (no del espacio sobrante junto a las
          acciones de la derecha) — position absolute + translate en vez de justify-between. */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-lg bg-brand">
          <HugeiconsIcon icon={GalleryVerticalEndIcon} className="size-4 text-brand-foreground" />
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  buttonVariants({ variant: 'ghost' }),
                  isActive && 'bg-muted text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button onClick={() => openAddTransaction()}>
          <HugeiconsIcon icon={ArrowUpRight01Icon} />
          Add record
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" aria-label="Account menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
          >
            <Avatar>
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback>
                <HugeiconsIcon icon={User02Icon} className="size-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <HugeiconsIcon icon={Settings01Icon} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <HugeiconsIcon icon={Logout01Icon} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AddTransactionProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <AppShellHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </div>
    </AddTransactionProvider>
  )
}
