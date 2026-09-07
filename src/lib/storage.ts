import type { Attestation } from './types'

const K_ATTEST = 'risklens::attestations'
const K_REPORT_HISTORY = 'risklens::history'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}

export function getAttestations(): Attestation[] {
  return read<Attestation[]>(K_ATTEST, [])
}

export function saveAttestation(a: Attestation): Attestation[] {
  const list = getAttestations()
  const next = [a, ...list.filter((x) => x.signature !== a.signature)].slice(
    0,
    200,
  )
  write(K_ATTEST, next)
  return next
}

export function pushHistory(mint: string): string[] {
  const list = read<string[]>(K_REPORT_HISTORY, [])
  const next = [mint, ...list.filter((x) => x !== mint)].slice(0, 12)
  write(K_REPORT_HISTORY, next)
  return next
}

export function getHistory(): string[] {
  return read<string[]>(K_REPORT_HISTORY, [])
}

export interface PromptCache {
  [mint: string]: {
    result: unknown
    at: number
  }
}

const K_CACHE = 'risklens::report-cache'

export function cacheReport(mint: string, result: unknown): void {
  const cache = read<PromptCache>(K_CACHE, {})
  cache[mint] = { result, at: Date.now() }
  // prune entries older than 6h
  const now = Date.now()
  const pruned = Object.fromEntries(
    Object.entries(cache).filter(([, v]) => now - v.at < 6 * 3600 * 1000),
  )
  write(K_CACHE, pruned)
}

export function readReportCache(
  mint: string,
): { result: unknown; at: number } | null {
  const cache = read<PromptCache>(K_CACHE, {})
  const entry = cache[mint]
  if (!entry) return null
  if (Date.now() - entry.at > 6 * 3600 * 1000) return null
  return entry
}