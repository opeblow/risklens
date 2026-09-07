import { Link } from 'react-router-dom'
import Button from '../ui/Button'

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'USD / month',
    credits: '1M credits',
    desc: 'For individuals experimenting with tokens and small apps.',
    features: ['20 analyses / day', 'Core risk factors', 'Shareable report links'],
    cta: 'Start building',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '30',
    period: 'USD / month',
    credits: '30M credits',
    desc: 'For active builders who need more generation power.',
    features: [
      'Unlimited analyses',
      'Community attestations',
      'Wallet-attested reports',
      'Priority data refresh',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
  {
    name: 'Builder',
    price: '100',
    period: 'USD / month',
    credits: '100M credits',
    desc: 'For larger teams and agencies shipping at scale.',
    features: ['Everything in Pro', '100 project limit', 'Dedicated support'],
    cta: 'Talk to us',
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-noah-border bg-noah-bg-2 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Simple pricing for{' '}
            <span className="text-gradient">builders at every stage</span>
          </h2>
          <p className="mt-4 text-sm text-noah-muted">
            Start free. Upgrade when you need more generation power,
            deployments, and advanced features.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 ${
                p.highlight
                  ? 'border-noah-blue/50 bg-noah-surface shadow-[0_0_60px_-20px_rgba(1,136,251,0.5)]'
                  : 'border-noah-border bg-noah-surface'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-noah-green via-noah-blue to-noah-purple px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-sm font-semibold uppercase tracking-widest text-noah-muted">
                {p.name}
              </h3>
              <p className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold text-white">
                  ${p.price}
                </span>
                <span className="pb-1 text-xs text-noah-muted">{p.period}</span>
              </p>
              <p className="mt-1 text-xs text-noah-blue">{p.credits}</p>
              <p className="mt-4 text-[13px] leading-relaxed text-noah-muted">
                {p.desc}
              </p>
              <ul className="mt-5 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-noah-light">
                    <span className="mt-0.5 text-noah-green">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/analyze" className="mt-7 block">
                <Button
                  size="md"
                  variant={p.highlight ? 'primary' : 'outline'}
                  className="w-full"
                >
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}