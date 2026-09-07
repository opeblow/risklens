import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import Logo from '../ui/Logo'

const links = [
  { label: 'Features', href: '#features' },
  { label: 'Community', href: '#community' },
  { label: 'Open Claw', href: '#openclaw' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Testimonials', href: '#community' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? 'glass border-b border-noah-border' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-noah-muted transition-colors hover:bg-noah-surface-2 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/analyze">
            <Button variant="outline" size="sm">
              Enter App
            </Button>
          </Link>
          <Link to="/analyze">
            <Button size="sm">Sign In →</Button>
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="glass border-t border-noah-border md:hidden">
          <div className="space-y-1 px-4 py-3">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-noah-muted hover:bg-noah-surface-2 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/analyze" className="flex-1">
                <Button variant="outline" size="md" className="w-full">
                  Enter App
                </Button>
              </Link>
              <Link to="/analyze" className="flex-1">
                <Button size="md" className="w-full">
                  Sign In →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}