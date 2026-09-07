// Señal global de "los datos cambiaron", para que una pantalla ya montada no se quede mostrando
// cifras viejas después de que el usuario registró un movimiento desde otra parte de la app.
//
// Por qué se intercepta en el `fetch` del cliente de Supabase y no se avisa desde cada diálogo:
// hay ~35 puntos de escritura repartidos en 29 archivos (RPCs, inserts, updates), y cualquier
// mutación futura que olvide avisar reintroduce el bug en silencio. Aquí el aviso no se puede
// olvidar — sale del único lugar por el que pasan todas las escrituras.
//
// Solo cuentan las peticiones a `/rest/v1/` que no son de lectura: eso cubre los 17 RPCs del
// sistema (todos son mutaciones — no hay ninguno de solo lectura) y todo insert/update/delete de
// PostgREST, y deja fuera `/auth/v1/` (login y refresh de token, que no tocan datos financieros).
// Como las lecturas viajan en `GET`, un refetch disparado por esta señal nunca la vuelve a emitir:
// no hay ciclo posible.

let version = 0
const listeners = new Set<() => void>()

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const DATA_PATH = '/rest/v1/'

export function getDataVersion(): number {
  return version
}

export function subscribeToDataVersion(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function bumpDataVersion(): void {
  version += 1
  for (const listener of listeners) listener()
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  return method.toUpperCase()
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

// Envuelve un `fetch` para que emita la señal después de cada escritura exitosa. Se aplica al
// crear el cliente (`src/lib/supabase.ts`), no a `window.fetch` global: nada fuera de Supabase
// debería poder invalidar la caché de la app por accidente.
export function withDataRefreshTracking(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init)
    if (
      response.ok &&
      !READ_METHODS.has(requestMethod(input, init)) &&
      requestUrl(input).includes(DATA_PATH)
    ) {
      bumpDataVersion()
    }
    return response
  }
}
