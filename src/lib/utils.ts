import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formato unificado de porcentajes en toda la app: un decimal, sin decimales si es exactamente
// ".0" (ej. 65 -> "65%", 64.73 -> "64.7%", 100 -> "100%"). `value` ya viene en escala 0-100.
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const decimals = Number.isInteger(rounded) ? 0 : 1
  return `${rounded.toFixed(decimals)}%`
}
