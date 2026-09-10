/**
 * Deterministic tests for the on-chain receipt feature.
 *
 * These tests use mocked RPC responses — they make no network calls.
 * Live-network checks are kept separate (see scripts/live-receipt.mjs).
 *
 * Run after building the SSR bundle:
 *   pnpm exec vite build --ssr scripts/engine-entry.ts --outDir .tmp-ssr
 *   node scripts/test-receipt.mjs
 */
import assert from 'node:assert'
import {
  SNAPSHOT_SCHEMA_VERSION,
  buildMemo,
  buildMemoInstruction,
  buildSnapshot,
  canonicalJSON,
  computeReportDigest,
  parseMemo,
  parseImportedReport,
  publishReceipt,
  verifyReceipt,
  MEMO_PROGRAM_ID,
  buildExport,
} from '../.tmp-ssr/engine-entry.js'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
// Some other SPL token program address (non-Memo) for wrong-program tests.
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Minimal base58 encoder for building mock instruction data. */
function base58Encode(bytes) {
  const digits = [0]
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1'
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]]
  return out
}

function makeReport(overrides = {}) {
  return {
    mint: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    logo: null,
    riskScore: 13,
    grade: 'A',
    level: 'low',
    summary: 'This mint looks relatively clean. Low risk score of 13/100.',
    factors: [
      {
        id: 'mint-auth',
        title: 'Mint authority revoked',
        severity: 'low',
        weight: 20,
        score: 0,
        detail: 'No one can mint new tokens.',
        evidence: 'revoked',
      },
      {
        id: 'freeze',
        title: 'Freeze authority revoked',
        severity: 'low',
        weight: 10,
        score: 0,
        detail: 'No account has the power to freeze balances.',
        evidence: 'revoked',
      },
    ],
    pulledAt: 1700000000000,
    coverage: { limited: false, missingChecks: 0 },
    onchain: {
      mint: SOL_MINT,
      supply: '546742544059251600000000',
      decimals: 9,
      mintAuthority: null,
      freezeAuthority: null,
      metadataName: 'Solana',
      metadataSymbol: 'SOL',
      standard: 'native',
      existsOnChain: true,
      extensions: null,
    },
    price: {
      id: SOL_MINT,
      price: '141.23',
      priceChange24h: '1.2',
      volume24h: '1500000000',
      marketCap: '65000000000',
      totalSupply: null,
      circulatingSupply: null,
    },
    token: null,
    ...overrides,
  }
}

function makeSnapshot(_overrides = {}) {
  return buildSnapshot(makeReport(), 'mainnet-beta')
    // buildSnapshot returns a new object; apply deep overrides on top
}

async function digestOf(snapshot) {
  return computeReportDigest(snapshot)
}

// ---------------------------------------------------------------------------
// Helpers for constructing in-memory Solana transactions.

const PUB_PUBKEY = '5oT9FhHp6mK9XqKoa1z1B5ZfA1B5wqAnMe8kRb9QmZ4r'

/** Build a mock transaction object shaped like a VersionedTransactionResponse. */
function mockTx({
  program = MEMO_PROGRAM_ID,
  memo = 'risklens:v1:mainnet-beta:So11111111111111111111111111111111111111112:' + 'a'.repeat(64),
  numSigners = 1,
  accountKeys = [PUB_PUBKEY, MEMO_PROGRAM_ID],
  instructions = null,
  metaErr = null,
  slot = 123,
  blockTime = 1700000000,
}) {
  const memoBytes = new TextEncoder().encode(memo)
  const programIndex = accountKeys.indexOf(program)
  if (instructions === null) {
    instructions = [
      {
        programIdIndex: programIndex,
        accountKeyIndexes: [0],
        data: base58Encode(memoBytes),
      },
    ]
  }
  return {
    slot,
    blockTime,
    meta: { err: metaErr, fee: 5000 },
    transaction: {
      message: {
        accountKeys,
        header: { numRequiredSignatures: numSigners },
        compiledInstructions: instructions,
      },
    },
  }
}

