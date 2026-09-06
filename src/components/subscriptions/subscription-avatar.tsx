import { useEffect, useState } from 'react'

import {
  extractDomain,
  SUBSCRIPTION_CATEGORY_COLORS,
  type Subscription,
} from '@/lib/subscriptions'
import { cn } from '@/lib/utils'

const BRANDFETCH_CLIENT_ID = import.meta.env.VITE_BRANDFETCH_CLIENT_ID

// Cadena de respaldo para el logo, de mejor a peor:
//
//   1. Brandfetch — logo real en vector, gratis hasta 500 mil peticiones al mes y sin badge de
//      atribución. Sus términos exigen enlazar directo a su CDN y no cachear el archivo, así que la
//      imagen no pasa por Supabase Storage.
//   2. El favicon de DuckDuckGo — no necesita registro ni llave, cubre dominios que Brandfetch no
//      tenga, aunque en baja resolución.
//   3. La inicial del nombre sobre el color de la categoría, que siempre funciona.
//
// Sin `sitio_web` se va directo al paso 3: no hay dominio del cual derivar un logo.
type Source = 'brandfetch' | 'duckduckgo' | 'initial'

// Brandfetch no responde 404 para un dominio que no conoce: responde 200 con un marcador genérico,
// así que `onError` nunca se dispara y la cadena de respaldo quedaría muerta. Lo que sí distingue a
// ese marcador es el tamaño — sirve 40×40 donde un logo real viene en 400×400, comprobado contra una
// docena de dominios. Un umbral holgado deja pasar cualquier logo real y atrapa el marcador.
const PLACEHOLDER_MAX_PX = 64

function sourceUrl(source: Source, domain: string): string | null {
  if (source === 'brandfetch') {
    if (!BRANDFETCH_CLIENT_ID) return null
    return `https://cdn.brandfetch.io/${domain}?c=${BRANDFETCH_CLIENT_ID}`
  }
  if (source === 'duckduckgo') return `https://icons.duckduckgo.com/ip3/${domain}.ico`
  return null
}

export function SubscriptionAvatar({
  subscription,
  className,
}: {
  subscription: Pick<Subscription, 'nombre' | 'sitio_web' | 'categoria'>
  className?: string
}) {
  const domain = extractDomain(subscription.sitio_web)
  const [source, setSource] = useState<Source>(() =>
    domain ? (BRANDFETCH_CLIENT_ID ? 'brandfetch' : 'duckduckgo') : 'initial',
  )

  // Editar el sitio web de una suscripción debe volver a intentar desde el mejor origen; sin esto,
  // un dominio corregido se quedaría con el respaldo que había fallado para el dominio anterior.
  useEffect(() => {
    setSource(domain ? (BRANDFETCH_CLIENT_ID ? 'brandfetch' : 'duckduckgo') : 'initial')
  }, [domain])

  const url = domain ? sourceUrl(source, domain) : null

  return (
    // Plano: sin anillo ni sombra, solo la imagen con las esquinas redondeadas. Los logos de
    // Brandfetch y los favicons vienen cuadrados y a sangre, así que `object-cover` los deja llenar
    // el marco sin recortar nada relevante. El `bg-muted` de abajo solo se asoma mientras la imagen
    // carga o si el logo trae transparencia.
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted',
        className,
      )}
      style={url ? undefined : { backgroundColor: SUBSCRIPTION_CATEGORY_COLORS[subscription.categoria] }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onLoad={(event) => {
            if (source === 'brandfetch' && event.currentTarget.naturalWidth <= PLACEHOLDER_MAX_PX) {
              setSource('duckduckgo')
            }
          }}
          onError={() => setSource(source === 'brandfetch' ? 'duckduckgo' : 'initial')}
        />
      ) : (
        <span className="text-sm font-semibold text-white">
          {subscription.nombre.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}
