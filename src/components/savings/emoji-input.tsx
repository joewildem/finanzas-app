import { useState } from 'react'
import { EmojiPicker } from 'frimousse'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DEFAULT_GOAL_EMOJI } from '@/lib/savings-goals'

// RN-133 — sin catálogo cerrado: picker con búsqueda (frimousse, headless) en vez de un input de
// texto. Vive como prefijo inline del campo "Name" (ver SavingsGoalForm), por eso no trae su propio
// <Label> ni mensaje de error — el form los maneja junto con el nombre, como un solo campo visual.
export function EmojiInput({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Choose emoji"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-lg outline-none transition-colors hover:bg-accent"
          />
        }
      >
        {value || DEFAULT_GOAL_EMOJI}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit p-0">
        <EmojiPicker.Root
          className="isolate flex h-80 w-64 flex-col"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji)
            setOpen(false)
          }}
        >
          <EmojiPicker.Search
            placeholder="Search emoji…"
            className="m-2 h-8 shrink-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No emoji found.
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="select-none pb-2"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1 px-2" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-accent"
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  )
}