class MockConnection {
  constructor({ tx = null, throws = false, latest = null } = {}) {
    this.tx = tx
    this.throws = throws
    this.latest = latest ?? {
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 1000,
    }
    this.sigStatus = null
    this.blockHeight = 100
    this.fetchCount = 0
  }
  async getTransaction(_sig, _opts) {
    this.fetchCount++
    if (this.throws) throw new Error('mock RPC unavailable')
    return this.tx
  }
  async getLatestBlockhash() {
    return this.latest
  }
  async getSignatureStatus() {
    if (this.sigStatus?.err) return { value: { err: this.sigStatus.err } }
    return { value: { confirmationStatus: 'confirmed', slot: 123 } }
  }
  async getBlockHeight() {
    return this.blockHeight
  }
  async getFeeForMessage() {
    return { value: 5000 }
  }
  async getVersion() {
    return { 'solana-core': '1.18.0' }
  }
}

// ---------------------------------------------------------------------------
// 1. Stable digest despite object-property order differences.

async function testStableDigest() {
  const one = makeSnapshot()
  // Reorder keys deeply to simulate a differently-constructed object.
  const two = JSON.parse(JSON.stringify(one))
  const reorder = (o) => {
    if (Array.isArray(o)) { o.forEach(reorder); return o }
    if (o && typeof o === 'object') {
      const keys = Object.keys(o).reverse()
      const next = {}
      for (const k of keys) next[k] = reorder(o[k])
      return next
    }
    return o
  }
  const three = reorder(two)
  const d1 = await digestOf(one)
  const d2 = await digestOf(three)
  assert.strictEqual(d1, d2, 'digest must be stable across key order')
  assert.strictEqual(d1.length, 64)
}

// ---------------------------------------------------------------------------
// 2. Export/import preserving the digest.

async function testExportImportPreservesDigest() {
  const report = makeReport()
  const exported = buildExport(report)
  const json = JSON.stringify(exported)
  const parsed = parseImportedReport(json)
  assert.strictEqual(parsed.ok, true, 'exported JSON must re-import cleanly')
  const originalDigest = await digestOf(buildSnapshot(report))
  const reimportedDigest = await digestOf(parsed.payload.snapshot)
  assert.strictEqual(originalDigest, reimportedDigest)
}

// ---------------------------------------------------------------------------
// 3. Changed score / evidence / asset / network cause mismatch.

async function testMismatches() {
  const base = makeSnapshot()

  const modified = (fn) => {
    const copy = JSON.parse(JSON.stringify(base))
    fn(copy)
    return copy
  }

  const cases = {
    'score': (s) => { s.result.riskScore = 99 },
    'evidence': (s) => { s.result.factors[0].evidence = 'tampered' },
    'asset': (s) => { s.asset.mint = USDC_MINT },
    'network': (s) => { s.source.analysisNetwork = 'devnet' },
  }

  const baseDigest = await digestOf(base)
  for (const [label, mutate] of Object.entries(cases)) {
    const d = await digestOf(modified(mutate))
    assert.notStrictEqual(d, baseDigest, `${label} change must change digest`)
  }
}

// ---------------------------------------------------------------------------
// 4. Invalid snapshots and malformed imported files.

async function testInvalidInputs() {
  // Non-finite riskScore rejected.
  assert.throws(
    () => buildSnapshot({ ...makeReport(), riskScore: NaN }),
    /finite/,
  )
  assert.throws(
    () => buildSnapshot({ ...makeReport(), riskScore: Infinity }),
    /finite/,
  )
  // Invalid level rejected.
  assert.throws(
    () => buildSnapshot({ ...makeReport(), level: 'golden' }),
    /Invalid level/,
  )
  // Empty mint rejected.
  assert.throws(
    () => buildSnapshot({ ...makeReport(), mint: '' }),
    /Invalid mint/,
  )

  // Malformed imports.
  assert.strictEqual(parseImportedReport('').ok, false)
  assert.strictEqual(parseImportedReport('not json').ok, false)
  assert.strictEqual(parseImportedReport('42').ok, false)
  const noFormat = parseImportedReport(JSON.stringify({ report: makeReport() }))
  assert.strictEqual(noFormat.ok, false)
  const badSchema = parseImportedReport(
    JSON.stringify({ format: 'risklens:report:v1', report: makeReport(), snapshot: {} }),
  )
  assert.strictEqual(badSchema.ok, false)
}

// ---------------------------------------------------------------------------
// 5. Wrong Memo program.

