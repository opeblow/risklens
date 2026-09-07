import type { RiskLevel } from '../../lib/types'

function colorFor(level: RiskLevel): string {
  if (level === 'low' ) return '#4EDE88'
  if (level === 'critical') return '#E24C5D'
  if (level === 'high') return '#FF954B'
  if (level === 'medium') return '#FFB45E'
  return '#9AA1AB'
}

export default function ScoreGauge({
  score,
  level,
  size = 132,
  label,
}: {
  score: number
  level: RiskLevel
  size?: number
  label?: string
}) {
  const color = colorFor(level)
  const r = 52
  const c = 2 * Math.PI * r
  const filled = (score / 100) * c
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#262B31"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{ color }}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-noah-muted">
          {label ?? 'RISK'}
        </span>
      </div>
    </div>
  )
}