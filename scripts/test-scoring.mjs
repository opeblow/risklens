import assert from 'node:assert'
import {
  baseModelWeight,
  buildReport,
  filterValidSearchResults,
  gradeForScore,
  isMintAccount,
  normalizeV2Token,
  normalizeV3Price,
  parseTimestampSeconds,
  scanToken2022Extensions,
  TOKEN_PROGRAM_ID,
} from '../.tmp-ssr/engine-entry.js'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

function fullOnchain() {
  return {
    mint: SOL_MINT,
    supply: '1000000000000000',
    decimals: 6,
    mintAuthority: null,
    freezeAuthority: null,
    metadataName: 'Solana',
    metadataSymbol: 'SOL',
    standard: 'SPL-Token',
    existsOnChain: true,
    extensions: null,
  }
}

// 1. Non-token / invalid input still resolves to a hard critical.
const invalidReport = buildReport({
  onchain: {
    mint: 'garbage***',
    supply: '0',
    decimals: 0,
    mintAuthority: null,
    freezeAuthority: null,
    metadataName: null,
    metadataSymbol: null,
    standard: null,
    existsOnChain: false,
  },
  token: null,
  price: null,
})
assert.strictEqual(invalidReport.grade, 'F')
assert.strictEqual(invalidReport.riskScore, 100)
assert.strictEqual(invalidReport.coverage.limited, false)
assert.ok(invalidReport.factors.some((f) => f.id === 'onchain'))

// 2. Well-evidenced, genuinely safe mint → clean verdict, full coverage.
const cleanReport = buildReport({
  onchain: fullOnchain(),
  token: {
    address: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    tags: { verified: true },
    created_at: 1600000000,
    audit: {
      topHoldersPercentage: 12,
      devMints: 0,
    },
  },
  price: {
    id: SOL_MINT,
    price: '1',
    priceChange24h: '0.5',
    volume24h: '50000000',
    marketCap: '1000000000',
    totalSupply: null,
    circulatingSupply: null,
  },
})
assert.ok(['A', 'B'].includes(cleanReport.grade))
assert.strictEqual(cleanReport.coverage.limited, false)
assert.strictEqual(cleanReport.coverage.missingChecks, 0)
assert.ok(cleanReport.summary.includes('relatively clean'))
assert.ok(cleanReport.factors.some((f) => f.id === 'freeze'))
assert.ok(cleanReport.factors.some((f) => f.id === 'trust'))
assert.ok(cleanReport.factors.some((f) => f.id === 'holders'))
assert.strictEqual(
  cleanReport.factors.find((f) => f.id === 'holders')?.severity,
  'low',
)

// 2b. Concentrated holders push risk up via the holder factor.
const concentratedReport = buildReport({
  onchain: fullOnchain(),
  token: {
    address: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    audit: { topHoldersPercentage: 85, devMints: 3 },
  },
  price: null,
})
const holderFactor = concentratedReport.factors.find((f) => f.id === 'holders')
assert.strictEqual(holderFactor?.severity, 'critical')

// 3. On-chain mint with NO market data → limited coverage, no clean verdict.
const blindReport = buildReport({
  onchain: fullOnchain(),
  token: null,
  price: null,
})
assert.strictEqual(blindReport.coverage.limited, true)
assert.ok(blindReport.coverage.missingChecks >= 1)
assert.ok(!blindReport.summary.includes('relatively clean'))
assert.ok(blindReport.factors.some((f) => f.id === 'trust'))
assert.ok(blindReport.factors.some((f) => f.id === 'liquidity'))
assert.ok(blindReport.factors.some((f) => f.id === 'age'))
assert.ok(blindReport.factors.some((f) => f.unverified === true))

// 4. Token-2022 extension scanning.
const withDelegate = new Uint8Array(82 + 3 + 32)
withDelegate[82] = 12 // EXT_PERMANENT_DELEGATE
withDelegate[84] = 32 // length (big-endian) = 0x0020
withDelegate[85] = 1 // nonzero pubkey byte
const ext1 = scanToken2022Extensions(withDelegate)
assert.strictEqual(ext1.audited, true)
assert.strictEqual(ext1.permanentDelegate, true)

