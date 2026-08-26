import type { ReactNode } from 'react'

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'

// RN-228/RN-235 — 4 o 5 cards visibles según el ancho de pantalla (basis responsivo), el resto
// navegable en carrusel horizontal. Los controles prev/next solo se muestran si hay más items de
// los que caben en el breakpoint más chico (2 por fila) — evitan flechas inertes con pocas cards.
export function AccountCarousel<T>({
  items,
  keyOf,
  renderItem,
}: {
  items: T[]
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactNode
}) {
  return (
    <Carousel opts={{ align: 'start' }} className="w-full">
      <CarouselContent>
        {items.map((item) => (
          <CarouselItem key={keyOf(item)} className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5">
            {renderItem(item)}
          </CarouselItem>
        ))}
      </CarouselContent>
      {items.length > 2 && (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      )}
    </Carousel>
  )
}
