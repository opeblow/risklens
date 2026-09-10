import { useEffect, useRef, useState } from 'react'
import type { RiskReport } from '../../lib/types'
import {
  buildSnapshot,
  buildMemo,
  computeReportDigest,
  estimateFee,
  type ClusterName,
  type PublishStatus,
} from '../../lib/solana/receipt'
import { shortAddress } from '../../lib/solana/wallet'

const MEMO_PREVIEW_LEN = 48

export interface PublishReviewState {
  status: PublishStatus
  error?: string
  digest?: string
  signature?: string
}

export default function PublishDialog({
  report,
  publicKey,
  onClose,
  onCancel,
  onApprove,
  publishState,
}: {
  report: RiskReport
  publicKey: string | null
  onClose: () => void
  onCancel: () => void
  onApprove: () => void
  publishState: PublishReviewState
}) {
  const [digest, setDigest] = useState<string | null>(null)
  const [fee, setFee] = useState<{ lamports: number; sol: number } | null>(null)
  const [feeError, setFeeError] = useState(false)
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)

  const cluster: ClusterName = 'devnet'
  const networkLabel = `Devnet (receipts)`

  useEffect(() => {
    let cancelled = false
    const snapshot = buildSnapshot(report)
    // Match the frozen memo/digest exactly as it will be published.
    computeReportDigest(snapshot).then((d) => {
      if (!cancelled) setDigest(d)
    })
    estimateFee(cluster)
      .then((f) => {
        if (!cancelled) setFee(f)
      })
      .catch(() => {
        if (!cancelled) setFeeError(true)
      })
    return () => {
      cancelled = true
    }
  }, [report])

  const copyText = (t: string) => {
    try {
      navigator.clipboard.writeText(t)
    } catch {
      // ignore
    }
  }

  // Focus management — move focus into the dialog on open.
  useEffect(() => {
    approveRef.current?.focus()
  }, [])

  useEffect(() => {
    if (publishState.status === 'confirmed' && digest && publicKey) {
      copyText(
        `${window.location.origin}/receipts/${publishState.signature}?cluster=devnet`,
      )
      setCopied(true)
    }
  }, [publishState.status, publishState.signature, digest, publicKey])

  const snapshot = digest ? buildSnapshot(report) : null
  const memoPreview = snapshot && digest
    ? `${buildMemo(snapshot, digest).slice(0, MEMO_PREVIEW_LEN)}…`
    : null

  const feeLabel = feeError
    ? 'Could not estimate fee — approximately 0.000005 SOL'
    : fee
      ? `${fee.sol.toFixed(6)} SOL`
      : 'Estimating…'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && publishState.status === 'review') onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-noah-border bg-noah-surface p-6 noah-scroll sm:rounded-3xl"
        style={{ animation: 'fade-up 0.2s ease-out both' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="publish-dialog-title" className="text-lg font-semibold text-white">
              Publish report receipt
            </h2>
            <p className="mt-1 text-xs text-noah-muted">
              {networkLabel} · a wallet-signed fingerprint of this report
            </p>
          </div>
          {publishState.status === 'review' && (
            <button
              aria-label="Close dialog"
              onClick={onClose}
              className="rounded-lg p-1.5 text-noah-muted-2 transition-colors hover:bg-noah-surface-2 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Review disclosure — shown before signing */}
        {publishState.status === 'review' && (
          <div className="mt-5 space-y-3">
            <DetailRow
              label="Publishing wallet"
              value={publicKey ? shortAddress(publicKey) : '—'}
              mono
            />
            <DetailRow label="Receipt network" value="Devnet" />
            <DetailRow label="Asset" value={`${report.name} (${report.symbol})`} />
            <DetailRow
              label="Analysis time"
              value={new Date(report.pulledAt).toLocaleString()}
            />
            <DetailRow
              label="Report fingerprint"
              value={digest ? shortDigest(digest) : 'Computing…'}
              mono
              title={digest ?? undefined}
            />
            <DetailRow label="Estimated network fee" value={feeLabel} />
            <DetailRow label="Memo (preview)" value={memoPreview ?? '…'} mono />

            <div className="rounded-xl border border-noah-border-2 bg-noah-bg-2 p-4 text-xs leading-relaxed text-noah-muted">
              <p className="font-medium text-noah-muted">
                What becomes public on Solana
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>The publishing wallet address.</li>
                <li>The asset address, source network, and a fingerprint of this report.</li>
                <li>When the transaction was confirmed.</li>
              </ul>
              <p className="mt-3 text-[11px] text-noah-muted-2">
                The full report contents stay confidential — only the fingerprint is
                published. Publication is not a security audit or a guarantee of token safety.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-noah-border-2 bg-noah-surface/60 px-4 text-sm text-noah-muted transition-colors hover:border-noah-blue/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                ref={approveRef}
                onClick={onApprove}
                disabled={!digest}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-noah-green via-noah-blue to-noah-purple px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Approve in wallet
              </button>
            </div>
          </div>
        )}

        {/* Awaiting wallet */}
        {publishState.status === 'awaiting-wallet' && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-noah-blue/25 border-t-noah-blue" />
              <p className="text-sm text-noah-muted">
                Approve the transaction in your wallet (Phantom).
              </p>
            </div>
            <p className="text-[11px] text-noah-muted-2">
              Waiting for approval… this may take a moment.
            </p>
          </div>
        )}

        {/* Submitted / Confirming */}
        {(publishState.status === 'submitted' || publishState.status === 'confirming') && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-noah-blue/25 border-t-noah-blue" />
              <p className="text-sm text-noah-muted">
                {publishState.status === 'submitted'
                  ? 'Transaction submitted. Waiting for confirmation…'
                  : 'Confirming on Devnet…'}
              </p>
            </div>
            {publishState.signature && (
              <DetailRow
                label="Signature"
                value={shortAddress(publishState.signature)}
                mono
                title={publishState.signature}
              />
            )}
          </div>
        )}

        {/* Confirmed */}
        {publishState.status === 'confirmed' && publishState.signature && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3" role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-noah-green">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12.5l2.5 2.5L16 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium text-noah-green">Receipt published and confirmed</p>
            </div>
            <DetailRow label="Signature" value={shortAddress(publishState.signature)} mono title={publishState.signature} />
            <p className="text-[11px] text-noah-muted-2">
              {copied ? 'Receipt link copied to clipboard.' : 'Copies the shareable receipt link.'}
            </p>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <a
                href={`https://explorer.solana.com/tx/${publishState.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-noah-border-2 bg-noah-surface/60 px-4 text-sm text-noah-muted transition-colors hover:border-noah-blue/60 hover:text-white"
              >
                Open in explorer ↗
              </a>
              <button
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-noah-green via-noah-blue to-noah-purple px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                View receipt
              </button>
            </div>
          </div>
        )}

        {/* Rejected / Failed / Unresolved */}
        {(publishState.status === 'rejected' ||
          publishState.status === 'failed' ||
          publishState.status === 'unresolved') && (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3" role="alert">
              <p className="text-sm text-noah-red">
                {publishState.error ??
                  (publishState.status === 'rejected'
                    ? 'The wallet approval was declined. No transaction was sent.'
                    : publishState.status === 'failed'
                      ? 'The transaction failed on-chain.'
                      : 'We could not confirm the transaction. Check the signature in the explorer.')}
              </p>
            </div>
            {publishState.signature && (
              <DetailRow label="Signature" value={shortAddress(publishState.signature)} mono title={publishState.signature} />
            )}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-noah-border-2 bg-noah-surface/60 px-4 text-sm text-noah-muted transition-colors hover:border-noah-blue/60 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  title,
}: {
  label: string
  value: string
  mono?: boolean
  title?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-noah-muted">{label}</span>
      <span
        className={`max-w-[60%] truncate text-xs ${
          mono ? 'font-mono text-noah-muted' : 'text-noah-light'
        }`}
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  )
}

function shortDigest(digest: string): string {
  return `${digest.slice(0, 10)}…${digest.slice(-8)}`
}