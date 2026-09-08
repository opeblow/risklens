import type {
  JupiterPrice,
  JupiterTokenInfo,
  TokenMeta,
} from '../types'
import { isValidPubkey } from './rpc'

// Current Jupiter APIs (Tokens V2 + Price V3); older /v1 and /v6 endpoints
// are deprecated and no longer live.
const TOKENS_V2 = 'https://api.jup.ag/tokens/v2'
const PRICE_V3 = 'https://api.jup.ag/price/v3'
const FETCH_TIMEOUT_MS = 10_000
const TOKEN_INFO_TTL_MS = 120_000

const API_KEY = (import.meta.env?.VITE_JUPITER_API_KEY as unknown) as
  | string
  | undefined

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (API_KEY) headers['x-api-key'] = API_KEY
    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Coerce a finite number from unknown input (number or numeric string). */
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Normalize a timestamp to unix seconds. Accepts ISO date strings, seconds,
 * and millisecond epochs; rejects NaN and garbage instead of leaking them
 * into age calculations.
 */
export function parseTimestampSeconds(v: unknown): number | null {
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v.trim())
    if (Number.isFinite(t)) return Math.floor(t / 1000)
    return null
  }
  const n = num(v)
  if (n == null) return null
  if (n > 1e12) return Math.floor(n / 1000)
  return Math.floor(n)
}

// --- Tokens V2 (search / metadata) -----------------------------------------

interface TokenV2SearchItem {
  id?: unknown
  name?: unknown
  symbol?: unknown
  icon?: unknown
  decimals?: unknown
  mintedAt?: unknown
  createdAt?: unknown
  circSupply?: unknown
  mcap?: unknown
  dailyVolume?: unknown
  isVerified?: unknown
  organicScore?: unknown
  tags?: unknown
  audit?: Record<string, unknown>
  stats24h?: Record<string, unknown>
  liquidity?: unknown
  usdPrice?: unknown
}

export function normalizeV2Token(raw: unknown): JupiterTokenInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as TokenV2SearchItem
  if (typeof t.id !== 'string' || !t.id) return null

  const stats = t.stats24h && typeof t.stats24h === 'object' ? t.stats24h : null
  const buyVol = num(stats?.buyVolume)
  const sellVol = num(stats?.sellVolume)
  let daily_volume: number | undefined
  if (buyVol != null && sellVol != null) daily_volume = buyVol + sellVol
  else if (buyVol != null) daily_volume = buyVol

  let audit: JupiterTokenInfo['audit'] = null
  if (t.audit && typeof t.audit === 'object') {
    audit = {
      mintAuthorityDisabled:
        typeof t.audit.mintAuthorityDisabled === 'boolean'
          ? t.audit.mintAuthorityDisabled
          : null,
      freezeAuthorityDisabled:
        typeof t.audit.freezeAuthorityDisabled === 'boolean'
          ? t.audit.freezeAuthorityDisabled
          : null,
      topHoldersPercentage: num(t.audit.topHoldersPercentage),
      devMints: num(t.audit.devMints),
    }
  }

  let tags: JupiterTokenInfo['tags']
  if (Array.isArray(t.tags) && t.tags.length) {
    tags = Object.fromEntries(
      t.tags.filter((x): x is string => typeof x === 'string').map((x) => [x, true]),
    )
  }

  return {
    address: t.id,
    symbol: typeof t.symbol === 'string' ? t.symbol : undefined,
    name: typeof t.name === 'string' ? t.name : undefined,
    decimals: num(t.decimals) ?? undefined,
    tags,
    logoURI: typeof t.icon === 'string' && t.icon ? t.icon : undefined,
    daily_volume,
    created_at: parseTimestampSeconds(t.createdAt ?? t.mintedAt),
    organicScore: num(t.organicScore),
    isVerified: typeof t.isVerified === 'boolean' ? t.isVerified : null,
    mcap: num(t.mcap),
    circSupply: num(t.circSupply),
    freeze_authority: null,
    mint_authority: null,
    permanent_delegate: null,
    audit,
  }
}

function toTokenMeta(t: JupiterTokenInfo): TokenMeta {
  const tags = t.tags ? Object.keys(t.tags) : []
  return {
    mint: t.address,
    symbol: t.symbol || '???',
    name: t.name || t.symbol || 'Unknown',
    decimals: t.decimals ?? 9,
    logo: t.logoURI ?? null,
    tags,
  }
}

const tokenInfoCache = new Map<
  string,
  { at: number; value: Promise<JupiterTokenInfo | null> }
>()

async function fetchTokenInfo(mint: string): Promise<JupiterTokenInfo | null> {
  try {
    const raw = await fetchJson(
      `${TOKENS_V2}/search?query=${encodeURIComponent(mint)}`,
    )
    if (!Array.isArray(raw)) return null
    for (const item of raw) {
      const t = normalizeV2Token(item)
      if (t && t.address === mint) return t
    }
    return null
  } catch {
    return null
  }
}

