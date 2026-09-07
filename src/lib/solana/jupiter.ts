import type {
  JupiterPrice,
  JupiterTokenInfo,
  TokenMeta,
} from '../types'

const TOKEN_LIST_URL = 'https://token.jup.ag/all'
const TOKEN_V1 = 'https://api.jup.ag/tokens/v1'
const PRICE_V1 = 'https://price.jup.ag/v6/price?ids='

let cachedTokenList: Map<string, TokenMeta> | null = null
let tokenListPromise: Promise<Map<string, TokenMeta>> | null = null

interface JupiterListToken {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  daily_volume?: number
  tags?: string[]
}

async function loadTokenList(): Promise<Map<string, TokenMeta>> {
  if (cachedTokenList) return cachedTokenList
  if (tokenListPromise) return tokenListPromise

  tokenListPromise = (async () => {
    const res = await fetch(TOKEN_LIST_URL, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to load token list')
    const raw = (await res.json()) as JupiterListToken[]
    const map = new Map<string, TokenMeta>()
    for (const t of raw) {
      if (!t.address) continue
      map.set(t.address, {
        mint: t.address,
        symbol: t.symbol || '???',
        name: t.name || t.symbol || 'Unknown',
        decimals: t.decimals ?? 9,
        logo: t.logoURI ?? null,
        tags: Array.isArray(t.tags) ? t.tags : [],
      })
    }
    cachedTokenList = map
    return map
  })()

  return tokenListPromise
}

export async function searchTokens(
  query: string,
  limit = 8,
): Promise<TokenMeta[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const map = await loadTokenList()
  const results: TokenMeta[] = []
  const matchesSymbol: TokenMeta[] = []
  const matchesAddress = map.get(q)

  for (const t of map.values()) {
    if (t.mint === q) {
      results.unshift(t)
      break
    }
  }
  if (matchesAddress && !results.includes(matchesAddress)) {
    results.unshift(matchesAddress)
  }
  for (const t of map.values()) {
    const sym = t.symbol?.toLowerCase() ?? ''
    const name = t.name?.toLowerCase() ?? ''
    if (sym === q || name === q) {
      matchesSymbol.push(t)
    }
  }
  for (const t of matchesSymbol) {
    if (!results.includes(t)) results.push(t)
  }
  if (results.length < limit) {
    for (const t of map.values()) {
      if (t.symbol?.toLowerCase().startsWith(q)) {
        if (!results.includes(t)) results.push(t)
      }
    }
  }
  if (results.length < limit) {
    for (const t of map.values()) {
      if (t.name?.toLowerCase().includes(q)) {
        if (!results.includes(t)) results.push(t)
      }
    }
  }
  return results.slice(0, limit)
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface JupiterTokenInfoRes extends JupiterTokenInfo {
  address: string
}

export async function getTokenInfo(mint: string): Promise<JupiterTokenInfo | null> {
  try {
    const data = (await fetchJson(
      `${TOKEN_V1}/token/${mint}`,
    )) as JupiterTokenInfoRes
    if (!data || typeof data.address !== 'string') return null
    return {
      address: data.address,
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      tags: data.tags,
      logoURI: data.logoURI,
      daily_volume: data.daily_volume,
      created_at: data.created_at,
      freeze_authority: data.freeze_authority,
      mint_authority: data.mint_authority,
      permanent_delegate: data.permanent_delegate,
      extensions: data.extensions,
    }
  } catch {
    return null
  }
}

export interface JupPrice {
  price: string
  priceChange24h?: string | null
  volume24h?: string | null
  marketCap?: string | null
  totalSupply?: string | null
  circulatingSupply?: string | null
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
    const res = await fetch(q, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, CgPrice>
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
      `${PRICE_V1}${encodeURIComponent(mint)}`,
    )) as { data?: Record<string, JupPrice> }
    const p = raw?.data?.[mint]
    if (p) {
      value = {
        id: mint,
        price: p.price ?? '0',
        priceChange24h: p.priceChange24h ?? null,
        volume24h: p.volume24h ?? null,
        marketCap: p.marketCap ?? null,
        totalSupply: p.totalSupply ?? null,
        circulatingSupply: p.circulatingSupply ?? null,
      }
    }
  } catch {
    // jupiter down — fall through to CoinGecko
  }
  if (!value) value = await getCoinGeckoPrice(mint)
  priceCache.set(mint, { at: Date.now(), value })
  return value
}

export async function getTokenMeta(mint: string): Promise<TokenMeta | null> {
  try {
    const map = await loadTokenList()
    return map.get(mint) ?? null
  } catch {
    return null
  }
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