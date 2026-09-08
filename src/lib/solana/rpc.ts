import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import type { OnchainMintInfo, Token2022ExtensionState } from '../types'

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)
const METADATA = 'metadata'

// Classic SPL token program plus the Token-2022 program (string form, as
// returned by getParsedAccountInfo).
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const TOKEN_2022_PROGRAM_ID =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

// Token-2022 TLV extension type codes (mint accounts).
const EXT_MINT_CLOSE_AUTHORITY = 3
const EXT_PERMANENT_DELEGATE = 12
const EXT_TRANSFER_HOOK = 13
// Token-2022 mint base struct length (identical to classic SPL mint).
const TOKEN_2022_MINT_BASE_LEN = 82

function defaultEndpoints(): string[] {
  const env = import.meta.env?.VITE_SOLANA_RPC as unknown
  if (typeof env === 'string' && env.trim()) return [env.trim()]
  return RPC_ENDPOINTS
}

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
]

let connection: Connection | null = null

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(defaultEndpoints()[0], 'confirmed')
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

export interface MintAccountResult {
  owner: string
  program: string
  parsed: { type: string; info: Record<string, unknown> }
}

/**
 * Accept an account as a mint only when it is an initialized mint account
 * owned by a supported token program. Other parsed accounts (e.g. token
 * accounts, non-token program owners) are rejected so they never enter the
 * mint-analysis path.
 */
export function isMintAccount(account: unknown): account is MintAccountResult {
  if (!account || typeof account !== 'object') return false
  const acc = account as {
    owner?: unknown
    program?: unknown
    data?: unknown
  }
  const owner = typeof acc.owner === 'string' ? acc.owner : ''
  if (owner !== TOKEN_PROGRAM_ID && owner !== TOKEN_2022_PROGRAM_ID) {
    return false
  }
  const data = acc.data as ParsedMintShape | null | undefined
  if (!data?.parsed) return false
  if (data.parsed.type !== 'mint') return false
  const info = data.parsed.info as { isInitialized?: unknown } | null | undefined
  if (!info || info.isInitialized !== true) return false
  return true
}

async function tryFetchParsedMint(
  mint: PublicKey,
): Promise<MintAccountResult | null | 'error'> {
  let lastError: unknown = null
  const endpoints = defaultEndpoints()
  for (let attempt = 0; attempt < endpoints.length; attempt++) {
    let conn = connection
    if (attempt > 0 || !conn) {
      conn = new Connection(endpoints[attempt], 'confirmed')
    }
    try {
      const res = await conn.getParsedAccountInfo(mint, 'confirmed')
      if (!res?.value) return null
      connection = conn
      if (!isMintAccount(res.value)) return null
      const account = res.value as unknown as {
        owner: string
        program?: unknown
        data: ParsedMintShape
      }
      const parsed = account.data.parsed!
      return {
        owner: account.owner,
        program: typeof account.program === 'string' ? account.program : '',
        parsed: {
          type: parsed.type as string,
          info: parsed.info as Record<string, unknown>,
        },
      }
    } catch (e) {
      lastError = e
    }
  }
  void lastError
  return 'error'
}

function isAllZero(buf: Uint8Array, off: number, len: number): boolean {
  for (let i = off; i < off + len; i++) if (buf[i] !== 0) return false
  return true
}

/**
 * Scan a Token-2022 mint's TLV extension region (after the 82-byte base) for
 * the high-risk extensions: permanent delegate, transfer hook, and a mint
 * close authority. `audited` is false when the layout could not be parsed, so
 * callers can surface an "unverified" check instead of omitting it silently.
 */
export function scanToken2022Extensions(
  data: Uint8Array,
): Token2022ExtensionState {
  const state: Token2022ExtensionState = {
    audited: false,
    permanentDelegate: false,
    mintCloseAuthority: false,
    transferHook: false,
  }
  try {
    if (data.length < TOKEN_2022_MINT_BASE_LEN) return state
    let o = TOKEN_2022_MINT_BASE_LEN
    while (o + 3 <= data.length) {
      const type = data[o]
      const len = (data[o + 1] << 8) | data[o + 2]
      o += 3
      if (len === 0) break
      if (o + len > data.length) break
      if (type === EXT_PERMANENT_DELEGATE && len >= 32) {
        state.permanentDelegate = !isAllZero(data, o, 32)
      } else if (type === EXT_MINT_CLOSE_AUTHORITY) {
        state.mintCloseAuthority = true
      } else if (type === EXT_TRANSFER_HOOK) {
        state.transferHook = true
      }
      o += len
    }
    state.audited = true
  } catch {
    state.audited = false
  }
  return state
}

const UNAUDITED_EXT: Token2022ExtensionState = {
  audited: false,
  permanentDelegate: false,
  mintCloseAuthority: false,
  transferHook: false,
}

async function scanToken2022(
  mint: PublicKey,
): Promise<Token2022ExtensionState | null> {
  try {
    const raw = await getConnection().getAccountInfo(mint, 'confirmed')
    if (!raw?.data) return UNAUDITED_EXT
    return scanToken2022Extensions(raw.data)
  } catch {
    return UNAUDITED_EXT
  }
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
    extensions: null,
  }

  // Native SOL is handled separately: its account is an SPL mint, but its
  // supply is tracked with lamports, not the mint's supply field.
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

  const res = await tryFetchParsedMint(mint)
  if (res === 'error') {
    base.rpcError = true
    return base
  }
  if (!res) return base

  const p = res.parsed.info as {
    supply?: string | number
    decimals?: number
    mintAuthority?: string | null
    freezeAuthority?: string | null
  }

  base.existsOnChain = true
  base.supply =
    typeof p.supply === 'string' ? p.supply : String(p.supply ?? UNKNOWN_SUPPLY)
  base.decimals = p.decimals ?? 0
  base.mintAuthority = p.mintAuthority ?? null
  base.freezeAuthority = p.freezeAuthority ?? null
  base.standard =
    res.owner === TOKEN_2022_PROGRAM_ID ? 'SPL-Token-2022' : 'SPL-Token'
  if (base.standard === 'SPL-Token-2022') {
    base.extensions = await scanToken2022(mint)
  }

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