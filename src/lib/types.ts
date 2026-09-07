export interface TokenMeta {
  mint: string
  symbol: string
  name: string
  decimals: number
  logo?: string | null
  tags?: string[]
}

export interface JupiterTokenInfo {
  address: string
  symbol?: string
  name?: string
  decimals?: number
  tags?: Record<string, boolean>
  logoURI?: string
  daily_volume?: number
  created_at?: number
  freeze_authority?: string | null
  mint_authority?: string | null
  permanent_delegate?: string | null
  minted_at?: string
  extensions?: Record<string, unknown>
}

export interface JupiterPrice {
  id: string
  type?: string
  price: string
  priceChange24h: string | null
  volume24h: string | null
  marketCap: string | null
  totalSupply: string | null
  circulatingSupply: string | null
  dailyVolume?: string
}

export interface OnchainMintInfo {
  mint: string
  supply: string
  decimals: number
  mintAuthority: string | null
  freezeAuthority: string | null
  metadataName: string | null
  metadataSymbol: string | null
  standard: string | null
  existsOnChain: boolean
  rpcError?: boolean
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export interface RiskFactor {
  id: string
  title: string
  severity: RiskLevel
  weight: number
  score: number // 0..100 (higher = more risk)
  detail: string
  evidence: string
}

export interface RiskReport {
  mint: string
  symbol: string
  name: string
  logo?: string | null
  riskScore: number // 0..100
  grade: string
  level: RiskLevel
  summary: string
  factors: RiskFactor[]
  bullets: string[]
  pulledAt: number
  token?: JupiterTokenInfo | null
  price?: JupiterPrice | null
  onchain?: OnchainMintInfo | null
}

export interface Attestation {
  id: string
  mint: string
  symbol: string
  score: number
  grade: string
  message: string
  address: string
  signature: string
  createdAt: number
}

export interface AppSettings {
  supabaseUrl?: string
  supabaseKey?: string
  anthropicKey?: string
}