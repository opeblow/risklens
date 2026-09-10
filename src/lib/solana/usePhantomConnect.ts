import { useEffect, useRef } from 'react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { useWallet } from '@solana/wallet-adapter-react'

const PHANTOM_URL = 'https://phantom.app/download'

export default function usePhantomConnect() {
  const {
    connected,
    connecting,
    connect,
    disconnect,
    publicKey,
    select,
    sendTransaction,
    signMessage,
    wallet,
    wallets,
  } = useWallet()
  const pendingRef = useRef(false)

  const phantom = wallets.find((w) => w.adapter.name === 'Phantom')
  const phantomReady =
    phantom?.readyState === WalletReadyState.Installed ||
    phantom?.readyState === WalletReadyState.Loadable

  useEffect(() => {
    if (
      pendingRef.current &&
      phantomReady &&
      wallet?.adapter.name === 'Phantom' &&
      !connected
    ) {
      pendingRef.current = false
      connect().catch(() => {})
    }
  }, [phantomReady, wallet, connected, connect])

  const requestConnect = () => {
    if (connected) return
    if (!phantom || !phantomReady) {
      window.open(PHANTOM_URL, '_blank', 'noopener noreferrer')
      return
    }
    if (wallet?.adapter.name === 'Phantom') {
      connect().catch(() => {})
    } else {
      pendingRef.current = true
      select(phantom.adapter.name)
    }
  }

  return {
    connected,
    connecting,
    disconnect,
    phantomReady,
    publicKey,
    requestConnect,
    sendTransaction,
    signMessage,
  }
}