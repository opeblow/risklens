import type { ReactNode } from 'react'

export default function Card({
  children,
  className = '',
  glow = false,
}: {
  children?: ReactNode
  className?: string
  glow?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-noah-border bg-noah-surface ${className}`}
    >
      {glow && (
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-noah-blue/20 blur-[90px] animate-glow"
          aria-hidden
        />
      )}
      {children}
    </div>
  )
}