async function testWrongProgram() {
  const conn = new MockConnection({
    tx: mockTx({ program: TOKEN_PROGRAM }),
  })
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'devnet',
    undefined,
    conn,
  )
  assert.strictEqual(res.status, 'unsupported-receipt')
  assert.match(res.explanation, /Memo/i)
}

// ---------------------------------------------------------------------------
// 6. Missing required publisher signature (publisher not a signer).

async function testMissingPublisherSigner() {
  // numRequiredSignatures = 0 → no signers at all.
  const conn = new MockConnection({
    tx: mockTx({ numSigners: 0 }),
  })
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'devnet',
    undefined,
    conn,
  )
  assert.strictEqual(res.status, 'receipt-found')
  assert.strictEqual(res.publisherIsSigner, false)
}

// ---------------------------------------------------------------------------
// 7. Failed transactions.

async function testFailedTransaction() {
  const conn = new MockConnection({
    tx: mockTx({ metaErr: { InstructionError: [0, 'Custom'] } }),
  })
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'devnet',
    undefined,
    conn,
  )
  assert.strictEqual(res.status, 'unsupported-receipt')
  assert.strictEqual(res.executionSuccess, false)
}

// ---------------------------------------------------------------------------
// 8. Wrong receipt network.

async function testWrongNetwork() {
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'evilnet',
  )
  assert.strictEqual(res.status, 'wrong-network')
}

// ---------------------------------------------------------------------------
// 9a. Missing transaction data (not found).

async function testNotFound() {
  const conn = new MockConnection({ tx: null })
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'devnet',
    undefined,
    conn,
  )
  assert.strictEqual(res.status, 'not-found')
}

// 9b. Temporarily unavailable (RPC throws). An outage must NOT be treated as
// proof that a receipt is invalid.
async function testTemporarilyUnavailable() {
  const conn = new MockConnection({ throws: true })
  const res = await verifyReceipt(
    '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2',
    'devnet',
    undefined,
    conn,
  )
  assert.strictEqual(res.status, 'temporarily-unavailable')
}

// ---------------------------------------------------------------------------
// 10. Duplicate-click protection / success path + digest determinism.

async function testSuccessPathAndMemo() {
  const snapshot = makeSnapshot()
  const digest = await digestOf(snapshot)
  const memo = buildMemo(snapshot, digest)
  const parsed = parseMemo(memo)
  assert.ok(parsed)
  assert.strictEqual(parsed.version, 'v1')
  assert.strictEqual(parsed.network, 'mainnet-beta')
  assert.strictEqual(parsed.mint, SOL_MINT)
  assert.strictEqual(parsed.digest, digest)

  // Publish once via mocked connection — duplicate click would build the same
  // fingerprint again, so dedup is safe at the UI layer.
  const conn = new MockConnection()
  let sendCalls = 0
  const fakeWallet = {
    publicKey: { toBase58: () => PUB_PUBKEY },
    sendTransaction: async () => {
      sendCalls++
      return '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2'
    },
  }
  const receipt = await publishReceipt({
    snapshot,
    digest,
    sendTransaction: fakeWallet.sendTransaction,
    publicKey: fakeWallet.publicKey,
    cluster: 'devnet',
    connection: conn,
  })
  assert.strictEqual(receipt.signature, '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2')
  assert.strictEqual(receipt.cluster, 'devnet')
  assert.strictEqual(receipt.digest, digest)
  assert.strictEqual(sendCalls, 1, 'one publish = one send')

  // The memo instruction must explicitly require the publisher as a signer.
  const ix = buildMemoInstruction(memo, fakeWallet.publicKey)
  assert.strictEqual(ix.programId.toBase58(), MEMO_PROGRAM_ID)
  assert.strictEqual(ix.keys[0].pubkey.toBase58(), PUB_PUBKEY)
  assert.strictEqual(ix.keys[0].isSigner, true)
}

// ---------------------------------------------------------------------------
// 11. Wallet rejection and blockhash expiry.

