import type {
  JupiterPrice,
  JupiterTokenInfo,
  OnchainMintInfo,
  RiskFactor,
  RiskLevel,
  RiskReport,
} from '../types'
import { getTokenInfo, getTokenMeta, getTokenPrice, parseTimestampSeconds } from './jupiter'
import { getMintInfo, isValidPubkey, UNKNOWN_SUPPLY } from './rpc'

export const RISK_GRADES = [
  { max: 19, grade: 'A', level: 'low' as RiskLevel, label: 'Low Risk' },
  { max: 34, grade: 'B', level: 'low' as RiskLevel, label: 'Good' },
  { max: 49, grade: 'C', level: 'medium' as RiskLevel, label: 'Elevated' },
  { max: 69, grade: 'D', level: 'high' as RiskLevel, label: 'High Risk' },
  { max: 100, grade: 'F', level: 'critical' as RiskLevel, label: 'Critical' },
]

export function gradeForScore(score: number): {
  grade: string
  level: RiskLevel
  label: string
} {
  for (const g of RISK_GRADES) {
    if (score <= g.max) return { grade: g.grade, level: g.level, label: g.label }
  }
  return { grade: 'F', level: 'critical', label: 'Critical' }
}

export function levelFromScore(score: number): RiskLevel {
  return gradeForScore(score).level
}

