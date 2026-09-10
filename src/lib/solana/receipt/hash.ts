import { canonicalJSON } from './canonical-json'
import type { RiskLensReportSnapshotV1 } from './snapshot'

const DOMAIN_SEPARATOR = 'RiskLens:report:v1\n'

/**
 * Compute the full SHA-256 digest of a report snapshot.
 *
 * Hash function:
 *   SHA256(UTF8("RiskLens:report:v1\n" + canonicalSnapshotJSON))
 *
 * Uses the Web Crypto API (available in modern browsers and Node.js ≥ 20).
 * Returns the full hex-encoded digest (64 characters).
 */
export async function computeReportDigest(
  snapshot: RiskLensReportSnapshotV1,
): Promise<string> {
  const canonical = canonicalJSON(snapshot)
  const payload = DOMAIN_SEPARATOR + canonical
  const encoded = new TextEncoder().encode(payload)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return bufferToHex(new Uint8Array(hashBuffer))
}

/**
 * Synchronous variant used where an async call is not convenient.
 * Uses Node.js crypto when available, otherwise falls back to the
 * Web Crypto API when crypto.subtle.digest exists (it does not yield a
 * synchronous result, so this throws for browsers).
 */
export function computeReportDigestSync(
  snapshot: RiskLensReportSnapshotV1,
): string {
  const canonical = canonicalJSON(snapshot)
  const payload = DOMAIN_SEPARATOR + canonical

  // Vite SSR bundles for Node may translate this import; a dynamic access
  // via globalThis keeps browser bundles clean.
  const g = globalThis as { require?: (id: string) => unknown }
  if (typeof g.require === 'function') {
    try {
      const nodeCrypto = g.require('node:crypto') as {
        createHash: (alg: string) => {
          update: (data: string, encoding?: string) => {
            digest: (encoding?: string) => string
          }
        }
      }
      return nodeCrypto
        .createHash('sha256')
        .update(payload, 'utf8')
        .digest('hex')
    } catch {
      // Not a Node runtime — fall through.
    }
  }

  throw new Error(
    'Synchronous hashing requires Node.js. Use computeReportDigest() for browser environments.',
  )
}

function bufferToHex(buffer: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < buffer.length; i++) {
    hex += buffer[i].toString(16).padStart(2, '0')
  }
  return hex
}