export function getTokenInfo(mint: string): Promise<JupiterTokenInfo | null> {
  const cached = tokenInfoCache.get(mint)
  if (cached && Date.now() - cached.at < TOKEN_INFO_TTL_MS) return cached.value
  const promise = fetchTokenInfo(mint)
  tokenInfoCache.set(mint, { at: Date.now(), value: promise })
  promise.catch(() => {
    if (tokenInfoCache.get(mint)?.value === promise) {
      tokenInfoCache.delete(mint)
    }
  })
  return promise
}

export async function getTokenMeta(mint: string): Promise<TokenMeta | null> {
  const info = await getTokenInfo(mint)
  return info ? toTokenMeta(info) : null
}

/**
 * Drop results whose mint string isn't a well-formed public key so an exact
 * match within a search response can't be an invalid/arbitrary string.
 */
export function filterValidSearchResults<T extends { mint: string }>(
  list: T[],
): T[] {
  return list.filter((t) => t && isValidPubkey(t.mint))
}

export async function searchTokens(
  query: string,
  limit = 8,
): Promise<TokenMeta[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const raw = await fetchJson(
      `${TOKENS_V2}/search?query=${encodeURIComponent(q)}`,
    )
    if (!Array.isArray(raw)) return []
    const out: TokenMeta[] = []
    for (const item of raw) {
      const t = normalizeV2Token(item)
      if (!t) continue
      const meta = toTokenMeta(t)
      out.push(meta)
      if (out.length >= limit) break
    }
    return filterValidSearchResults(out)
  } catch {
    return []
  }
}

// --- Price V3 -----------------------------------------------------------------

interface PriceV3Entry {
  createdAt?: unknown
  liquidity?: unknown
  usdPrice?: unknown
  blockId?: unknown
  decimals?: unknown
  priceChange24h?: unknown
}

export function normalizeV3Price(
  mint: string,
  raw: unknown,
): JupiterPrice | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as PriceV3Entry
  const price = num(d.usdPrice)
  if (price == null) return null
  return {
    id: mint,
    price: String(price),
    priceChange24h: d.priceChange24h != null ? String(d.priceChange24h) : null,
    volume24h: null,
    marketCap: null,
    totalSupply: null,
    circulatingSupply: null,
    liquidity: num(d.liquidity),
  }
}

// Fallback when jup.ag is down: CoinGecko covers major Solana tokens
// (mints verified against CoinGecko's platform registry).
const COINGECKO_IDS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'solana',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'usd-coin',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'bonk',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'jupiter-exchange-solana',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'jito-staked-sol',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'msol',
  MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey: 'marinade',
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: 'jito-governance-token',
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: 'pyth-network',
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 'dogwifcoin',
}

interface CgPrice {
  usd?: number
  usd_market_cap?: number
  usd_24h_vol?: number
  usd_24h_change?: number
}

async function getCoinGeckoPrice(
  mint: string,
): Promise<JupiterPrice | null> {
  const id = COINGECKO_IDS[mint]
  if (!id) return null
  try {
    const q =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${id}&vs_currencies=usd` +
      `&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    const data = (await fetchJson(q)) as Record<string, CgPrice>
    const d = data[id]
    if (!d || d.usd == null) return null
    return {
      id: mint,
      price: String(d.usd),
      priceChange24h: d.usd_24h_change != null ? String(d.usd_24h_change) : null,
      volume24h: d.usd_24h_vol != null ? String(d.usd_24h_vol) : null,
      marketCap: d.usd_market_cap != null ? String(d.usd_market_cap) : null,
      totalSupply: null,
      circulatingSupply: null,
    }
  } catch {
    return null
  }
}

const priceCache = new Map<string, { at: number; value: JupiterPrice | null }>()
const PRICE_TTL_MS = 120_000

export async function getTokenPrice(
  mint: string,
): Promise<JupiterPrice | null> {
  const cached = priceCache.get(mint)
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.value
  let value: JupiterPrice | null = null
  try {
    const raw = (await fetchJson(
      `${PRICE_V3}?ids=${encodeURIComponent(mint)}`,
    )) as Record<string, unknown>
    value = normalizeV3Price(mint, raw?.[mint])
  } catch {
    // jupiter down — fall through
  }
  if (value) {
    // Enrich with market size / turnover from the metadata endpoint.
    const token = await getTokenInfo(mint).catch(() => null)
    if (token) {
      if (token.mcap != null) value.marketCap = String(token.mcap)
      if (token.circSupply != null)
        value.circulatingSupply = String(token.circSupply)
      if (token.daily_volume != null) value.volume24h = String(token.daily_volume)
    }
  }
  if (!value) value = await getCoinGeckoPrice(mint)
  priceCache.set(mint, { at: Date.now(), value })
  return value
}

// Twelve "top tokens" for the trending rail — pulled from a curated safe list
export const TRENDING = [
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
]