const fmtUsd = (n: number) => {
  if (!isFinite(n)) return 'n/a'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function isoAgo(ts?: number | null): number | null {
  if (!ts) return null
  const days = (Date.now() / 1000 - ts) / 86400
  return days
}

interface ScoreInput {
  onchain: OnchainMintInfo | null
  token: JupiterTokenInfo | null
  price: JupiterPrice | null
}

// Name/symbol fallback for well-known mints (covers native SOL and any
// token whose Metaplex metadata is missing while jup.ag is unavailable).
const KNOWN_MINT_NAMES: Record<string, { name: string; symbol: string }> = {
  So11111111111111111111111111111111111111112: { name: 'Solana', symbol: 'SOL' },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { name: 'USD Coin', symbol: 'USDC' },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { name: 'Bonk', symbol: 'BONK' },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { name: 'Jupiter', symbol: 'JUP' },
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: { name: 'Jito Staked SOL', symbol: 'jitoSOL' },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { name: 'dogwifhat', symbol: 'WIF' },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { name: 'Marinade staked SOL', symbol: 'mSOL' },
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: { name: 'Pyth Network', symbol: 'PYTH' },
}

function tagged(token: JupiterTokenInfo | null, tag: string): boolean {
  if (!token?.tags) return false
  if (Array.isArray(token.tags)) return token.tags.includes(tag)
  return token.tags[tag] === true
}

export function buildFactors(i: ScoreInput): RiskFactor[] {
  const f: RiskFactor[] = []
  const onchain = i.onchain
  const token = i.token
  const price = i.price

  // 1. Mint authority
  const mintAuth = onchain?.mintAuthority || token?.mint_authority || null
  if (mintAuth) {
    f.push({
      id: 'mint-auth',
      title: 'Mint authority enabled',
      severity: 'critical',
      weight: 20,
      score: 85,
      detail:
        'An account retains the power to mint new supply at any time. Supply can be inflated, diluting holders unexpectedly.',
      evidence: mintAuth,
    })
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'mint-auth',
      title: 'Mint authority revoked',
      severity: 'low',
      weight: 20,
      score: 0,
      detail:
        'No one can mint new tokens. The total supply is fixed on-chain — a strong signal against supply inflation.',
      evidence: 'revoked',
    })
  }

  // 2. Freeze authority
  const freezeAuth = onchain?.freezeAuthority || token?.freeze_authority || null
  if (freezeAuth) {
    f.push({
      id: 'freeze',
      title: 'Freeze authority present',
      severity: 'high',
      weight: 10,
      score: 70,
      detail:
        'An authority can freeze token accounts, which can lock user balances or restrict trading at any time.',
      evidence: freezeAuth,
    })
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'freeze',
      title: 'Freeze authority revoked',
      severity: 'low',
      weight: 10,
      score: 0,
      detail:
        'No account has the power to freeze balances — accounts cannot be locked or restricted.',
      evidence: 'revoked',
    })
  }

  // 3. Permanent delegate + Token-2022 extension audit
  const permDelegate =
    token?.permanent_delegate ??
    (onchain?.extensions?.audited && onchain.extensions.permanentDelegate
      ? 'on-chain permanent delegate'
      : null) ??
    null
  if (permDelegate) {
    f.push({
      id: 'delegate',
      title: 'Permanent delegate assigned',
      severity: 'critical',
      weight: 10,
      score: 90,
      detail:
        'A permanent delegate can move tokens belonging to every holder without their approval (often used for taxation).',
      evidence: permDelegate,
    })
  } else if (onchain?.standard === 'SPL-Token-2022' && onchain.extensions?.audited) {
    f.push({
      id: 'delegate',
      title: 'No permanent delegate',
      severity: 'low',
      weight: 10,
      score: 10,
      detail:
        'No permanent-delegate extension was detected on-chain — balances cannot be seized without each holder’s approval.',
      evidence: 'none detected',
    })
  } else if (onchain?.standard === 'SPL-Token-2022') {
    f.push({
      id: 'delegate',
      title: 'Token-2022 extensions not audited',
      severity: 'medium',
      weight: 10,
      score: 50,
      detail:
        'Could not verify this mint’s Token-2022 extension layout. A hidden permanent delegate or transfer hook could seize or tax balances.',
      evidence: 'extensions unverified',
      unverified: true,
    })
  }
  if (onchain?.standard === 'SPL-Token-2022' && onchain.extensions?.audited) {
    if (onchain.extensions.transferHook) {
      f.push({
        id: 'transfer-hook',
        title: 'Transfer hook enabled',
        severity: 'high',
        weight: 8,
        score: 75,
        detail:
          'Every transfer triggers an external program, which can tax, blacklist, or otherwise interfere with transactions.',
        evidence: 'transfer hook detected',
      })
    }
    if (onchain.extensions.mintCloseAuthority) {
      f.push({
        id: 'mint-close',
        title: 'Mint close authority present',
        severity: 'medium',
        weight: 6,
        score: 60,
        detail:
          'The mint can be closed by an authority, which permanently destroys all outstanding tokens.',
        evidence: 'mint-close extension detected',
      })
    }
  }

  // 4. Supply / circulating distribution
  let supplyRatio: number | null = null
  let total = price?.totalSupply ? Number(price.totalSupply) : null
  let circ = price?.circulatingSupply
    ? Number(price.circulatingSupply)
    : null
  // On-chain supply fallback (raw units -> tokens)
  if (!total && onchain?.supply && onchain.supply !== '0') {
    total = Number(onchain.supply) / 10 ** (onchain.decimals || 0)
  }
  // Implied circulating = market cap / price (in token units)
  if (
    circ == null &&
    price?.marketCap &&
    Number(price.price) > 0 &&
    total != null
  ) {
    circ = Number(price.marketCap) / Number(price.price)
  }
  if (total && circ != null && total > 0 && circ > 0) {
    supplyRatio = Math.min(1.2, circ / total)
  }
  if (supplyRatio != null) {
    if (supplyRatio < 0.25) {
      f.push({
        id: 'supply',
        title: 'Most supply is not circulating',
        severity: 'high',
        weight: 15,
        score: 80,
        detail: `Only ${(supplyRatio * 100).toFixed(0)}% of total supply is circulating. Large locked or unlisted supply can dump later.`,
        evidence: `circ ${(supplyRatio * 100).toFixed(1)}% / total`,
      })
    } else if (supplyRatio <= 0.6) {
      f.push({
        id: 'supply',
        title: 'Partially circulating supply',
        severity: 'medium',
        weight: 15,
        score: 45,
        detail: `${(supplyRatio * 100).toFixed(0)}% of total supply is circulating. Watch for future unlocks.`,
        evidence: `circ ${(supplyRatio * 100).toFixed(1)}% / total`,
      })
    } else {
      f.push({
        id: 'supply',
        title: 'Supply is broadly circulating',
        severity: 'low',
        weight: 15,
        score: 10,
        detail: `${(supplyRatio * 100).toFixed(0)}% of supply is circulating — dilution pressure is limited.`,
        evidence: `circ ${(supplyRatio * 100).toFixed(1)}% / total`,
      })
    }
  } else if (onchain?.existsOnChain && total != null && total > 0) {
    // On-chain total known but circulating share could not be verified.
    f.push({
      id: 'supply',
      title: 'Circulating supply unclear',
      severity: 'medium',
      weight: 15,
      score: 50,
      detail:
        'Could not verify what share of supply is circulating. On-chain total is known.',
      evidence: fmtUsd(total),
      unverified: true,
    })
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'supply',
      title: 'Supply data unavailable',
      severity: 'medium',
      weight: 15,
      score: 50,
      detail:
        'Could not verify token supply totals for this mint.',
      evidence: 'supply n/a',
      unverified: true,
    })
  }

  // 5. Market size (liquidity health)
  const mcap = price?.marketCap ? Number(price.marketCap) : null
  const vol = price?.volume24h ? Number(price.volume24h) : token?.daily_volume
  if (mcap != null) {
    if (mcap < 50_000) {
      f.push({
        id: 'liquidity',
        title: 'Very small market size',
        severity: 'high',
        weight: 15,
        score: 75,
        detail: `Market cap is ${fmtUsd(mcap)}. Low market cap tokens are far easier to manipulate and can crash quickly.`,
        evidence: fmtUsd(mcap),
      })
    } else if (mcap < 500_000) {
      f.push({
        id: 'liquidity',
        title: 'Thin market size',
        severity: 'medium',
        weight: 15,
        score: 50,
        detail: `Market cap is ${fmtUsd(mcap)} — meaningful slippage and volatility risk.`,
        evidence: fmtUsd(mcap),
      })
    } else {
      f.push({
        id: 'liquidity',
        title: 'Healthy market size',
        severity: 'low',
        weight: 15,
        score: 8,
        detail: `Market cap is ${fmtUsd(mcap)}, suggesting usable on-chain liquidity.`,
        evidence: fmtUsd(mcap),
      })
    }
    if (vol != null && vol > 0 && mcap > 0) {
      const turnover = vol / mcap
      if (turnover > 2) {
        f.push({
          id: 'turnover',
          title: 'Extreme 24h volume vs cap',
          severity: 'high',
          weight: 10,
          score: 70,
          detail: `24h volume is ${turnover.toFixed(1)}× the market cap — consistent with wash trading or accumulator churn.`,
          evidence: `vol/cap ${turnover.toFixed(1)}×`,
        })
      } else if (turnover > 0.2) {
        f.push({
          id: 'turnover',
          title: 'Active trading',
          severity: 'low',
          weight: 10,
          score: 15,
          detail: `Volume is healthy relative to cap.`,
          evidence: `vol/cap ${turnover.toFixed(1)}×`,
        })
      } else {
        f.push({
          id: 'turnover',
          title: 'Thin trading volume',
          severity: 'medium',
          weight: 10,
          score: 55,
          detail: `24h volume is only ${(turnover * 100).toFixed(0)}% of cap — exiting positions may be hard.`,
          evidence: `vol/cap ${turnover.toFixed(1)}×`,
        })
      }
    } else {
      f.push({
        id: 'turnover',
        title: 'Volume data unavailable',
        severity: 'medium',
        weight: 10,
        score: 50,
        detail: 'Could not verify 24h trading volume for this token.',
        evidence: 'vol n/a',
        unverified: true,
      })
    }
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'liquidity',
      title: 'Market data unavailable',
      severity: 'medium',
      weight: 15,
      score: 50,
      detail:
        'Could not retrieve market cap / liquidity data right now. Verify on a DEX before trading.',
      evidence: 'mcap n/a',
      unverified: true,
    })
    f.push({
      id: 'turnover',
      title: 'Volume data unavailable',
      severity: 'medium',
      weight: 10,
      score: 50,
      detail:
        'Could not verify 24h trading volume or market depth for this token.',
      evidence: 'vol n/a',
      unverified: true,
    })
  }

  // 6. Price volatility
  if (price?.priceChange24h != null) {
    const chg = Number(price.priceChange24h)
    const a = Math.abs(chg)
    if (a > 150) {
      f.push({
        id: 'volatility',
        title: 'Extreme 24h price move',
        severity: 'critical',
        weight: 10,
        score: 80,
        detail: `Price moved ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% in 24h — high manipulation or pump risk.`,
        evidence: `${chg > 0 ? '+' : ''}${chg.toFixed(0)}% 24h`,
      })
    } else if (a > 40) {
      f.push({
        id: 'volatility',
        title: 'Large 24h price move',
        severity: 'medium',
        weight: 10,
        score: 45,
        detail: `Price moved ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% in 24h.`,
        evidence: `${chg > 0 ? '+' : ''}${chg.toFixed(0)}% 24h`,
      })
    } else {
      f.push({
        id: 'volatility',
        title: 'Stable price action',
        severity: 'low',
        weight: 10,
        score: 8,
        detail: `Price is relatively stable over 24h.`,
        evidence: `${chg > 0 ? '+' : ''}${chg.toFixed(1)}% 24h`,
      })
    }
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'volatility',
      title: 'Price move unknown',
      severity: 'medium',
      weight: 10,
      score: 50,
      detail: 'Could not determine 24h price movement.',
      evidence: '24h n/a',
      unverified: true,
    })
  }

  // 7. Token age
  const created = parseTimestampSeconds(token?.created_at ?? token?.minted_at ?? null)
  const ageDays = isoAgo(created)
  if (ageDays != null) {
    if (ageDays < 1) {
      f.push({
        id: 'age',
        title: 'Token is under a day old',
        severity: 'critical',
        weight: 5,
        score: 90,
        detail: `Minted ~${Math.max(1, Math.round(ageDays * 24))}h ago. New tokens carry the highest rug-pull risk.`,
        evidence: `age ${ageDays.toFixed(1)}d`,
      })
    } else if (ageDays < 7) {
      f.push({
        id: 'age',
        title: 'Token is brand new',
        severity: 'high',
        weight: 5,
        score: 60,
        detail: `Minted ${ageDays.toFixed(1)} days ago — little track record.`,
        evidence: `age ${ageDays.toFixed(1)}d`,
      })
    } else if (ageDays < 60) {
      f.push({
        id: 'age',
        title: 'Young token',
        severity: 'medium',
        weight: 5,
        score: 35,
        detail: `Minted ${ageDays.toFixed(0)} days ago.`,
        evidence: `age ${ageDays.toFixed(0)}d`,
      })
    } else {
      f.push({
        id: 'age',
        title: 'Established token',
        severity: 'low',
        weight: 5,
        score: 5,
        detail: `Minted ${(ageDays / 30).toFixed(1)} months ago — survived early-shakeout window.`,
        evidence: `age ${(ageDays / 30).toFixed(1)}mo`,
      })
    }
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'age',
      title: 'Token age unknown',
      severity: 'medium',
      weight: 5,
      score: 50,
      detail: 'Could not verify when this token was created or first traded.',
      evidence: 'age n/a',
      unverified: true,
    })
  }

  // 8. Trust tag
  const verified = tagged(token, 'verified') || token?.isVerified === true
  const community = tagged(token, 'community')
  if (verified) {
    f.push({
      id: 'trust',
      title: 'Verified on Jupiter',
      severity: 'low',
      weight: 10,
      score: 0,
      detail:
        'This token is in Jupiter’s verified list — it passes rigorous listing checks.',
      evidence: 'verified',
    })
  } else if (community) {
    f.push({
      id: 'trust',
      title: 'Community-listed token',
      severity: 'medium',
      weight: 10,
      score: 50,
      detail:
        'Listed as a community token on Jupiter — a somewhat higher degree of scrutiny is warranted.',
      evidence: 'community',
    })
  } else if (token && token.tags && Object.keys(token.tags).length > 0) {
    f.push({
      id: 'trust',
      title: 'Not verified',
      severity: 'high',
      weight: 10,
      score: 60,
      detail:
        'This mint does not carry Jupiter’s verified tag. Exercise extra caution.',
      evidence: 'unverified',
    })
  } else if (token) {
    f.push({
      id: 'trust',
      title: 'No verification data',
      severity: 'high',
      weight: 10,
      score: 65,
      detail:
        'No listing / verification evidence is available for this mint.',
      evidence: 'unverified',
      unverified: true,
    })
  } else if (onchain?.existsOnChain) {
    f.push({
      id: 'trust',
      title: 'Trust status unverified',
      severity: 'medium',
      weight: 10,
      score: 50,
      detail:
        'Could not verify this token’s listing or community status.',
      evidence: 'trust n/a',
      unverified: true,
    })
  }

  // Onchain metadata missing
  if (onchain && !onchain.existsOnChain && !onchain.rpcError) {
    f.push({
      id: 'onchain',
      title: 'No SPL token mint found',
      severity: 'critical',
      weight: 20,
      score: 100,
      detail:
        'The address does not resolve to a standard SPL token mint on mainnet.',
      evidence: onchain.mint,
    })
  }

  return f
}

