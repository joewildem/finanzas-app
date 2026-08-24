import { AUTH_ERROR_MESSAGES } from '@/lib/auth-errors'

// Mensajes documentados en docs/pdr/categorias.md (CU-007 a CU-012), traducidos a inglés — mismo
// tratamiento que account-errors.ts. AUTH_001 y SYS_001 se reutilizan tal cual, sin duplicar texto.
export const CATEGORY_ERROR_MESSAGES = {
  AUTH_001: AUTH_ERROR_MESSAGES.AUTH_001,
  SYS_001: AUTH_ERROR_MESSAGES.SYS_001,
  VALIDATION_001: 'This field is required.',
  VALIDATION_008: 'Enter a valid hex color (e.g. #RRGGBB).',
  VALIDATION_009: 'You already have a group with this name.',
  VALIDATION_010: 'You already have a category with this name in this group.',
  VALIDATION_011: "That icon isn't valid.",
  BIZ_005: 'The selected group no longer exists, is not yours, or is hidden.',
  BIZ_006: 'That group could not be found.',
  BIZ_007: 'That category could not be found.',
  BIZ_008: 'This item is already hidden.',
} as const

export type CategoryErrorCode = keyof typeof CATEGORY_ERROR_MESSAGES

export function isCategoryErrorCode(value: string | null): value is CategoryErrorCode {
  return value !== null && value in CATEGORY_ERROR_MESSAGES
}

/**
 * El RPC `archive_category_group` y las políticas RLS devuelven el código como el mensaje completo
 * de la excepción (ej. `raise exception 'BIZ_008'`), pero Postgres/PostgREST pueden envolverlo con
 * texto adicional — se busca por coincidencia en vez de igualdad, mismo patrón que
 * `findAccountErrorCodeInMessage`.
 */
export function findCategoryErrorCodeInMessage(
  message: string | null | undefined,
): CategoryErrorCode | null {
  if (!message) return null
  const code = (Object.keys(CATEGORY_ERROR_MESSAGES) as CategoryErrorCode[]).find((code) =>
    message.includes(code),
  )
  return code ?? null
}
