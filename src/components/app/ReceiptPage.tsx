import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { VerificationResult, ClusterName } from '../../lib/solana/receipt'
import { verifyReceipt } from '../../lib/solana/receipt'
import { explorerTxUrl, clusterLabel } from '../../lib/solana/receipt'
import { getStoredReceipts } from '../../lib/storage'
import type { StoredReceipt } from '../../lib/types'
import { shortAddress } from '../../lib/solana/wallet'
import Logo from '../ui/Logo'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Spinner from '../ui/Spinner'
import { importReportFile } from './ReportExporter'
import type { ExportedReport } from './ReportExporter'

type VerifyState =
  | 'idle'
  | 'loading'
  | 'done'
  | 'error'

export default function ReceiptPage() {
  const { signature: routeSignature } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const clusterParam = searchParams.get('cluster')

  const [signature, setSignature] = useState(routeSignature ?? '')
  const [cluster, setCluster] = useState<ClusterName>(
    clusterParam === 'mainnet-beta' || clusterParam === 'testnet' || clusterParam === 'devnet'
      ? clusterParam
      : 'devnet',
  )
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [state, setState] = useState<VerifyState>('idle')
  const [imported, setImported] = useState<ExportedReport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recent, setRecent] = useState<StoredReceipt[]>([])
  const runId = useRef(0)

  const refreshRecent = useCallback(() => {
    setRecent(getStoredReceipts())
  }, [])

  useEffect(() => {
    refreshRecent()
  }, [refreshRecent])

  // Run verification when signature is present
  const run = useCallback(
    async (sig: string, c: ClusterName, snapshot: ExportedReport | null) => {
      const id = ++runId.current
      setState('loading')
      setResult(null)
      try {
        const importSnapshot = snapshot?.snapshot ?? undefined
        const res = await verifyReceipt(sig, c, importSnapshot)
        if (id === runId.current) {
          setResult(res)
          setState('done')
        }
      } catch {
        if (id === runId.current) {
          setResult({
            status: 'temporarily-unavailable',
            signature: sig,
            cluster: c,
            explanation:
              'Verification could not be completed right now. Please retry.',
          })
          setState('done')
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (routeSignature && routeSignature.trim()) {
      setSignature(routeSignature.trim())
      run(routeSignature.trim(), cluster, imported)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature])

  const onVerify = () => {
    const sig = signature.trim()
    if (!/^[1-9A-HJ-NP-Za-km-z]{43,88}$/.test(sig)) {
      setResult({
        status: 'unsupported-receipt',
        signature: sig,
        cluster,
        explanation: 'Enter a valid Solana transaction signature (base58).',
      })
      setState('done')
      return
    }
    setImported(null)
    setImportError(null)
    run(sig, cluster, null)
  }

  const onImport = async (file: File) => {
    setImportError(null)
    const res = await importReportFile(file)
    if (!res.ok) {
      setImportError(res.error)
      setImported(null)
      return
    }
    setImported(res.payload)
    if (signature.trim() && result?.signature) {
      run(result.signature, cluster, res.payload)
    } else if (signature.trim()) {
      run(signature.trim(), cluster, res.payload)
    }
  }

  const statusTone =
    result?.status === 'report-matches'
      ? 'text-noah-green border-noah-green/40 bg-noah-green/10'
      : result?.status === 'report-mismatch' ||
          result?.status === 'unsupported-receipt'
        ? 'text-noah-red border-noah-red/40 bg-noah-red/10'
        : result?.status === 'receipt-found'
          ? 'text-noah-blue-2 border-noah-blue/40 bg-noah-blue/10'
          : result?.status === 'not-found'
            ? 'text-noah-amber border-noah-amber/40 bg-noah-amber/10'
            : 'text-noah-muted border-noah-border-2 bg-noah-surface/40'

  return (
    <div className="min-h-screen bg-noah-bg">
      <header className="sticky top-0 z-40 glass border-b border-noah-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={26} />
            <span className="hidden text-sm font-medium text-noah-muted sm:inline">
              Receipt verifier
            </span>
          </Link>
          <Link
            to="/analyze"
            className="rounded-xl border border-noah-border-2 bg-noah-surface/60 px-3 py-1.5 text-xs text-noah-muted transition-colors hover:border-noah-blue/60 hover:text-white"
          >
            Analyze a token
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-white">
          Verify an on-chain receipt
        </h1>
        <p className="mt-1 text-xs text-noah-muted">
          Paste a transaction signature and select a network. This works in a
          fresh browser — no wallet or local history required.
        </p>

        {/* Disclaimer banner */}
        <div className="mt-4 rounded-xl border border-noah-border-2 bg-noah-bg-2 p-4 text-xs leading-relaxed text-noah-muted">
          This receipt identifies the wallet that published this report
          fingerprint and lets you check the supplied report for changes.
          It is not a security audit or a guarantee of token safety.
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onVerify()
          }}
          className="mt-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Transaction signature (base58)…"
              autoComplete="off"
              spellCheck={false}
              className="h-11 flex-1 rounded-xl border border-noah-border-2 bg-noah-surface px-3 font-mono text-xs text-white placeholder-noah-muted-2 outline-none transition-colors focus:border-noah-blue/60"
            />
            <div className="flex items-center gap-2">
              <select
                value={cluster}
                onChange={(e) => {
                  const c = e.target.value as ClusterName
                  setCluster(c)
                  setSearchParams({ cluster: c })
                }}
                aria-label="Receipt network"
                className="h-11 rounded-xl border border-noah-border-2 bg-noah-surface px-3 text-xs text-noah-light outline-none transition-colors focus:border-noah-blue/60"
              >
                <option value="devnet">Devnet</option>
                <option value="mainnet-beta">Mainnet</option>
                <option value="testnet">Testnet</option>
              </select>
              <Button type="submit" size="md" disabled={state === 'loading'}>
                Verify
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-noah-muted-2">
            Receipt publication uses Devnet; analysis uses Mainnet. These are
            kept separate.
          </p>
        </form>

        {/* Import area */}
        <Card className="mt-5 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-noah-muted">
            Import a report to compare fingerprints
          </h2>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void onImport(file)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              dragOver
                ? 'border-noah-blue/70 bg-noah-blue/10'
                : 'border-noah-border-2 bg-noah-surface/40 hover:border-noah-blue/50'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-noah-muted-2">
              <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
            </svg>
            <p className="text-xs text-noah-muted">
              Drop a RiskLens report JSON here, or click to browse
            </p>
            <p className="text-[11px] text-noah-muted-2">
              Files are read locally and never uploaded. Max 4 MB.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImport(file)
                e.target.value = ''
              }}
            />
          </div>
          {imported && (
            <p className="mt-3 text-center text-xs font-medium text-noah-green">
              Imported: {shortAddress(imported.snapshot.asset.mint)} ·{' '}
              {imported.snapshot.asset.symbol} ·{' '}
              {imported.snapshot.result.grade} (@{' '}
              {imported.snapshot.result.riskScore}/100)
            </p>
          )}
          {importError && (
            <p className="mt-3 text-center text-xs text-noah-red">{importError}</p>
          )}
        </Card>

        {/* Status */}
        {state === 'loading' && (
          <Card className="mt-5 flex items-center justify-center gap-3 p-8">
            <Spinner size={18} />
            <p className="text-sm text-noah-muted">
              Fetching transaction from {clusterLabel(cluster)}…
            </p>
          </Card>
        )}

        {state === 'done' && result && (
          <Card className={`mt-5 border ${statusTone}`}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {statusTitle(result)}
                  </h2>
                  <p className="mt-1 text-sm text-noah-muted">{result.explanation}</p>
                </div>
              </div>

              {result.status !== 'temporarily-unavailable' && result.status !== 'wrong-network' && (
                <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
                  <Detail label="Publisher wallet" mono>
                    {result.publisher ? (
                      <span className="font-mono">{result.publisher}</span>
                    ) : (
                      'not found'
                    )}
                  </Detail>
                  <Detail label="Receipt network">
                    {clusterLabel(result.cluster ?? cluster)}
                  </Detail>
                  <Detail label="Transaction signature" mono>
                    {shortAddress(result.signature ?? '')}{' '}
                    <a
                      href={explorerTxUrl(result.signature ?? '', result.cluster ?? cluster)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-noah-blue hover:text-noah-blue-2"
                    >
                      explorer ↗
                    </a>
                  </Detail>
                  <Detail label="Slot / block time">
                    {result.slot != null ? `#${result.slot}` : '—'}
                    {result.blockTime != null
                      ? ` · ${new Date(result.blockTime * 1000).toLocaleString()}`
                      : ''}
                  </Detail>
                  <Detail label="Report fingerprint" mono>
                    {result.parsedMemo ? shortFingerprint(result.parsedMemo.digest) : '—'}
                    {result.parsedMemo ? (
                      <span title={result.parsedMemo.digest}> (hover for full)</span>
                    ) : null}
                  </Detail>
                  <Detail label="Confirmation / finality">
                    {result.executionSuccess == null
                      ? '—'
                      : result.executionSuccess
                        ? 'Execution succeeded'
                        : 'Execution failed'}
                  </Detail>
                  {result.parsedMemo && (
                    <>
                      <Detail label="Asset" mono>
                        {shortAddress(result.parsedMemo.mint)}
                      </Detail>
                      <Detail label="Source network">
                        {result.parsedMemo.network}
                      </Detail>
                    </>
                  )}
                </dl>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-noah-border pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const link = `${window.location.origin}/receipts/${result.signature}?cluster=${result.cluster ?? cluster}`
                    copyText(link)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy receipt link'}
                </Button>
                {result.signature && (
                  <>
                    <a
                      className="inline-flex h-8 items-center rounded-xl border border-noah-border-2 bg-noah-surface/60 px-3 text-xs text-noah-light transition-colors hover:border-noah-blue/60 hover:text-white"
                      href={explorerTxUrl(result.signature, result.cluster ?? cluster)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in explorer ↗
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(result.signature ?? '', result.cluster ?? cluster, imported)}
                    >
                      Re-verify
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {state === 'idle' && !routeSignature && (
          <Card className="mt-5 p-8 text-center">
            <p className="text-sm text-noah-muted">
              Enter a transaction signature above to start verification.
            </p>
          </Card>
        )}

        {/* Recent receipts */}
        {recent.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-noah-muted">
              Recent receipts on this device
            </h2>
            <div className="mt-3 space-y-2">
              {recent.map((r) => (
                <Link
                  key={r.signature}
                  to={`/receipts/${r.signature}?cluster=${r.cluster}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-noah-border bg-noah-surface px-4 py-3 transition-colors hover:border-noah-blue/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-noah-muted">
                      {r.symbol || shortAddress(r.mint)}{' '}
                      <span className="text-noah-muted-2">·</span>{' '}
                      {shortAddress(r.signature)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-noah-muted-2">
                      {clusterLabel(r.cluster as ClusterName)} ·{' '}
                      {new Date(r.confirmedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-noah-muted-2">
                    {explorerTxUrl(r.signature, r.cluster as ClusterName) ? '' : ''}
                    {shortAddress(r.publisher)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* RPC-history / Devnet reset note */}
        <p className="mt-8 text-center text-[11px] leading-relaxed text-noah-muted-2">
          Verification reads public transaction history from the selected
          cluster's RPC. Devnet is a test network that may reset and drop old
          transactions; this demo is not permanent document hosting.
        </p>
      </main>
    </div>
  )
}

function Detail({
  label,
  mono = false,
  children,
}: {
  label: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-noah-muted-2">
        {label}
      </dt>
      <dd className={`mt-1 text-xs text-noah-light ${mono ? 'font-mono' : ''}`}>
        {children}
      </dd>
    </div>
  )
}

function statusTitle(r: VerificationResult): string {
  switch (r.status) {
    case 'report-matches': return 'Report contents match ✓'
    case 'report-mismatch': return 'Report mismatch ✗'
    case 'receipt-found': return 'Receipt found'
    case 'unsupported-receipt': return 'Unsupported receipt'
    case 'not-found': return 'Not found on selected network'
    case 'temporarily-unavailable': return 'Temporarily unable to verify'
    case 'wrong-network': return 'Wrong network'
    default: return 'Result'
  }
}

function shortFingerprint(digest: string): string {
  return `${digest.slice(0, 10)}…${digest.slice(-8)}`
}

function copyText(t: string) {
  try {
    navigator.clipboard.writeText(t)
  } catch {
    // ignore
  }
}