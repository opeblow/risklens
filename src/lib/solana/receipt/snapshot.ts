import type { RiskFactor, RiskLevel, OnchainMintInfo, JupiterPrice, JupiterTokenInfo } from '../../types'

/** Schema and engine version identifiers — bump when the snapshot layout changes. */
export const SNAPSHOT_SCHEMA_VERSION = 'risklens:snapshot:v1'
export const SCORING_ENGINE_VERSION = '1.0.0'

export interface SnapshotFactor {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  weight: number
  score: number
  detail: string
  evidence: string
}

export interface SnapshotCoverage {
  limited: boolean
  missingChecks: number
}

export interface SnapshotSource {
  /** The Solana network the report was analysed against. */
  analysisNetwork: 'mainnet-beta' | 'devnet' | 'testnet'
  /** Human-readable label for the data source. */
  dataSources: string[]
}

/** Minimal serialisable subset of onchain data — no RPC credentials. */
export interface SnapshotOnchain {
  mint: string
  supply: string
  decimals: number
  mintAuthority: string | null
  freezeAuthority: string | null
  metadataName: string | null
  metadataSymbol: string | null
  standard: string | null
  existsOnChain: boolean
}

/** Minimal serialisable market data. */
export interface SnapshotMarket {
  price: string | null
  priceChange24h: string | null
  volume24h: string | null
  marketCap: string | null
  totalSupply: string | null
  circulatingSupply: string | null
  liquidity: number | null
}

/**
 * Versioned report snapshot that gets hashed and published on-chain.
 *
 * All numeric values that could be large integers or exact decimals are
 * serialised as strings. Optional fields use `null` (not `undefined`).
 * No secrets, private keys, or RPC credentials are included.
 * Transaction metadata is deliberately excluded to avoid circular hashing.
 */
export interface RiskLensReportSnapshotV1 {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION
  scoringEngineVersion: string
  source: SnapshotSource
  asset: {
    mint: string
    symbol: string
    name: string
    isNativeSol: boolean
  }
  analysis: {
    pulledAt: number
  }
  result: {
    riskScore: number
    grade: string
    level: RiskLevel
    summary: string
    factors: SnapshotFactor[]
  }
  coverage: SnapshotCoverage
  onchain: SnapshotOnchain
  market: SnapshotMarket
  logo: string | null
}

/** Validate that a value is a finite number. Rejects NaN, Infinity. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Validate that a value is a string. */
function isString(v: unknown): v is string {
  return typeof v === 'string'
}

/** Validate a RiskLevel value. */
function isRiskLevel(v: unknown): v is RiskLevel {
  return v === 'critical' || v === 'high' || v === 'medium' || v === 'low' || v === 'unknown'
}

const VALID_NETWORKS = ['mainnet-beta', 'devnet', 'testnet'] as const
type ValidNetwork = typeof VALID_NETWORKS[number]

/**
 * Build a snapshot from a RiskReport. Validates every field and normalises
 * optional values. Throws on invalid input rather than silently dropping data.
 */
export function buildSnapshot(report: {
  mint: string
  symbol: string
  name: string
  logo?: string | null
  riskScore: number
  grade: string
  level: RiskLevel
  summary: string
  factors: RiskFactor[]
  pulledAt: number
  coverage?: { limited: boolean; missingChecks: number } | null
  onchain?: OnchainMintInfo | null
  price?: JupiterPrice | null
  token?: JupiterTokenInfo | null
}, analysisNetwork: ValidNetwork = 'mainnet-beta'): RiskLensReportSnapshotV1 {
  if (!isFiniteNumber(report.riskScore)) {
    throw new Error('Invalid riskScore: must be a finite number')
  }
  if (!isString(report.mint) || !report.mint) {
    throw new Error('Invalid mint: must be a non-empty string')
  }
  if (!isString(report.grade) || !report.grade) {
    throw new Error('Invalid grade: must be a non-empty string')
  }
  if (!isRiskLevel(report.level)) {
    throw new Error(`Invalid level: ${String(report.level)}`)
  }
  if (!isFiniteNumber(report.pulledAt)) {
    throw new Error('Invalid pulledAt: must be a finite number')
  }

  const isNativeSol = report.mint === 'So11111111111111111111111111111111111111112'

  const factors: SnapshotFactor[] = report.factors.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    weight: f.weight,
    score: f.score,
    detail: f.detail,
    evidence: f.evidence,
  }))

  const onchain: SnapshotOnchain = report.onchain
    ? {
      mint: report.onchain.mint,
      supply: String(report.onchain.supply),
      decimals: report.onchain.decimals,
      mintAuthority: report.onchain.mintAuthority ?? null,
      freezeAuthority: report.onchain.freezeAuthority ?? null,
      metadataName: report.onchain.metadataName ?? null,
      metadataSymbol: report.onchain.metadataSymbol ?? null,
      standard: report.onchain.standard ?? null,
      existsOnChain: report.onchain.existsOnChain,
    }
    : {
      mint: report.mint,
      supply: '0',
      decimals: 0,
      mintAuthority: null,
      freezeAuthority: null,
      metadataName: null,
      metadataSymbol: null,
      standard: null,
      existsOnChain: false,
    }

  const market: SnapshotMarket = {
    price: report.price?.price ?? null,
    priceChange24h: report.price?.priceChange24h ?? null,
    volume24h: report.price?.volume24h ?? null,
    marketCap: report.price?.marketCap ?? null,
    totalSupply: report.price?.totalSupply ?? null,
    circulatingSupply: report.price?.circulatingSupply ?? null,
    liquidity: report.price?.liquidity ?? null,
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    source: {
      analysisNetwork,
      dataSources: ['solana-rpc', 'jupiter-api'],
    },
    asset: {
      mint: report.mint,
      symbol: (report.symbol || '???'),
      name: (report.name || 'Unknown'),
      isNativeSol,
    },
    analysis: {
      pulledAt: report.pulledAt,
    },
    result: {
      riskScore: report.riskScore,
      grade: report.grade,
      level: report.level,
      summary: report.summary,
      factors,
    },
    coverage: {
      limited: report.coverage?.limited ?? false,
      missingChecks: report.coverage?.missingChecks ?? 0,
    },
    onchain,
    market,
    logo: report.logo ?? null,
  }
}
