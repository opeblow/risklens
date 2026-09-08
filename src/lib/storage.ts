import type { Attestation } from './types'

const K_ATTEST = 'risklens::attestations'
const K_REPORT_HISTORY = 'risklens::history'

function read<T>(
  key: string,
  fallback: T,
  validate: (v: unknown) => v is T = (v): v is T => true,
): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!validate(parsed)) return fallback
    return parsed as T
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object'
}

function isAttestation(v: unknown): v is Attestation {
  if (!isRecord(v)) return false
  return (
    typeof v.mint === 'string' &&
    typeof v.symbol === 'string' &&
    typeof v.score === 'number' &&
    typeof v.grade === 'string' &&
    typeof v.address === 'string' &&
    typeof v.signature === 'string' &&
    typeof v.createdAt === 'number'
  )
}

function isAttestationArray(v: unknown): v is Attestation[] {
  return Array.isArray(v) && v.every(isAttestation)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export function getAttestations(): Attestation[] {
  return read<Attestation[]>(K_ATTEST, [], isAttestationArray)
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
  const list = read<string[]>(K_REPORT_HISTORY, [], isStringArray)
  const next = [mint, ...list.filter((x) => x !== mint)].slice(0, 12)
  write(K_REPORT_HISTORY, next)
  return next
}

export function getHistory(): string[] {
  return read<string[]>(K_REPORT_HISTORY, [], isStringArray)
}

export interface PromptCache {
  [mint: string]: {
    result: unknown
    at: number
  }
}

function isPromptCache(v: unknown): v is PromptCache {
  if (!isRecord(v)) return false
  return Object.values(v).every(
    (entry) => isRecord(entry) && typeof entry.at === 'number',
  )
}

const K_CACHE = 'risklens::report-cache'

export function cacheReport(mint: string, result: unknown): void {
  const cache = read<PromptCache>(K_CACHE, {}, isPromptCache)
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
  const cache = read<PromptCache>(K_CACHE, {}, isPromptCache)
  const entry = cache[mint]
  if (!entry) return null
  if (Date.now() - entry.at > 6 * 3600 * 1000) return null
  return entry
}