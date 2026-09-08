const integrations = [
  'NoahAI',
  'Solana',
  'Jupiter',
  'CoinGecko',
  'Metaplex',
  'Phantom',
]

export default function Integrations() {
  const doubled = [...integrations, ...integrations]
  return (
    <section className="border-t border-noah-border py-14">
      <p className="text-center text-xs font-medium uppercase tracking-widest text-noah-muted-2">
        Data & services powering your copilot
      </p>
      <div className="relative mt-8 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-noah-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-noah-bg to-transparent" />
        <div className="flex w-max animate-marquee gap-12 px-6">
          {doubled.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex items-center gap-2 text-sm font-medium text-noah-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-noah-purple-2" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}