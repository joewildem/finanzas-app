import { cn } from '@/lib/utils'

// Distintivo de ambiente, visible solo en desarrollo (App.tsx lo monta detrás de
// `import.meta.env.DEV`, que Vite sustituye por `false` al compilar — el componente entero queda sin
// referencias y se elimina del bundle publicado, mismo criterio que DevSignInPanel).
//
// No se limita a anunciar "estás en desarrollo": lee la URL de Supabase que realmente quedó
// compilada y la clasifica. El caso que importa es el contrario al obvio — una sesión de `npm run
// dev` apuntando a producción (por ejemplo si `.env.development.local` se borra o se renombra, en
// cuyo caso Vite cae a `.env.local`, que trae las credenciales reales). Ahí escribir en la app
// significa escribir sobre datos financieros reales creyendo que se está probando, así que ese caso
// se marca en rojo y sin sutilezas.
function resolveEnvironment(): { label: string; isProduction: boolean } {
  const url = import.meta.env.VITE_SUPABASE_URL ?? ''
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
  return isLocal
    ? { label: 'LOCAL', isProduction: false }
    : { label: 'PRODUCCIÓN — datos reales', isProduction: true }
}

export function EnvBadge() {
  const { label, isProduction } = resolveEnvironment()

  return (
    <div
      // `pointer-events-none` para que nunca intercepte un clic de la interfaz que hay debajo, y
      // z-index por encima de los modales (z-50) para que no quede tapado justo cuando más importa.
      className="pointer-events-none fixed bottom-3 left-3 z-[100] select-none"
      aria-hidden
    >
      <span
        className={cn(
          'rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide shadow-sm ring-1',
          isProduction
            ? 'bg-destructive text-white ring-white/20'
            : 'bg-muted text-muted-foreground ring-foreground/10',
        )}
      >
        {label}
      </span>
    </div>
  )
}