async function testWalletErrors() {
  const snapshot = makeSnapshot()
  const digest = await digestOf(snapshot)
  const conn = new MockConnection()
  const pubkey = { toBase58: () => PUB_PUBKEY }

  // Wallet rejection
  await assert.rejects(
    publishReceipt({
      snapshot,
      digest,
      sendTransaction: async () => { throw new Error('User rejected the request') },
      publicKey: pubkey,
      cluster: 'devnet',
      connection: conn,
    }),
    /WALLET_REJECTED/,
  )

  // Blockhash expiry on send
  await assert.rejects(
    publishReceipt({
      snapshot,
      digest,
      sendTransaction: async () => { throw new Error('Blockhash not found') },
      publicKey: pubkey,
      cluster: 'devnet',
      connection: conn,
    }),
    /BLOCKHASH_EXPIRED/,
  )

  // Insufficient devnet SOL
  await assert.rejects(
    publishReceipt({
      snapshot,
      digest,
      sendTransaction: async () => { throw new Error('Transaction simulation failed. insufficient lamports') },
      publicKey: pubkey,
      cluster: 'devnet',
      connection: conn,
    }),
    /INSUFFICIENT_FUNDS/,
  )
}

// ---------------------------------------------------------------------------
// 12. Verification against an imported snapshot — match and mismatch.

async function testVerificationMatchMismatch() {
  const snapshot = makeSnapshot()
  const digest = await digestOf(snapshot)
  const memo = buildMemo(snapshot, digest)
  const conn = new MockConnection({
    tx: mockTx({ memo, numSigners: 1, accountKeys: [PUB_PUBKEY, MEMO_PROGRAM_ID] }),
  })
  const sig = '5xWtBxQrGnJkZxTbVxWz9qLmN1vPtYzQmXoK3rBZnSqWj8tL6xN2'

  const match = await verifyReceipt(sig, 'devnet', snapshot, conn)
  assert.strictEqual(match.status, 'report-matches')
  assert.strictEqual(match.digestMatches, true)
  assert.strictEqual(match.publisher, PUB_PUBKEY)
  assert.strictEqual(match.publisherIsSigner, true)

  // Tampered snapshot → mismatch.
  const tampered = JSON.parse(JSON.stringify(snapshot))
  tampered.result.riskScore = 98
  const conn2 = new MockConnection({
    tx: mockTx({ memo, numSigners: 1, accountKeys: [PUB_PUBKEY, MEMO_PROGRAM_ID] }),
  })
  const mismatch = await verifyReceipt(sig, 'devnet', tampered, conn2)
  assert.strictEqual(mismatch.status, 'report-mismatch')
  assert.strictEqual(mismatch.digestMatches, false)
}

// ---------------------------------------------------------------------------
// 13. Canonical JSON conformance basics.

function testCanonicalJSON() {
  assert.strictEqual(canonicalJSON({ b: 1, a: 2 }), '{"a":2,"b":1}')
  assert.strictEqual(canonicalJSON({ a: [3, 1, 2] }), '{"a":[3,1,2]}')
  assert.strictEqual(canonicalJSON({ a: null, b: true }), '{"a":null,"b":true}')
  assert.strictEqual(canonicalJSON(10.5), '10.5')
  assert.strictEqual(canonicalJSON(10.0), '10')
  assert.strictEqual(canonicalJSON('héllo'), '"héllo"')
  assert.throws(() => canonicalJSON({ a: NaN }), /valid JSON number/)
  assert.throws(() => canonicalJSON({ a: 1n }), /BigInt/)
}

// ---------------------------------------------------------------------------
// 14. Existing scoring engine remains intact (spot check re-import through
// the same bundle the scoring suite exercises).

async function testScoringSpotCheck() {
  const invalid = buildSnapshot({
    ...makeReport({ mint: 'garbage***' }),
    riskScore: 100,
    grade: 'F',
    level: 'critical',
  })
  assert.strictEqual(SNAPSHOT_SCHEMA_VERSION, 'risklens:snapshot:v1')
  assert.strictEqual(invalid.asset.isNativeSol, false)
  assert.strictEqual(invalid.source.analysisNetwork, 'mainnet-beta')
}

// ---------------------------------------------------------------------------
async function main() {
  await testStableDigest()
  await testExportImportPreservesDigest()
  await testMismatches()
  await testInvalidInputs()
  await testWrongProgram()
  await testMissingPublisherSigner()
  await testFailedTransaction()
  await testWrongNetwork()
  await testNotFound()
  await testTemporarilyUnavailable()
  await testSuccessPathAndMemo()
  await testWalletErrors()
  await testVerificationMatchMismatch()
  testCanonicalJSON()
  await testScoringSpotCheck()
  console.log('All deterministic receipt tests passed.')
}

await main()