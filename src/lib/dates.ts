import { format, parseISO } from 'date-fns'

// Formato único de fecha en toda la interfaz: "31 Dec, 2027". Cada pantalla elegía el suyo antes
// ('MMM d, yyyy', 'd MMM yyyy', el toLocaleDateString del navegador), así que la misma fecha se leía
// distinto según dónde apareciera. Los formatos de almacenamiento ('yyyy-MM-dd') y las etiquetas de
// mes de gráficas y presupuesto son otra cosa y no pasan por aquí.
const DATE_FORMAT = 'dd MMM, yyyy'

// Variante sin año, para el extremo izquierdo de un rango donde el año ya viene en el derecho.
const DATE_FORMAT_SHORT = 'dd MMM'

// Las fechas del backend llegan como texto: una fecha sola ('2027-12-31') o un timestamp ISO
// completo. `parseISO` interpreta la primera en la zona local, que es lo que se quiere; `new Date()`
// la interpreta en UTC y en México (UTC-6) la corría un día hacia atrás — de ahí salían los "30 Dec"
// en los historiales. Cualquier fecha que venga del servidor debe pasar por aquí, no por `new Date`.
export function parseDate(value: Date | string): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

export function formatDate(value: Date | string): string {
  return format(parseDate(value), DATE_FORMAT)
}

export function formatDateShort(value: Date | string): string {
  return format(parseDate(value), DATE_FORMAT_SHORT)
}
