import { useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import { getAddressBalance, shortAddress } from '../../lib/solana/wallet'

export default function WalletButton() {
  const { connected, connect, disconnect, publicKey } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!publicKey) return
    let cancelled = false
    getAddressBalance(publicKey.toBase58()).then((b) => {
      if (!cancelled) setBalance(b)
    })
    return () => {
      cancelled = true
    }
  }, [publicKey])

  if (!connected || !publicKey) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await connect()
          } catch {
            // user cancelled
          } finally {
            setBusy(false)
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="3" />
          <path d="M16 12h.01" />
        </svg>
        Connect Wallet
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full border border-noah-border-2 bg-noah-surface px-2.5 py-1 text-[11px] text-noah-muted sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-noah-green" />
        {balance != null ? `${balance.toFixed(2)} SOL` : '—'}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => disconnect()}
        title={publicKey.toBase58()}
      >
        {shortAddress(publicKey.toBase58())}
      </Button>
    </div>
  )
}