import Card from '../ui/Card'

const features = [
  {
    icon: 'M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5L15 7M9 17l-1.5 1.5m9 0L15 17M9 7L7.5 5.5',
    title: 'Authority Radar',
    desc: 'Detects live mint authority, freeze authority, and permanent delegates that can inflate, freeze, or move your tokens.',
  },
  {
    icon: 'M3 3v18h18M8 13l3-3 3 3 4-5',
    title: 'Market Size & Activity',
    desc: 'Estimates market-exit risk from market size, trading volume, and available activity indicators.',
  },
  {
    icon: 'M4 4v6a8 8 0 0016 0V4M4 12h16',
    title: 'Distribution',
    desc: 'Circulating vs. total supply surfaces dumping pressure from unlisted or locked allocations.',
  },
  {
    icon: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
    title: 'Volatility & Pump Detection',
    desc: 'Extreme 24h price moves are flagged for heightened volatility and market-manipulation risk, not rallies.',
  },
  {
    icon: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'Token Age',
    desc: 'A mint under a day old carries the highest rug-pull risk. We timestamp aging automatically.',
  },
  {
    icon: 'M9 12l2 2 4-4M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z',
    title: '120-Second Audit',
    desc: 'Every address gets a factor-weighted 0–100 score with a plain-English report you can screenshot and share.',
  },
]

export default function Features() {
  return (
    <section id="features" className="relative border-t border-noah-border bg-noah-bg-2 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-noah-border-2 bg-noah-surface px-3.5 py-1.5 text-xs font-medium text-noah-muted">
            Everything You Need to Check a Token
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            One address.{' '}
            <span className="text-gradient">Every risk factor.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-noah-muted">
            RiskLens generates the full risk stack — on-chain authority reading,
            live market intelligence, and weighted scoring — so you can size up
            any Solana mint in seconds.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-noah-border-2 bg-noah-bg-2 text-noah-blue">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-noah-muted">
                {f.desc}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}