export function makeSummary(
  mint: string,
  score: number,
  f: RiskFactor[],
  limited: boolean,
  missingChecks: number,
): string {
  const worst = [...f].sort((a, b) => b.score - a.score)[0]
  const flags = f.filter((x) => x.score >= 70).length
  const g = gradeForScore(score)
  const short = `${mint.slice(0, 6)}…${mint.slice(-4)}`
  const limitedNote = limited
    ? ` Market size, volume, age or trust signals could not be fully verified (${missingChecks} of ${f.length} checks unresolved) — this grade is provisional and not a "clean" verdict.`
    : ''
  if (flags === 0 && score < 35) {
    if (limited) {
      return `Data coverage for ${short} is limited.${limitedNote} On the available evidence risk scores ${score}/100 (${g.label}).`
    }
    return `This mint looks relatively clean. No high-severity flags were found — ${g.label.toLowerCase()} score of ${score}/100 for ${short}.`
  }
  if (worst) {
    return `Primary concern: ${worst.title.toLowerCase()}. ${flags} high-severity ${flags === 1 ? 'flag' : 'flags'} detected — overall risk ${g.label.toLowerCase()} (${score}/100) for ${short}.${limitedNote}`
  }
  return `No strong signals detected. Risk score ${score}/100 (${g.label}).`
}

