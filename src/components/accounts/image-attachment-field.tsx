import { useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, ImageUpload01Icon } from '@hugeicons/core-free-icons'

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { ACCOUNT_IMAGE_ASPECT_CLASS } from '@/lib/accounts'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// CU-001/CU-004 — carga de imagen opcional (máx. 5MB, JPG/PNG). Misma relación de aspecto que la
// card del listado (ACCOUNT_IMAGE_ASPECT_CLASS), para que el preview muestre exactamente cómo se
// va a recortar después. `existingImageUrl` es la imagen ya guardada (modo edición, CU-004) — se
// reemplaza al elegir un archivo nuevo, nunca se borra por separado (no documentado en el CU).
export function ImageAttachmentField({
  file,
  previewUrl,
  existingImageUrl,
  onFileSelected,
  onRemove,
  onInvalidFile,
}: {
  file: File | null
  previewUrl: string | null
  existingImageUrl?: string | null
  onFileSelected: (file: File) => void
  onRemove: () => void
  onInvalidFile: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return

    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type) || selected.size > MAX_IMAGE_BYTES) {
      onInvalidFile('Use a JPG or PNG under 5 MB.')
      return
    }

    onFileSelected(selected)
  }

  const displayUrl = previewUrl ?? existingImageUrl ?? null

  return (
    <div className="flex flex-col gap-2">
      <Attachment state={displayUrl ? 'done' : 'idle'} orientation="vertical" className="w-full max-w-56">
        {displayUrl ? (
          <>
            <AttachmentMedia variant="image" className={`w-full ${ACCOUNT_IMAGE_ASPECT_CLASS}`}>
              <img src={displayUrl} alt="" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{file ? file.name : 'Current image'}</AttachmentTitle>
              <AttachmentDescription>
                {file ? formatFileSize(file.size) : 'Choose a new file to replace it'}
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              {file ? (
                <AttachmentAction type="button" aria-label="Remove image" onClick={onRemove}>
                  <HugeiconsIcon icon={Delete02Icon} />
                </AttachmentAction>
              ) : (
                <AttachmentAction type="button" aria-label="Replace image" onClick={() => inputRef.current?.click()}>
                  <HugeiconsIcon icon={ImageUpload01Icon} />
                </AttachmentAction>
              )}
            </AttachmentActions>
          </>
        ) : (
          <>
            <AttachmentMedia className={`w-full ${ACCOUNT_IMAGE_ASPECT_CLASS}`}>
              <HugeiconsIcon icon={ImageUpload01Icon} className="size-6 text-muted-foreground" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>Add image</AttachmentTitle>
              <AttachmentDescription>JPG or PNG, up to 5 MB</AttachmentDescription>
            </AttachmentContent>
            <AttachmentTrigger onClick={() => inputRef.current?.click()} />
          </>
        )}
      </Attachment>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
