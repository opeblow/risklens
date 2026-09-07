import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'success'

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noah-blue/60 disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-noah-green via-noah-blue to-noah-purple text-white hover:opacity-90 shadow-[0_8px_30px_rgba(1,136,251,0.35)]',
  outline:
    'border border-noah-border-2 bg-noah-surface/60 text-noah-light hover:border-noah-blue/60 hover:text-white',
  ghost: 'text-noah-muted hover:text-white hover:bg-noah-surface-2',
  danger:
    'bg-noah-red/15 text-noah-red border border-noah-red/30 hover:bg-noah-red/25',
  success:
    'bg-noah-green/15 text-noah-green border border-noah-green/30 hover:bg-noah-green/25',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}