export function buildReport(i: ScoreInput): RiskReport {
  const factors = buildFactors(i)
  const onchain = i.onchain
  const missingChecks = factors.filter((x) => x.unverified === true).length
  const hasMarket = i.price != null
  const hasMeta = i.token != null
  // Market evidence is complete when we have a price plus either metadata or
  // a currency-derived market cap. An on-chain mint with neither price nor
  // metadata must not present a "clean" verdict (issue: omitted factors
  // previously caused misleadingly low scores).
  const limited =
    (onchain?.existsOnChain ?? false) &&
    !(hasMarket && (hasMeta || i.price?.marketCap != null))
  const totalWeight = factors.reduce((a, b) => a + b.weight || a, 0) || 1
  const riskScore = Math.min(
    100,
    Math.round(
      factors.reduce((a, b) => a + (b.score * b.weight) / totalWeight, 0),
    ),
  )
  const g = gradeForScore(riskScore)
  const bullets = [...factors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => `${x.title}: ${x.detail}`)

  const mint = i.onchain?.mint ?? ''
  const known =
    (mint && KNOWN_MINT_NAMES[mint]) ||
    (i.price?.id && KNOWN_MINT_NAMES[i.price.id]) ||
    null
  return {
    mint,
    symbol:
      (i.token?.symbol || i.onchain?.metadataSymbol || known?.symbol ||
        '???') as string,
    name:
      (i.token?.name || i.onchain?.metadataName || known?.name ||
        'Unknown') as string,
    logo: i.token?.logoURI ?? null,
    riskScore,
    grade: g.grade,
    level: g.level,
    summary: makeSummary(
      i.onchain?.mint ?? '',
      riskScore,
      factors,
      limited,
      missingChecks,
    ),
    factors,
    bullets,
    pulledAt: Date.now(),
    coverage: { limited, missingChecks },
    token: i.token,
    price: i.price,
    onchain: i.onchain,
  }
}

export async function analyzeMint(rawMint: string): Promise<RiskReport> {
  const mint = rawMint?.trim() ?? ''
  if (!mint || !isValidPubkey(mint)) {
    const invalid: OnchainMintInfo = {
      mint,
      supply: UNKNOWN_SUPPLY,
      decimals: 0,
      mintAuthority: null,
      freezeAuthority: null,
      metadataName: null,
      metadataSymbol: null,
      standard: null,
      existsOnChain: false,
    }
    return buildReport({ onchain: invalid, token: null, price: null })
  }
  const [onchain, token, price, meta] = await Promise.all([
    getMintInfo(mint),
    getTokenInfo(mint),
    getTokenPrice(mint),
    getTokenMeta(mint),
  ])
  const mergedToken: JupiterTokenInfo | null =
    token ??
    (meta
      ? {
          address: meta.mint,
          symbol: meta.symbol,
          name: meta.name,
          decimals: meta.decimals,
          logoURI: meta.logo ?? undefined,
        }
      : null)
  return buildReport({ onchain, token: mergedToken, price })
}

export { fmtUsd }