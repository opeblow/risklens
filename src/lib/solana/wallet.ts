import { PublicKey } from '@solana/web3.js'
import { getConnection } from './rpc'

export async function getAddressBalance(
  address: string,
): Promise<number | null> {
  try {
    const conn = getConnection()
    const lamports = await conn.getBalance(new PublicKey(address))
    return lamports / 1e9
  } catch {
    return null
  }
}

export async function getTransactionUrl(txId: string): Promise<string> {
  return `https://explorer.solana.com/tx/${txId}?cluster=mainnet-beta`
}

export function shortAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export async function signAttestationMessage(
  message: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  const encoder = new TextEncoder()
  const signed = await signMessage(encoder.encode(message))
  return toBase64(signed)
}