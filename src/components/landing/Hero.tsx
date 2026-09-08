import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidPubkey } from '../../lib/solana/rpc'
import { filterValidSearchResults, searchTokens } from '../../lib/solana/jupiter'
import type { TokenMeta } from '../../lib/types'
import Spinner from '../ui/Spinner'

const projectTypes = ['Token', 'Pool', 'Vault', 'Protocol']

const examples = [
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
]

export default function Hero() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TokenMeta[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef(0)
  const debounceRef = useRef(0)
  const navigate = useNavigate()

  const run = (mint: string) => {
    if (!isValidPubkey(mint)) {
      setError('Enter a valid Solana token address (32–44 chars base58).')
      return
    }
    setError(null)
    navigate(mint ? `/analyze/${mint}` : '/analyze')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(query.trim())
  }

  const onSearch = (value: string) => {
    setQuery(value)
    setError(null)
    const q = value.trim()
    if (isValidPubkey(q) || q.length < 2) {
      window.clearTimeout(debounceRef.current)
      setResults([])
      return
    }
    const requestId = ++searchRef.current
    setSearching(true)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const found = await searchTokens(q, 6)
        if (requestId !== searchRef.current) return
        setResults(filterValidSearchResults(found))
      } catch {
        if (requestId === searchRef.current) setResults([])
      } finally {
        if (requestId === searchRef.current) setSearching(false)
      }
    }, 250)
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
      {/* ambient gradients */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-noah-blue/22 blur-[130px] animate-glow" />
        <div className="absolute top-40 -left-32 h-72 w-72 rounded-full bg-noah-purple/18 blur-[110px]" />
        <div className="absolute top-20 -right-24 h-72 w-72 rounded-full bg-noah-green/14 blur-[110px]" />
        <div
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-noah-bg to-transparent"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-noah-border-2 bg-noah-surface/70 px-3.5 py-1.5 text-xs font-medium text-noah-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-noah-green" />
            Built on Noah · Deployed on Solana
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl animate-fade-up">
          Your DeFi{' '}
          <span className="text-gradient">Risk Copilot</span>
          <br className="hidden sm:block" /> in one prompt
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-noah-muted sm:text-lg animate-fade-up">
          Paste any Solana token, pool, or vault address for an instant
          plain-English risk breakdown with live market data and multi-factor
          scoring.
        </p>

        {/* project type pills */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 animate-fade-up">
          {projectTypes.map((p, i) => (
            <button
              key={p}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                i === 0
                  ? 'border-noah-blue/50 bg-noah-blue/10 text-white'
                  : 'border-noah-border-2 bg-noah-surface/60 text-noah-muted hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* analyzer prompt box */}
        <form
          onSubmit={onSubmit}
          className="relative mx-auto mt-8 max-w-2xl animate-fade-up"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-noah-border-2 bg-noah-surface/80 p-2 pl-4 shadow-[0_20px_70px_-20px_rgba(1,136,251,0.45)] backdrop-blur transition-colors focus-within:border-noah-blue/60">
            <span className="text-noah-purple-2" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-4.3-4.3M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmit(e)
              }}
              placeholder="Paste a Solana token mint, e.g. a memecoin address"
              className="flex-1 bg-transparent py-2 text-sm text-white placeholder-noah-muted-2 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {searching && <Spinner size={16} />}
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-noah-green via-noah-blue to-noah-purple text-white transition-transform hover:scale-105"
              aria-label="analyze"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* suggestion chips */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-noah-muted-2">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => run(ex)}
                className="rounded-full border border-noah-border-2 bg-noah-surface/50 px-3 py-1 font-mono text-[11px] text-noah-muted transition-colors hover:border-noah-blue/50 hover:text-white"
              >
                {ex.slice(0, 6)}…{ex.slice(-4)}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-xs text-noah-red">{error}</p>
          )}

          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-noah-border-2 bg-noah-bg-2 shadow-2xl text-left">
              {results.map((t) => (
                <button
                  key={t.mint}
                  type="button"
                  onClick={() => {
                    run(t.mint)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-noah-surface-2"
                >
                  {t.logo ? (
                    <img
                      src={t.logo}
                      alt=""
                      className="h-6 w-6 rounded-full bg-noah-surface-2"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-noah-surface-2 text-[9px] font-bold text-noah-muted">
                      {t.symbol.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-white">
                      {t.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-noah-muted-2">
                      {t.mint}
                    </span>
                  </span>
                  <span className="rounded-full bg-noah-surface-2 px-2 py-0.5 text-[10px] font-semibold text-noah-muted">
                    {t.symbol}
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <p className="mx-auto mt-6 max-w-xl text-xs leading-relaxed text-noah-muted-2 animate-fade-up">
          Live data from Solana mainnet + Jupiter. Scores are a heuristic
          copilot — not financial advice. RiskLens may make mistakes. Please use
          with discretion.
        </p>
      </div>
    </section>
  )
}