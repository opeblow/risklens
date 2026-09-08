import { Link } from 'react-router-dom'
import type { RiskLevel } from '../../lib/types'
import { getAttestations } from '../../lib/storage'
import { shortAddress } from '../../lib/solana/wallet'

interface Showcase {
  mint: string
  title: string
  desc: string
  symbol: string
  score: number
  level: RiskLevel
  img?: string
}

// Real Solana mints — every card re-analyzes live when clicked. Values shown
// are illustrative snapshots from earlier live runs, not live numbers.
const showcases: Showcase[] = [
  {
    mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    title: 'jitoSOL',
    desc: 'Liquid staking derivative with revoked authorities and deep liquidity.',
    symbol: 'JITOSOL',
    score: 9,
    level: 'low',
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    title: 'USDC',
    desc: 'Verified stablecoin — flagged only for centralized mint & freeze control.',
    symbol: 'USDC',
    score: 28,
    level: 'low',
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    title: 'Bonk',
    desc: 'Seasoned community memecoin with strong liquidity and stable action.',
    symbol: 'BONK',
    score: 12,
    level: 'low',
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    title: 'Jupiter',
    desc: 'Ecosystem token with verified listing and healthy on-chain behavior.',
    symbol: 'JUP',
    score: 10,
    level: 'low',
  },
  {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    title: 'dogwifhat',
    desc: 'High-liquidity community coin — volume is active but price is stable.',
    symbol: 'WIF',
    score: 22,
    level: 'low',
  },
]

const levelColor: Record<RiskLevel, string> = {
  low: 'text-noah-green',
  medium: 'text-noah-amber',
  high: 'text-noah-orange',
  critical: 'text-noah-red',
  unknown: 'text-noah-muted',
}

function ShowcaseCard({ s }: { s: Showcase }) {
  return (
    <Link
      to={`/analyze/${s.mint}`}
      className="group rounded-2xl border border-noah-border bg-noah-surface p-5 transition-all hover:-translate-y-0.5 hover:border-noah-blue/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-noah-surface-2 to-noah-bg-2 font-bold text-noah-purple-2">
          {s.symbol.slice(0, 2)}
        </div>
        <span className={`text-2xl font-bold ${levelColor[s.level]}`}>
          {s.score}
        </span>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-white group-hover:text-white">
        {s.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-noah-muted">{s.desc}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full border border-noah-border-2 bg-noah-bg-2 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noah-green">
          solana
        </span>
        <span className="font-mono text-[10px] text-noah-muted-2">
          {s.mint.slice(0, 5)}…{s.mint.slice(-4)}
        </span>
      </div>
    </Link>
  )
}

export default function CommunityGrid() {
  const attestations = getAttestations().slice(0, 3)

  return (
    <section id="community" className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Risk Snapshots
            </h2>
            <p className="mt-2 max-w-xl text-sm text-noah-muted">
              Illustrative scores from earlier live runs — click any card to
              re-analyze that mint fresh from Solana mainnet + Jupiter.
            </p>
          </div>
          <Link
            to="/analyze"
            className="text-sm font-medium text-noah-blue transition-colors hover:text-noah-blue-2"
          >
            Open the analyzer →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {showcases.map((s) => (
            <ShowcaseCard key={s.mint} s={s} />
          ))}
        </div>

        {attestations.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-noah-muted-2">
              Top community attestations
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {attestations.map((a) => (
                <Link
                  to={`/analyze/${a.mint}`}
                  key={a.signature}
                  className="flex items-center justify-between gap-3 rounded-xl border border-noah-border-2 bg-noah-surface/60 px-4 py-3 transition-colors hover:border-noah-blue/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-white">
                      {a.symbol} · {shortAddress(a.address)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-noah-muted-2">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-noah-amber">
                    {a.score}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}