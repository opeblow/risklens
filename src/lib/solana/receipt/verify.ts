import { PublicKey } from '@solana/web3.js'
import type { ClusterName } from './cluster'
import { getClusterConnection, MEMO_PROGRAM_ID } from './cluster'
import { parseMemo } from './publish'
import { computeReportDigest } from './hash'
import type { RiskLensReportSnapshotV1 } from './snapshot'

export type VerificationStatus =
  | 'receipt-found'
  | 'report-matches'
  | 'report-mismatch'
  | 'unsupported-receipt'
  | 'not-found'
  | 'temporarily-unavailable'
  | 'wrong-network'

export interface VerificationResult {
  status: VerificationStatus
  /** Publisher wallet address extracted from the memo instruction. */
  publisher?: string | null
  /** The decoded memo string from the on-chain transaction. */
  memo?: string
  /** Parsed memo fields. */
  parsedMemo?: ReturnType<typeof parseMemo>
  /** Transaction signature. */
  signature?: string
  /** Cluster the transaction was found on. */
  cluster?: ClusterName
  /** Solana slot of the transaction. */
  slot?: number
  /** Block time of the transaction (unix seconds). */
  blockTime?: number | null
  /** Transaction fee in lamports. */
  feeLamports?: number
  /** Whether the transaction execution succeeded. */
  executionSuccess?: boolean
  /** Whether the publisher was a transaction signer. */
  publisherIsSigner?: boolean | null
  /** Whether the publisher was explicitly referenced as a signer on the memo instruction. */
  publisherIsRequired?: boolean
  /** If a report was imported, whether its digest matches the recorded digest. */
  digestMatches?: boolean
  /** Human-readable explanation. */
  explanation?: string
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP: Record<string, number> = {}
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i
}

/** Minimal Connection shape used by verifyReceipt (testable via mocks). */
export interface ConnectionLike {
  getTransaction(
    signature: string,
    options?: {
      maxSupportedTransactionVersion?: number
      commitment?: import('@solana/web3.js').Commitment
    },
  ): Promise<unknown>
}

/** Decode a base58 string to a byte array. Throws on invalid input. */
export function base58Decode(input: string): Uint8Array {
  if (!input) return new Uint8Array(0)
  let zeroes = 0
  let length = 0
  let pbegin = 0
  const pend = input.length

  while (pbegin !== pend && input[pbegin] === '1') {
    pbegin++
    zeroes++
  }

  const size = (((pend - pbegin) * 733) >> 9) + 1
  const b256 = new Uint8Array(size)

  while (pbegin !== pend) {
    const c = input[pbegin]
    const digit = BASE58_MAP[c]
    if (digit === undefined) {
      throw new Error('Invalid base58 character')
    }
    let carry = digit
    let i = 0
    for (let it = size - 1; (carry !== 0 || i < length) && it !== -1; it--, i++) {
      carry += 58 * b256[it]
      b256[it] = carry % 256
      carry = (carry / 256) | 0
    }
    length = i
    pbegin++
  }

  const out = new Uint8Array(zeroes + length)
  const start = size - length
  for (let i = 0; i < length; i++) out[zeroes + i] = b256[start + i]
  return out
}

function isPublicKeyLike(v: unknown): v is PublicKey | string {
  return typeof v === 'string' || (v instanceof PublicKey)
}

function keyToString(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v instanceof PublicKey) return v.toBase58()
  if (v && typeof v === 'object' && typeof (v as PublicKey).toBase58 === 'function') {
    return (v as PublicKey).toBase58()
  }
  return null
}

interface CompiledIx {
  programIdIndex?: number
  programId?: number | PublicKey | string
  accountKeyIndexes?: number[]
  accounts?: Array<number | PublicKey | string>
  data?: string | Uint8Array | number[]
}

