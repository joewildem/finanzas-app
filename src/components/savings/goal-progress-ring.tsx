import type { ReactNode } from 'react'

// CU-043 (referencia de diseño: "grid de cards con anillo de progreso") — anillo SVG simple vía
// stroke-dasharray, sin librería nueva. `percent` puede superar 1 (RN-127, sin tope interno) pero
// el anillo se capa visualmente en 100% — el número que lo acompaña sí puede mostrar más de 100%.
export function GoalProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  children,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  children?: ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(percent, 1))
  const offset = circumference * (1 - clamped)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-success transition-[stroke-dashoffset]"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}
