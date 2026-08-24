import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconSvgElement
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
