import { Link } from 'react-router-dom'
import Logo from '../ui/Logo'

const cols = [
  {
    title: 'Product',
    items: ['Full Stack Dapp', 'Solana Program', 'Mobile', 'Games', 'Pricing'],
  },
  {
    title: 'Resources',
    items: ['Docs', 'Community', 'Tutorial', 'Open Claw', 'Support'],
  },
  {
    title: 'Company',
    items: ['About', 'Blog', 'Careers', 'Contact'],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-noah-border bg-noah-bg-2">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/">
              <Logo size={30} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-noah-muted">
              Launch a Dapp in Minutes. Write, refine, and execute your ideas
              effortlessly using AI-powered guidance.
            </p>
            <div className="mt-5 flex gap-3">
              {['X', 'TG', 'GH'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-noah-border-2 text-xs font-semibold text-noah-muted transition-colors hover:border-noah-blue/60 hover:text-white"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold text-white">{c.title}</h4>
              <ul className="mt-4 space-y-3">
                {c.items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-noah-muted transition-colors hover:text-white"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-noah-border pt-6 text-xs text-noah-muted sm:flex-row">
          <span>© 2026 Noah AI. All Rights Reserved.</span>
          <span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-noah-green" />
              Powered by Solana
            </span>
            <a href="#" className="hover:text-white">
              Terms
            </a>
            <a href="#" className="hover:text-white">
              Privacy
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}