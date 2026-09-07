import { useSyncExternalStore } from 'react'

import { getDataVersion, subscribeToDataVersion } from '@/lib/data-refresh'

// Contador que sube con cada escritura exitosa contra Supabase (ver `src/lib/data-refresh.ts`).
// Un hook de lectura lo agrega a las dependencias de su `useEffect` para volver a consultar cuando
// algo cambió, sin que la pantalla tenga que enterarse ni pasar callbacks:
//
//   const dataVersion = useDataVersion()
//   useEffect(() => { refetch() }, [refetch, dataVersion])
//
// Es un store externo y no un contexto a propósito: así lo puede consumir cualquier hook sin
// depender de dónde esté montado el provider.
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeToDataVersion, getDataVersion, getDataVersion)
}
