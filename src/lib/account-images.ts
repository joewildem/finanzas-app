import { supabase } from '@/lib/supabase'

const BUCKET = 'account-images'

// CU-001/CU-004 — falla no bloqueante (BIZ_001): esto se llama DESPUÉS de que la cuenta ya se
// creó/actualizó; un error aquí nunca debe deshacer esa operación, solo se reporta aparte.
export async function uploadAccountImage(
  userId: string,
  accountId: string,
  file: File,
): Promise<{ url: string | null; error: boolean }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${accountId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
  })

  if (uploadError) {
    return { url: null, error: true }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: false }
}
