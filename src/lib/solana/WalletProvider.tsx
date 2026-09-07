import { useMemo, type ReactNode } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'

const RPC =
  import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'

export default function SolanaWalletProvider({
  children,
}: {
  children: ReactNode
}) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    [],
  )
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}