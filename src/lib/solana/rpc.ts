import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import type { OnchainMintInfo } from '../types'

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)
const METADATA = 'metadata'

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
]

let connection: Connection | null = null

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_ENDPOINTS[0], 'confirmed')
  }
  return connection
}

export function isValidPubkey(value: string): boolean {
  try {
    const pk = new PublicKey(value)
    if (pk.toBase58() !== value) return false
    return value.length >= 32 && value.length <= 44
  } catch {
    return false
  }
}

export function deriveMetadataPDA(mint: PublicKey): PublicKey {
  const seeds = [
    new TextEncoder().encode(METADATA),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ]
  const [pda] = PublicKey.findProgramAddressSync(
    seeds,
    TOKEN_METADATA_PROGRAM_ID,
  )
  return pda
}

export interface ParsedMetadata {
  name: string
  symbol: string
}

function readU32LE(
  buf: Uint8Array,
  offset: number,
): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  )
}

function readLengthPrefixed(
  buf: Uint8Array,
  offset: number,
): [string, number] {
  let o = offset
  const len = (buf[o++] << 8) | buf[o++]
  const slice = Array.from(buf.slice(o, o + len))
  o += len
  return [String.fromCharCode(...slice), o]
}

// Modern Metaplex token-metadata layout:
//   key(1) | update_authority(32) | mint(32) |
//   name[u32 LE len][buffer>=max(len,32)] | symbol[...] | ...
// Fallback to the legacy simple layout (key(1) then name/symbol).
export function parseTokenMetadata(
  data: Uint8Array | Uint8Array<ArrayBuffer>,
): ParsedMetadata | null {
  try {
    if (data.length < 4) return null

    // --- Modern layout ---
    const base = 1 + 32 + 32
    if (data.length >= base + 8) {
      const nameLen = readU32LE(data, base)
      if (nameLen > 0 && nameLen <= 64 && base + 4 + nameLen <= data.length) {
        let name = ''
        for (let i = 0; i < nameLen; i++) {
          const c = data[base + 4 + i]
          if (c === 0) break
          name += String.fromCharCode(c)
        }
        const symOff = base + 4 + Math.max(nameLen, 32)
        if (data.length >= symOff + 4) {
          const symLen = readU32LE(data, symOff)
          let symbol = ''
          for (let i = 0; i < symLen; i++) {
            const c = data[symOff + 4 + i]
            if (c === 0) break
            symbol += String.fromCharCode(c)
          }
          if (name || symbol) {
            return {
              name: name || 'Unknown',
              symbol: symbol || '???',
            }
          }
        }
      }
    }

    // --- Legacy layout: key(1) then length-prefixed name/symbol ---
    if (data.length < 7) return null
    const version = data[0]
    if (version !== 1) return null
    const [name, o2] = readLengthPrefixed(data, 1)
    const [symbol] = readLengthPrefixed(data, o2)
    return { name: name || 'Unknown', symbol: symbol || '???' }
  } catch {
    return null
  }
}

export const UNKNOWN_SUPPLY = '0'
export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112'

type ParsedMintShape = {
  parsed?: { type?: string; info?: Record<string, unknown> }
}

async function tryFetchParsedMint(
  mint: PublicKey,
): Promise<ParsedMintShape | null | 'error'> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
    let conn = connection
    if (attempt > 0 || !conn) {
      conn = new Connection(RPC_ENDPOINTS[attempt], 'confirmed')
    }
    try {
      const res = await conn.getParsedAccountInfo(mint, 'confirmed')
      if (!res?.value) return null
      connection = conn
      const account = res.value as unknown as { data?: unknown }
      const data = account.data as ParsedMintShape | null
      if (!data?.parsed || !data.parsed.info) return null
      return data
    } catch (e) {
      lastError = e
    }
  }
  void lastError
  return 'error'
}

export async function getMintInfo(
  mintAddress: string,
): Promise<OnchainMintInfo> {
  const mint = new PublicKey(mintAddress)

  const base: OnchainMintInfo = {
    mint: mintAddress,
    supply: UNKNOWN_SUPPLY,
    decimals: 0,
    mintAuthority: null,
    freezeAuthority: null,
    metadataName: null,
    metadataSymbol: null,
    standard: null,
    existsOnChain: false,
  }

  // Native SOL is not an SPL mint (System Program account) — special-case it.
  if (mintAddress === NATIVE_SOL_MINT) {
    base.existsOnChain = true
    base.decimals = 9
    base.standard = 'native'
    try {
      const { value } = await getConnection().getSupply('confirmed')
      base.supply = String(Number(value.circulating))
    } catch {
      base.supply = UNKNOWN_SUPPLY
    }
    return base
  }

  const data = await tryFetchParsedMint(mint)
  if (data === 'error') {
    base.rpcError = true
    return base
  }
  if (!data?.parsed?.info) return base

  const p = data.parsed.info as {
    supply?: string | number
    decimals?: number
    mintAuthority?: string | null
    freezeAuthority?: string | null
  }

  base.existsOnChain = true
  base.supply =
    typeof p.supply === 'string' ? p.supply : String(p.supply ?? '0')
  base.decimals = p.decimals ?? 0
  base.mintAuthority = p.mintAuthority ?? null
  base.freezeAuthority = p.freezeAuthority ?? null
  base.standard = data.parsed!.type === 'mint' ? 'SPL-Token' : 'other'

  try {
    const metaPda = deriveMetadataPDA(mint)
    const metaConn = getConnection()
    const metaInfo = await metaConn.getAccountInfo(metaPda, 'confirmed')
    if (metaInfo?.data) {
      const meta = parseTokenMetadata(metaInfo.data)
      if (meta) {
        base.metadataName = meta.name
        base.metadataSymbol = meta.symbol
      }
    }
  } catch {
    // metadata optional
  }

  return base
}

export function isSystemAccount(address: string): boolean {
  try {
    return SystemProgram.programId.equals(new PublicKey(address))
  } catch {
    return false
  }
}