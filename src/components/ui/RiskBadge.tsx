import type { RiskLevel } from '../../lib/types'

const style: Record<RiskLevel, string> = {
  critical: 'bg-noah-red/15 text-noah-red border-noah-red/30',
  high: 'bg-noah-orange/15 text-noah-orange border-noah-orange/30',
  medium: 'bg-noah-amber/15 text-noah-amber border-noah-amber/30',
  low: 'bg-noah-green/15 text-noah-green border-noah-green/30',
  unknown: 'bg-noah-muted/15 text-noah-muted border-noah-border-2',
}

export default function RiskBadge({
  level,
  label,
}: {
  level: RiskLevel
  label?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style[level]}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${
            level === 'low' ? 'bg-noah-green' : 'bg-current'
          }`}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {label ?? level}
    </span>
  )
}

export function SeverityChip({ severity }: { severity: RiskLevel }) {
  return <RiskBadge level={severity} />
}