import { useMemo, useState, type ReactNode } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import type { WalletError } from '@solana/wallet-adapter-base'

const RPC =
  import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'

function readableError(error: WalletError): string {
  switch (error?.name) {
    case 'WalletNotReadyError':
      return 'Phantom was not detected in this browser. Use "Install Phantom" first.'
    case 'WalletConnectionError':
      return 'Phantom connection was declined or timed out. Please try again.'
    case 'WalletWindowClosedError':
      return 'The Phantom popup was closed before the connection finished.'
    case 'WalletSignMessageError':
      return 'Signing the message was declined or failed.'
    default:
      return error?.message || 'Wallet connection failed. Please try again.'
  }
}

export default function SolanaWalletProvider({
  children,
}: {
  children: ReactNode
}) {
  const [walletError, setWalletError] = useState<string | null>(null)

  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    [],
  )

  const onError = (error: WalletError) => {
    setWalletError(readableError(error))
    window.setTimeout(() => setWalletError(null), 6000)
  }

  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        {children}
      </WalletProvider>
      {walletError && (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-[999] flex max-w-xs items-start gap-2 rounded-2xl border border-noah-red/40 bg-noah-bg-2 px-4 py-3 text-xs leading-relaxed text-noah-red shadow-2xl"
        >
          <span>{walletError}</span>
          <button
            aria-label="Dismiss"
            className="cursor-pointer text-noah-red/70 transition-colors hover:text-noah-red"
            onClick={() => setWalletError(null)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </ConnectionProvider>
  )
}