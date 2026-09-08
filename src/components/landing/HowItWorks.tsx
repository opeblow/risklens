const steps = [
  {
    n: '01',
    title: 'Paste or search',
    desc: 'Drop in any Solana token mint, or pick from Jupiter’s live token list.',
  },
  {
    n: '02',
    title: 'RiskLens reads the chain',
    desc: 'Mint & freeze authorities, delegates, supply, metadata, age and more — pulled in real time.',
  },
  {
    n: '03',
    title: 'Risk engine scores',
    desc: 'Eight weighted factors collapse into a single 0–100 score with a letter grade.',
  },
  {
    n: '04',
    title: 'Sign & save',
    desc: 'Sign your assessment with Phantom and save a verifiable review locally on this device.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Mint address to <span className="text-gradient">full risk report</span> — in
            one search
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-noah-muted">
            A single-address workflow applied to the thing every Solana user
            actually needs: knowing what they're about to hold.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-noah-border bg-noah-surface p-6"
            >
              <span className="font-mono text-sm font-bold text-noah-blue">
                {s.n}
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-noah-muted">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}