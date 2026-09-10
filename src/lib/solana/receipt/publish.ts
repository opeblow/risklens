import {
  Transaction,
  TransactionInstruction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import type { ClusterName } from './cluster'
import { getClusterConnection, MEMO_PROGRAM_ID } from './cluster'
import type { RiskLensReportSnapshotV1 } from './snapshot'

/** Publication status machine states. */
export type PublishStatus =
  | 'idle'
  | 'review'
  | 'awaiting-wallet'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'rejected'
  | 'failed'
  | 'unresolved'

export interface PublishReceipt {
  /** The on-chain transaction signature. */
  signature: string
  /** Cluster where the transaction was published. */
  cluster: ClusterName
  /** The report digest embedded in the memo. */
  digest: string
  /** Publishing wallet address. */
  publisher: string
  /** The mint address from the snapshot. */
  mint: string
  /** Analysis network from the snapshot. */
  analysisNetwork: string
  /** Unix timestamp of confirmation. */
  confirmedAt: number
  /** Solana slot at confirmation. */
  slot: number
  /** Estimated fee in SOL. */
  feeLamports: number
}

/**
 * Parse a RiskLens memo string back into its components.
 * Returns null if the memo doesn't match the expected format.
 *
 * Format: risklens:v1:<network>:<mint>:<hexDigest>
 */
export function parseMemo(memo: string): {
  version: string
  network: string
  mint: string
  digest: string
} | null {
  const parts = memo.split(':')
  if (parts.length !== 5) return null
  if (parts[0] !== 'risklens') return null
  if (parts[1] !== 'v1') return null
  // Validate digest is hex and 64 chars
  if (!/^[0-9a-f]{64}$/i.test(parts[4])) return null
  return {
    version: parts[1],
    network: parts[2],
    mint: parts[3],
    digest: parts[4],
  }
}

/**
 * Build the compact, versioned memo string.
 */
export function buildMemo(
  snapshot: RiskLensReportSnapshotV1,
  digest: string,
): string {
  return `risklens:v1:${snapshot.source.analysisNetwork}:${snapshot.asset.mint}:${digest}`
}

/**
 * Build the Solana Memo instruction.
 *
 * The publisher wallet is explicitly included as a required signer account.
 */
export function buildMemoInstruction(
  memo: string,
  publisher: PublicKey,
): TransactionInstruction {
  const data = new TextEncoder().encode(memo)
  return new TransactionInstruction({
    keys: [
      { pubkey: publisher, isSigner: true, isWritable: false },
    ],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    // web3.js v1 types instruction data as Buffer; keep the browser-safe
    // Uint8Array at runtime.
    data: data as unknown as TransactionInstruction['data'],
  })
}

/**
 * Estimate the transaction fee for a memo publication.
 * Returns lamports and SOL values.
 */
export async function estimateFee(cluster: ClusterName): Promise<{
  lamports: number
  sol: number
}> {
  const conn = getClusterConnection(cluster)
  try {
    // Build a minimal memo message to estimate the fee without a wallet.
    const dummyKey = PublicKey.unique()
    const tx = new Transaction()
    tx.add(buildMemoInstruction('risklens:v1:estimate', dummyKey))
    const fee = await conn.getFeeForMessage(tx.compileMessage(), 'confirmed')
    const lamports = fee?.value ?? 5000
    return { lamports, sol: lamports / LAMPORTS_PER_SOL }
  } catch {
    // Fallback to typical memo transaction fee
    return { lamports: 5000, sol: 5000 / LAMPORTS_PER_SOL }
  }
}

export interface PublishOptions {
  snapshot: RiskLensReportSnapshotV1
  digest: string
  /** The wallet adapter's sendTransaction function. */
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: {
      skipPreflight?: boolean
      preflightCommitment?: import('@solana/web3.js').Commitment
    },
  ) => Promise<string>
  /** The connected wallet's public key. */
  publicKey: PublicKey
  /** Cluster to publish on. Defaults to devnet. */
  cluster?: ClusterName
  /** Optional connection override for automated tests. */
  connection?: Connection
}

/**
 * Build, sign, send, and confirm a Memo transaction containing the report
 * fingerprint.
 *
 * Steps:
 * 1. Freeze the snapshot (already done before calling this)
 * 2. Build memo instruction with publisher as required signer
 * 3. Build transaction with fresh blockhash
 * 4. Send via wallet adapter
 * 5. Confirm with retry and timeout
 *
 * @returns PublishReceipt on success, throws on failure.
 */
export async function publishReceipt(options: PublishOptions): Promise<PublishReceipt> {
  const {
    snapshot,
    digest,
    sendTransaction,
    publicKey,
    cluster = 'devnet',
    connection,
  } = options

  const conn = connection ?? getClusterConnection(cluster)

  // Build memo
  const memo = buildMemo(snapshot, digest)
  const memoIx = buildMemoInstruction(memo, publicKey)

  // Build transaction
  const transaction = new Transaction()
  transaction.add(memoIx)

  // Get fresh blockhash
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = publicKey

  // Partial sign (the wallet will complete signing and send)
  // Note: wallet adapter handles final signing

  // Send transaction
  let signature: string
  try {
    signature = await sendTransaction(transaction, conn, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('reject') || msg.includes('User rejected')) {
      throw new Error('WALLET_REJECTED')
    }
    if (msg.includes('insufficient') || msg.includes('0x1')) {
      throw new Error('INSUFFICIENT_FUNDS')
    }
    if (msg.includes('blockhash') || msg.includes('Blockhash not found')) {
      throw new Error('BLOCKHASH_EXPIRED')
    }
    throw new Error(`SUBMIT_FAILED: ${msg}`)
  }

  // Confirm with retry
  const receipt = await confirmTransaction(conn, signature, lastValidBlockHeight)

  return {
    signature,
    cluster,
    digest,
    publisher: publicKey.toBase58(),
    mint: snapshot.asset.mint,
    analysisNetwork: snapshot.source.analysisNetwork,
    confirmedAt: Date.now(),
    slot: receipt.slot,
    feeLamports: receipt.feeLamports,
  }
}

interface ConfirmResult {
  slot: number
  feeLamports: number
}

/**
 * Confirm a transaction with retry and timeout handling.
 */
async function confirmTransaction(
  conn: import('@solana/web3.js').Connection,
  signature: string,
  lastValidBlockHeight: number,
): Promise<ConfirmResult> {
  const MAX_RETRIES = 30
  const RETRY_INTERVAL = 2000

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const status = await conn.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      })

      if (status?.value?.err) {
        throw new Error('TRANSACTION_FAILED')
      }

      if (status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized') {
        // Get transaction details for fee
        const tx = await conn.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        })
        const feeLamports = tx?.meta?.fee ?? 5000
        return {
          slot: status.value.slot,
          feeLamports,
        }
      }

      // Check blockhash expiry
      try {
        const blockHeight = await conn.getBlockHeight('confirmed')
        if (blockHeight > lastValidBlockHeight) {
          throw new Error('BLOCKHASH_EXPIRED')
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'BLOCKHASH_EXPIRED') {
          throw e
        }
        // Block height check failed, continue retrying
      }
    } catch (e) {
      if (e instanceof Error && (
        e.message === 'TRANSACTION_FAILED' ||
        e.message === 'BLOCKHASH_EXPIRED'
      )) {
        throw e
      }
      // Network error — retry
    }

    await new Promise((r) => setTimeout(r, RETRY_INTERVAL))
  }

  throw new Error('CONFIRM_TIMEOUT')
}
