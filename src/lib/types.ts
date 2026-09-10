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
  created_at?: number | null // unix seconds, normalized
  freeze_authority?: string | null
  mint_authority?: string | null
  permanent_delegate?: string | null
  minted_at?: string
  extensions?: Record<string, unknown>
  organicScore?: number | null
  isVerified?: boolean | null
  mcap?: number | null
  circSupply?: number | null
  audit?: {
    mintAuthorityDisabled?: boolean | null
    freezeAuthorityDisabled?: boolean | null
    topHoldersPercentage?: number | null
    devMints?: number | null
  } | null
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
  liquidity?: number | null
}

/** Result of scanning a Token-2022 mint's on-chain TLV extensions. */
export interface Token2022ExtensionState {
  audited: boolean
  permanentDelegate: boolean
  mintCloseAuthority: boolean
  transferHook: boolean
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
  /** Only populated for Token-2022 mints; null when not applicable. */
  extensions?: Token2022ExtensionState | null
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export interface RiskFactor {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  weight: number
  score: number
  detail: string
  evidence: string
  /** True when this factor is a neutral placeholder because evidence is missing. */
  unverified?: boolean
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
  /** How much of the intended evidence was actually verified. */
  coverage?: {
    limited: boolean
    missingChecks: number
  }
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

/** A locally-saved onchain receipt record. */
export interface StoredReceipt {
  signature: string
  cluster: string
  digest: string
  publisher: string
  mint: string
  symbol: string
  analysisNetwork: string
  confirmedAt: number
  slot?: number
}