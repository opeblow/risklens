import { useState } from 'react'
import type { RiskReport } from '../../lib/types'
import { gradeForScore } from '../../lib/solana/risk'
import { shortAddress, signAttestationMessage } from '../../lib/solana/wallet'
import usePhantomConnect from '../../lib/solana/usePhantomConnect'
import { getAttestations, saveAttestation } from '../../lib/storage'
import Card from '../ui/Card'
import ScoreGauge from '../ui/ScoreGauge'
import Button from '../ui/Button'
import RiskBadge from '../ui/RiskBadge'
import { SeverityChip } from '../ui/RiskBadge'
import { fmtUsd } from '../../lib/solana/risk'

function copyText(t: string) {
  try {
    navigator.clipboard.writeText(t)
  } catch {
    // ignore
  }
}

export default function RiskReportView({ report }: { report: RiskReport }) {
  const { connected, connecting, phantomReady, publicKey, requestConnect, signMessage } =
    usePhantomConnect()
  const [signed, setSigned] = useState(false)
  const [signing, setSigning] = useState(false)
  const [copied, setCopied] = useState(false)

  const g = gradeForScore(report.riskScore)
  const gradeColor =
    g.level === 'low'
      ? 'text-noah-green'
      : g.level === 'medium'
        ? 'text-noah-amber'
        : g.level === 'high'
          ? 'text-noah-orange'
          : 'text-noah-red'

  const onAttest = async () => {
    if (!publicKey || !signMessage || !connected) {
      requestConnect()
      return
    }
    setSigning(true)
    try {
      const address = publicKey.toBase58()
      const message =
        `RiskLens review — I assessed ${report.mint} with my wallet. ` +
        `Score ${report.riskScore}/100 (${report.grade}). ` +
        `Nonce: ${Date.now().toString(36)}.`
      const signature = await signAttestationMessage(message, signMessage)
      saveAttestation({
        id: `${address}-${report.mint}`,
        mint: report.mint,
        symbol: report.symbol || '???',
        score: report.riskScore,
        grade: report.grade,
        message,
        address,
        signature,
        createdAt: Date.now(),
      })
      setSigned(true)
    } catch {
      // wallet rejected
    } finally {
      setSigning(false)
    }
  }

  const hasSigned = getAttestations().some(
    (a) => a.mint === report.mint && a.address === publicKey?.toBase58(),
  )

  const sorted = [...report.factors].sort((a, b) => b.score - a.score)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      {/* left column */}
      <Card className="p-6" glow>
        <div className="flex items-start gap-4">
          {report.logo ? (
            <img
              src={report.logo}
              alt=""
              className="h-12 w-12 rounded-xl bg-noah-surface-2"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-noah-blue/25 to-noah-purple/25 text-base font-bold text-noah-purple-2">
              {(report.symbol || '?').slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate text-xl font-semibold text-white">
              {report.name}
            </h2>
            <button
              className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-noah-muted-2 transition-colors hover:text-noah-blue"
              onClick={() => {
                copyText(report.mint)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
            >
              {shortAddress(report.mint)}
              <span className="text-noah-muted">{copied ? '✓' : '⧉'}</span>
            </button>
          </div>
          <RiskBadge level={report.level} label={g.label} />
        </div>

        <div className="mt-6 flex items-center gap-6">
          <ScoreGauge score={report.riskScore} level={report.level} />
          <div className="space-y-2">
            <p className="text-sm text-noah-muted">Risk score</p>
            <p className={`text-5xl font-bold tracking-tight ${gradeColor}`}>
              {report.grade}
            </p>
            <p className="text-xs text-noah-muted-2">
              Health trend — 0 = safest · 100 = riskiest
            </p>
          </div>
        </div>

        <p className="mt-6 rounded-xl border border-noah-border-2 bg-noah-bg-2 p-4 text-[13px] leading-relaxed text-noah-light">
          {report.summary}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant={hasSigned ? 'success' : 'primary'}
            disabled={signing || hasSigned || connecting}
            onClick={onAttest}
          >
            {hasSigned
              ? '✓ Saved'
              : signing
                ? 'Signing…'
                : connected
                  ? 'Sign & save review'
                  : connecting
                    ? 'Connecting…'
                    : phantomReady
                      ? 'Connect to sign'
                      : 'Install Phantom'}
          </Button>
          <a
            className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-medium text-noah-blue transition-colors hover:text-noah-blue-2"
            href={`https://explorer.solana.com/address/${report.mint}`}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer ↗
          </a>
        </div>
        {!connected && (
          <p className="mt-3 text-[11px] text-noah-muted-2">
            Connect a wallet to sign your risk review. The signed message is
            stored locally in this browser under “My signed risk reviews”.
          </p>
        )}
        {signed && (
          <p className="mt-3 text-[12px] font-medium text-noah-green">
            Signature stored locally in “My signed risk reviews”.
          </p>
        )}
      </Card>

      {/* right column — factors */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-noah-muted">
          Risk factors
        </h3>
        <div className="mt-4 space-y-3">
          {sorted.map((f) => (
            <div key={f.id} className="rounded-xl border border-noah-border bg-noah-bg-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[13px] font-medium text-white">
                  {f.title}
                </h4>
                <SeverityChip severity={f.severity} />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-noah-surface-2">
                <div
                  className={`h-full rounded-full ${
                    f.score >= 70
                      ? 'bg-noah-red'
                      : f.score >= 40
                        ? 'bg-noah-orange'
                        : 'bg-noah-green'
                  }`}
                  style={{
                    width: `${f.score}%`,
                    transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-noah-muted">
                {f.detail}
              </p>
              <p className="mt-2 truncate font-mono text-[10px] text-noah-muted-2">
                {f.evidence}
              </p>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-xs text-noah-muted">
              Not enough live data to score {report.mint}. Scores appear as
              factor data streams in.
            </p>
          )}
        </div>
      </Card>

      {/* stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
        <StatRow label="Price (USD)" value={report.price?.price ? `$${Number(report.price.price) < 0.001 ? Number(report.price.price).toExponential(2) : Number(report.price.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}` : 'n/a'} />
        <StatRow label="24h change" value={report.price?.priceChange24h != null ? `${Number(report.price.priceChange24h) > 0 ? '+' : ''}${Number(report.price.priceChange24h).toFixed(2)}%` : 'n/a'} accent={Number(report.price?.priceChange24h ?? 0) >= 0 ? 'text-noah-green' : 'text-noah-red'} />
        <StatRow label="Market cap" value={report.price?.marketCap ? fmtUsd(Number(report.price.marketCap)) : 'n/a'} />
        <StatRow label="24h volume" value={report.price?.volume24h ? fmtUsd(Number(report.price.volume24h)) : 'n/a'} />
        <StatRow label="Mint authority" value={report.onchain?.mintAuthority ? 'ENABLED' : report.onchain?.existsOnChain ? 'revoked' : 'n/a'} danger={!!report.onchain?.mintAuthority} />
        <StatRow label="Freeze authority" value={report.onchain?.freezeAuthority ? 'PRESENT' : report.onchain?.existsOnChain ? 'none' : 'n/a'} danger={!!report.onchain?.freezeAuthority} />
        <StatRow label="Decimals" value={String(report.onchain?.decimals ?? report.token?.decimals ?? 'n/a')} />
        <StatRow label="Pulled at" value={new Date(report.pulledAt).toLocaleTimeString()} />
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  accent = 'text-white',
  danger,
}: {
  label: string
  value: string
  accent?: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-noah-border bg-noah-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-noah-muted-2">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${
          danger ? 'text-noah-red' : accent
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}