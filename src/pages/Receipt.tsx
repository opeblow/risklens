import ReceiptPage from '../components/app/ReceiptPage'

export default function Receipt() {
  return (
    <>
      <ReceiptPage />
      <footer className="border-t border-noah-border py-6">
        <p className="mx-auto max-w-7xl px-4 text-center text-[11px] text-noah-muted-2 sm:px-6">
          DeFi Risk Copilot — RiskLens on Solana. Receipts record a wallet-
          published fingerprint; they are not security audits nor guarantees of
          token safety.
        </p>
      </footer>
    </>
  )
}