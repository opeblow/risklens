import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { analyzeMint } from '../lib/solana/risk'
import { isValidPubkey } from '../lib/solana/rpc'
import { TRENDING } from '../lib/solana/jupiter'
import type { RiskReport } from '../lib/types'
import { cacheReport, readReportCache } from '../lib/storage'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Card from '../components/ui/Card'
import RiskReportView from '../components/app/RiskReport'
import Leaderboard from '../components/app/Leaderboard'
import WalletButton from '../components/app/WalletButton'

const quickPicks = [
  { label: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
  { label: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { label: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { label: 'jitoSOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn' },
]

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function Analyze() {
  const { mint: routeMint } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(routeMint ?? '')
  const [report, setReport] = useState<RiskReport | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const runId = useRef(0)

  useEffect(() => {
    setInput(routeMint ?? '')
    if (routeMint && isValidPubkey(routeMint)) {
      run(routeMint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMint])

  const run = useCallback(async (mint: string) => {
    const id = ++runId.current
    setStatus('loading')
    setError(null)
    setReport(null)
    try {
      const cached = readReportCache(mint)
      if (cached && id === runId.current) {
        setReport(cached.result as RiskReport)
      }
      const result = await analyzeMint(mint)
      cacheReport(mint, result)
      if (id === runId.current) {
        setReport(result)
        setStatus('done')
      }
    } catch {
      if (id === runId.current) {
        setStatus('error')
        setError(
          'We couldn’t pull live data for this address right now. Check the mint and try again.',
        )
      }
    }
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const mint = input.trim()
    if (!isValidPubkey(mint)) {
      setError('Enter a valid 44-character Solana token address.')
      return
    }
    setError(null)
    navigate(`/analyze/${mint}`)
    run(mint)
  }

  return (
    <div className="min-h-screen bg-noah-bg">
      {/* app bar */}
      <header className="sticky top-0 z-40 glass border-b border-noah-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={26} />
            <span className="hidden text-sm font-medium text-noah-muted sm:inline">
              Defi Risk Copilot
            </span>
          </Link>
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        {/* input */}
        <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 rounded-2xl border border-noah-border-2 bg-noah-surface/80 p-2 pl-4 backdrop-blur transition-colors focus-within:border-noah-blue/60">
            <span className="text-noah-purple-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-4.3-4.3M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a Solana token mint address…"
              className="flex-1 bg-transparent py-2 text-sm text-white placeholder-noah-muted-2 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {status === 'loading' && <Spinner size={16} />}
            <Button type="submit" size="sm" disabled={status === 'loading'}>
              Analyze
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-noah-red">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-noah-muted-2">Quick picks:</span>
            {quickPicks.map((q) => (
              <button
                key={q.mint}
                type="button"
                onClick={() => {
                  setInput(q.mint)
                  navigate(`/analyze/${q.mint}`)
                  run(q.mint)
                }}
                className="rounded-full border border-noah-border-2 bg-noah-surface/60 px-3 py-1 text-[11px] font-medium text-noah-muted transition-colors hover:border-noah-blue/50 hover:text-white"
              >
                {q.label}
              </button>
            ))}
          </div>
        </form>

        {/* report / states */}
        <div className="mt-8">
          {status === 'loading' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
              <Card className="h-[360px] animate-pulse bg-noah-surface" />
              <Card className="h-[360px] animate-pulse bg-noah-surface" />
            </div>
          )}

          {status === 'error' && (
            <Card className="p-8 text-center">
              <p className="text-sm text-noah-red">Something went wrong.</p>
              <p className="mt-2 text-xs text-noah-muted">{error}</p>
            </Card>
          )}

          {status === 'done' && report && <RiskReportView report={report} />}

          {status === 'idle' && (
            <Card className="p-10 text-center">
              <p className="text-sm text-noah-muted">
                Paste a token mint above to generate a live risk report.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {[...new Set(TRENDING)].slice(0, 10).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setInput(m)
                      navigate(`/analyze/${m}`)
                      run(m)
                    }}
                    className="rounded-full border border-noah-border-2 bg-noah-surface/60 px-3 py-1 font-mono text-[10px] text-noah-muted transition-colors hover:border-noah-blue/50 hover:text-white"
                  >
                    {m.slice(0, 6)}…{m.slice(-4)}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {status === 'done' && <Leaderboard />}
      </main>

      <footer className="border-t border-noah-border py-6">
        <p className="mx-auto max-w-7xl px-4 text-center text-[11px] text-noah-muted-2 sm:px-6">
          DeFi Risk Copilot — a Noah-built dApp on Solana. Live data via public
          Solana RPC + Jupiter. Heuristic scoring, not financial advice. Noah AI
          may make mistakes. Please use with discretion.
        </p>
      </footer>
    </div>
  )
}