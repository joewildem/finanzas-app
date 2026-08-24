import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ColorsIcon, Tick01Icon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Paleta de referencia de docs/pdr/cuentas.md (CU-001), recortada a 15 fijos + 1 selector
// personalizado (grid 2x8) — nombres en inglés por la convención de idioma de la app. El usuario
// puede elegir cualquier otro hex libremente vía el selector (RN-021).
export const ACCOUNT_COLOR_PALETTE = [
  { name: 'Green', hex: '#22C55E' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Gray', hex: '#9CA3AF' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Brown', hex: '#92400E' },
  { name: 'Black', hex: '#1F2937' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Navy', hex: '#1E3A8A' },
] as const

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (hex: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(value)

  const normalizedValue = value.toUpperCase()
  const isPreset = ACCOUNT_COLOR_PALETTE.some((swatch) => swatch.hex === normalizedValue)
  const isValidCustomHex = !isPreset && HEX_PATTERN.test(normalizedValue)
  const isDraftValid = HEX_PATTERN.test(hexDraft)

  function handleApplyCustom() {
    if (!isDraftValid) return
    onChange(hexDraft.toUpperCase())
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Color</Label>
      <div className="grid w-fit grid-cols-8 gap-2">
        {ACCOUNT_COLOR_PALETTE.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            aria-label={swatch.name}
            title={swatch.name}
            onClick={() => onChange(swatch.hex)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full ring-1 ring-foreground/10',
              normalizedValue === swatch.hex &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
            style={{ backgroundColor: swatch.hex }}
          >
            {normalizedValue === swatch.hex && (
              <HugeiconsIcon icon={Tick01Icon} className="size-4 text-white drop-shadow" />
            )}
          </button>
        ))}

        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (next) setHexDraft(normalizedValue)
          }}
        >
          <PopoverTrigger
            aria-label="Custom color"
            title="Custom color"
            className={cn(
              'flex size-7 items-center justify-center rounded-full ring-1 ring-foreground/10',
              isValidCustomHex && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
            style={{ backgroundColor: isValidCustomHex ? normalizedValue : undefined }}
          >
            {isValidCustomHex ? (
              <HugeiconsIcon icon={Tick01Icon} className="size-4 text-white drop-shadow" />
            ) : (
              <HugeiconsIcon icon={ColorsIcon} className="size-4 text-muted-foreground" />
            )}
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <Label htmlFor="account-color-hex">Custom color</Label>
            <div className="flex items-center gap-2">
              <span
                className="size-7 shrink-0 rounded-full ring-1 ring-foreground/10"
                style={{ backgroundColor: isDraftValid ? hexDraft : 'transparent' }}
              />
              <Input
                id="account-color-hex"
                value={hexDraft}
                onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === 'Enter' && handleApplyCustom()}
                placeholder="#RRGGBB"
                maxLength={7}
                className="font-mono"
              />
            </div>
            <Button type="button" size="sm" disabled={!isDraftValid} onClick={handleApplyCustom}>
              Apply
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