/**
 * Verify a receipt by fetching and parsing the on-chain transaction.
 *
 * This requires no wallet and no local history — it works in a fresh
 * browser context. The cluster is validated against an allowlist; arbitrary
 * RPC URLs from shared links are never accepted.
 *
 * @param importedSnapshot Optional report snapshot; when provided, its
 *   canonical digest is compared against the recorded on-chain digest, but
 *   the snapshot itself is never published or reconstructed as a report.
 * @param connectionOverride Optional connection used by automated tests to
 *   substitute a mocked RPC.
 */
export async function verifyReceipt(
  signature: string,
  cluster: ClusterName = 'devnet',
  importedSnapshot?: RiskLensReportSnapshotV1,
  connectionOverride?: Awaited<ReturnType<typeof getClusterConnection>> | ConnectionLike,
): Promise<VerificationResult> {
  const result: VerificationResult = {
    status: 'not-found',
    signature,
    cluster,
  }

  const cleanSig = signature.trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,88}$/.test(cleanSig)) {
    result.status = 'unsupported-receipt'
    result.explanation =
      'Invalid transaction signature format. Expected a base58 Solana signature.'
    return result
  }
  result.signature = cleanSig

  const allowed: ClusterName[] = ['mainnet-beta', 'devnet', 'testnet']
  if (!allowed.includes(cluster)) {
    result.status = 'wrong-network'
    result.explanation = `Cluster "${cluster}" is not in the allowed list.`
    return result
  }

  let conn: ConnectionLike
  try {
    conn = connectionOverride ?? getClusterConnection(cluster)
  } catch {
    result.status = 'temporarily-unavailable'
    result.explanation = 'Could not connect to the Solana cluster.'
    return result
  }

  let tx
  try {
    tx = (await conn.getTransaction(cleanSig, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })) as {
      slot?: number
      blockTime?: number | null
      meta?: { fee?: number; err: unknown } | null
      transaction?: unknown
    } | null
  } catch {
    result.status = 'temporarily-unavailable'
    result.explanation =
      'The selected network could not be reached. This does not mean the receipt is invalid — please retry.'
    return result
  }

  if (!tx || !tx.meta || !tx.transaction) {
    result.status = 'not-found'
    result.explanation =
      `No transaction with this signature on ${cluster}. It may be on a different network, ` +
      `not yet confirmed, or Devnet may have reset and dropped it.`
    return result
  }

  result.slot = tx.slot
  result.blockTime = tx.blockTime
  result.feeLamports = tx.meta.fee
  result.executionSuccess = tx.meta.err === null

  if (!result.executionSuccess) {
    result.status = 'unsupported-receipt'
    result.explanation =
      'The transaction exists but failed on-chain. This is not a valid receipt.'
    return result
  }

  const message = (tx.transaction as { message?: unknown }).message as unknown as {
    accountKeys:
      | Array<string | PublicKey>
      | { staticAccountKeys: Array<string | PublicKey>; get?: (i: number) => PublicKey }
    header?: { numRequiredSignatures?: number }
    instructions?: CompiledIx[]
    compiledInstructions?: CompiledIx[]
  }

  const resolveKey = (index: number): string | null => {
    const keys = message.accountKeys
    if (Array.isArray(keys)) return keyToString(keys[index])
    if (keys && typeof keys.get === 'function') {
      try {
        return keyToString(keys.get(index))
      } catch {
        return null
      }
    }
    return null
  }

  const numRequiredSigners =
    message.header && typeof message.header.numRequiredSignatures === 'number'
      ? message.header.numRequiredSignatures
      : null

  const instructions = message.compiledInstructions ?? message.instructions ?? []

  let memoDataRaw: string | Uint8Array | number[] | null = null
  let publisherIndex: number | null = null
  let foundMemoIx = false

  for (const ix of instructions) {
    const programIndex =
      typeof ix.programIdIndex === 'number'
        ? ix.programIdIndex
        : typeof ix.programId === 'number'
          ? ix.programId
          : null
    const programKey =
      typeof ix.programId === 'string' || ix.programId instanceof PublicKey
        ? keyToString(ix.programId)
        : programIndex !== null
          ? resolveKey(programIndex)
          : null

    if (programKey !== MEMO_PROGRAM_ID) continue

    foundMemoIx = true
    const accountIndexes = ix.accountKeyIndexes ?? ix.accounts ?? []
    if (accountIndexes.length > 0) {
      const first =
        typeof accountIndexes[0] === 'number'
          ? (accountIndexes[0] as number)
          : null
      publisherIndex = first !== null && first >= 0 ? first : publisherIndex
    }
    if (typeof ix.data === 'string') {
      memoDataRaw = ix.data
    } else if (ix.data instanceof Uint8Array) {
      memoDataRaw = ix.data
    } else if (Array.isArray(ix.data)) {
      memoDataRaw = ix.data
    }
    break
  }

  if (!foundMemoIx || memoDataRaw == null) {
    result.status = 'unsupported-receipt'
    result.explanation =
      'No Memo instruction from the supported RiskLens program was found in this transaction.'
    return result
  }

  // Decode memo data: compiled instruction data is base58-encoded bytes.
  let memoBytes: Uint8Array
  if (typeof memoDataRaw === 'string') {
    try {
      memoBytes = base58Decode(memoDataRaw)
    } catch {
      try {
        memoBytes = Uint8Array.from(atob(memoDataRaw), (c) => c.charCodeAt(0))
      } catch {
        result.status = 'unsupported-receipt'
        result.explanation = 'Memo data could not be decoded.'
        return result
      }
    }
  } else if (memoDataRaw instanceof Uint8Array) {
    memoBytes = memoDataRaw
  } else {
    memoBytes = new Uint8Array(memoDataRaw)
  }

  try {
    result.memo = new TextDecoder('utf-8', { fatal: true }).decode(memoBytes)
  } catch {
    result.status = 'unsupported-receipt'
    result.explanation = 'Memo data is not valid UTF-8.'
    return result
  }

  const parsed = parseMemo(result.memo)
  if (!parsed) {
    result.status = 'unsupported-receipt'
    result.explanation =
      'The memo does not match the supported RiskLens receipt format.'
    return result
  }
  result.parsedMemo = parsed

  // Resolve publisher.
  if (publisherIndex !== null) {
    const publisherKey = resolveKey(publisherIndex)
    if (publisherKey) {
      result.publisher = publisherKey
      result.publisherIsSigner =
        numRequiredSigners !== null
          ? publisherIndex < numRequiredSigners
          : null
      result.publisherIsRequired = true
    }
  }
  if (!result.publisher) {
    // Defensive fallback: the transaction fee payer is the first signer.
    if (numRequiredSigners !== null && numRequiredSigners > 0) {
      result.publisher = resolveKey(0)
      result.publisherIsSigner = true
      result.publisherIsRequired = false
    }
  }

  // Compare against an imported snapshot if provided.
  if (importedSnapshot) {
    let computedDigest: string
    try {
      computedDigest = await computeReportDigest(importedSnapshot)
    } catch {
      result.status = 'unsupported-receipt'
      result.explanation =
        'Could not compute the digest of the imported report snapshot.'
      return result
    }
    result.digestMatches = computedDigest === parsed.digest
    if (result.digestMatches) {
      result.status = 'report-matches'
      result.explanation =
        'The imported report contents match the recorded on-chain fingerprint.'
    } else {
      result.status = 'report-mismatch'
      result.explanation =
        'The imported report contents do NOT match the on-chain fingerprint — the report has changed since publication, or it is a different report.'
    }
  } else {
    result.status = 'receipt-found'
    result.explanation =
      'Receipt found on-chain. Import the original report JSON to verify its fingerprint.'
  }

  return result
}

export { isPublicKeyLike }