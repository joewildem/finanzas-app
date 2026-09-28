import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// En móvil (`< md`, el mismo corte donde aparecen la barra inferior y el botón flotante) un modal
// centrado se siente ajeno: la convención del sistema operativo es una hoja que sube desde abajo.
// `sheet` es el comportamiento por defecto de los 26 diálogos; `fullscreen` es para un formulario
// largo que en un teléfono conviene que ocupe la pantalla completa y se lea como una página propia.
// De `md` en adelante ambas variantes son idénticas: el modal centrado de siempre.
// Las clases de escritorio se quedan SIN prefijo, tal como estaban, y lo móvil se expresa como
// diferencias con `max-md:`. Al revés —móvil sin prefijo y escritorio con `md:`— habría que
// reescribir también el `className` de cada diálogo que fija alto o ancho, y `tailwind-merge` no
// resuelve todos esos pares: `md:max-h-none` no desplaza a un `md:max-h-[85vh]` posterior, así que
// el resultado dependería del orden en que Tailwind emite el CSS y no de lo que pida el diálogo.
const MOBILE_SHAPE = {
  sheet:
    "max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:max-h-[85dvh] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:overflow-y-auto max-md:rounded-b-none max-md:rounded-t-2xl max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]",
  fullscreen:
    "max-md:inset-0 max-md:h-dvh max-md:max-h-none max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none",
} as const

// La hoja sube desde abajo en vez de hacer zoom desde el centro. `zoom-in-100` neutraliza el zoom
// heredado sin tener que quitarlo de la clase base, y `duration-200` porque el recorrido es largo:
// con la duración del zoom se ve brusco.
const MOBILE_MOTION =
  "max-md:duration-200 max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom max-md:data-closed:zoom-out-100 max-md:data-closed:slide-out-to-bottom"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  mobileVariant = "sheet",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  mobileVariant?: keyof typeof MOBILE_SHAPE
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-mobile-variant={mobileVariant}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none md:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          MOBILE_SHAPE[mobileVariant],
          MOBILE_MOTION,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        // En móvil el modal llega al borde inferior de la pantalla: sin esquinas redondeadas, y con
        // el área segura del teléfono DENTRO del pie y no debajo — así su fondo llega hasta el borde
        // en vez de dejar una franja del fondo del modal bajo los botones.
        "max-md:-mb-[calc(1rem+env(safe-area-inset-bottom))] max-md:rounded-b-none max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
