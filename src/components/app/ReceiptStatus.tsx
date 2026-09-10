import type { PublishStatus } from '../../lib/solana/receipt'

const STATUS_META: Record<
  PublishStatus,
  { label: string; tone: 'idle' | 'info' | 'success' | 'danger' | 'warn' }
> = {
  idle: { label: 'Not published', tone: 'idle' },
  review: { label: 'Review', tone: 'info' },
  'awaiting-wallet': { label: 'Awaiting wallet', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'info' },
  confirming: { label: 'Confirming', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  unresolved: { label: 'Unresolved', tone: 'warn' },
}

const TONE_CLASSES = {
  idle: 'border-noah-border-2 bg-noah-surface/40 text-noah-muted',
  info: 'border-noah-blue/40 bg-noah-blue/10 text-noah-blue-2',
  success: 'border-noah-green/40 bg-noah-green/10 text-noah-green',
  danger: 'border-noah-red/40 bg-noah-red/10 text-noah-red',
  warn: 'border-noah-amber/40 bg-noah-amber/10 text-noah-amber',
}

/**
 * A compact, accessible transaction-status banner covering the full
 * supported state machine:
 * Review → Awaiting wallet → Submitted → Confirming → Confirmed
 * plus rejected, failed, and unresolved.
 */
export default function ReceiptStatus({
  status,
  signature,
  error,
  className = '',
}: {
  status: PublishStatus
  signature?: string | null
  error?: string | null
  className?: string
}) {
  const meta = STATUS_META[status]
  const tone = TONE_CLASSES[meta.tone]

  return (
    <div
      role={status === 'confirmed' || status === 'rejected' || status === 'failed' ? 'status' : 'progress'}
      aria-live="polite"
      aria-busy={
        status === 'awaiting-wallet' ||
        status === 'submitted' ||
        status === 'confirming'
      }
      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm ${tone} ${className}`}
    >
      <div className="flex items-center gap-2">
        {(status === 'awaiting-wallet' ||
          status === 'submitted' ||
          status === 'confirming') && (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
            aria-hidden
          />
        )}
        <span className="font-medium">{meta.label}</span>
      </div>
      {(error || signature) && (
        <p className="text-xs opacity-90">
          {error ?? (signature ? `Signature: ${signature.slice(0, 12)}…` : '')}
        </p>
      )}
    </div>
  )
}