const zeroDelegate = new Uint8Array(82 + 3 + 32)
zeroDelegate[82] = 12
zeroDelegate[84] = 32
const ext2 = scanToken2022Extensions(zeroDelegate)
assert.strictEqual(ext2.audited, true)
assert.strictEqual(ext2.permanentDelegate, false)

const withHook = new Uint8Array(82 + 3 + 1)
withHook[82] = 13 // EXT_TRANSFER_HOOK
withHook[84] = 1 // length = 0x0001
withHook[85] = 0
const ext3 = scanToken2022Extensions(withHook)
assert.strictEqual(ext3.transferHook, true)
assert.strictEqual(ext3.audited, true)

const tooShort = scanToken2022Extensions(new Uint8Array(10))
assert.strictEqual(tooShort.audited, false)

// 5. Mint account validation (reject token accounts, wrong owner, uninit).
const mintAcct = {
  owner: TOKEN_PROGRAM_ID,
  program: 'spl-token',
  data: { parsed: { type: 'mint', info: { isInitialized: true } } },
}
assert.ok(isMintAccount(mintAcct))
assert.ok(
  !isMintAccount({
    owner: TOKEN_PROGRAM_ID,
    data: { parsed: { type: 'account', info: {} } },
  }),
)
assert.ok(
  !isMintAccount({
    owner: 'HWoYdSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    data: { parsed: { type: 'mint', info: { isInitialized: true } } },
  }),
)
assert.ok(
  !isMintAccount({
    owner: TOKEN_PROGRAM_ID,
    data: { parsed: { type: 'mint', info: { isInitialized: false } } },
  }),
)

// 6. Timestamp normalization.
assert.strictEqual(parseTimestampSeconds('2023-01-01T00:00:00Z'), 1672531200)
assert.strictEqual(parseTimestampSeconds('garbage'), null)
assert.strictEqual(parseTimestampSeconds(null), null)
assert.strictEqual(parseTimestampSeconds(1700000000), 1700000000)
assert.strictEqual(parseTimestampSeconds(1700000000000), 1700000000)
assert.strictEqual(parseTimestampSeconds(NaN), null)

// 7. Token V2 normalization (ISO date, numbers, tags).
const normalized = normalizeV2Token({
  id: SOL_MINT,
  name: 'Solana',
  symbol: 'SOL',
  decimals: 9,
  createdAt: '2023-01-01T00:00:00Z',
  mcap: 1000000,
  tags: ['verified', 'strict'],
  stats24h: { buyVolume: 10, sellVolume: 20 },
})
assert.strictEqual(normalized.created_at, 1672531200)
assert.strictEqual(normalized.mcap, 1000000)
assert.strictEqual(normalized.daily_volume, 30)
assert.strictEqual(normalized.tags['verified'], true)
assert.strictEqual(normalizeV2Token({ name: 'no id' }), null)
assert.strictEqual(normalizeV2Token(null), null)

const badDateToken = normalizeV2Token({
  id: SOL_MINT,
  createdAt: 'not-a-date',
})
assert.strictEqual(badDateToken.created_at, null)

// 8. Price V3 normalization.
assert.strictEqual(normalizeV3Price('m', { usdPrice: 1.5, priceChange24h: 2.5 }).price, '1.5')
assert.strictEqual(normalizeV3Price('m', { usdPrice: 1.5 }).priceChange24h, null)
assert.strictEqual(normalizeV3Price('m', { liquidity: 5 }), null)
assert.strictEqual(normalizeV3Price('m', null), null)

// 9. Search result filtering keeps only well-formed mints.
assert.strictEqual(
  filterValidSearchResults([
    { mint: SOL_MINT, symbol: 'SOL' },
    { mint: 'not-a-key', symbol: 'NOPE' },
  ]).length,
  1,
)

// 10. Grade thresholds.
assert.strictEqual(gradeForScore(19).grade, 'A')
assert.strictEqual(gradeForScore(20).grade, 'B')
assert.strictEqual(gradeForScore(35).grade, 'C')
assert.strictEqual(gradeForScore(50).grade, 'D')
assert.strictEqual(gradeForScore(70).grade, 'F')

// 11. The documented base scoring model must total exactly 100.
assert.strictEqual(baseModelWeight(), 100)

console.log('All deterministic scoring tests passed.')