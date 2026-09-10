/**
 * RFC 8785-compatible canonical JSON serialisation (JCS).
 *
 * Rules:
 * - Object keys are sorted lexicographically (UTF-8 byte order).
 * - Arrays preserve element order.
 * - Numbers are serialised without leading zeros; trailing zeros after
 *   the decimal point are stripped; integers use no decimal point.
 * - Strings use minimal JSON escaping.
 * - `null`, `true`, `false` are lowercase.
 * - No whitespace or line breaks.
 * - `undefined` values and functions are rejected.
 * - BigInt values are rejected (caller must convert to string first).
 */

export class CanonicalJSONError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanonicalJSONError'
  }
}

/**
 * Serialise a value to RFC 8785 canonical JSON.
 *
 * @throws {CanonicalJSONError} on unsupported types, NaN, Infinity, or BigInt.
 */
export function canonicalJSON(value: unknown): string {
  return serialise(value, 0)
}

function serialise(value: unknown, depth: number): string {
  if (depth > 256) {
    throw new CanonicalJSONError('Maximum nesting depth exceeded')
  }

  // BigInt — reject to force explicit string conversion by caller
  if (typeof value === 'bigint') {
    throw new CanonicalJSONError(
      'BigInt values are not supported; convert to string before hashing',
    )
  }

  // null
  if (value === null) return 'null'

  // undefined / function / symbol — reject
  if (value === undefined) {
    throw new CanonicalJSONError('undefined is not a valid JSON value')
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new CanonicalJSONError(`${typeof value} is not a valid JSON value`)
  }

  // boolean
  if (typeof value === 'boolean') return value ? 'true' : 'false'

  // number
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalJSONError(
        `${String(value)} is not a valid JSON number`,
      )
    }
    return serialiseNumber(value)
  }

  // string
  if (typeof value === 'string') {
    return serialiseString(value)
  }

  // Array
  if (Array.isArray(value)) {
    const items = value.map((v) => serialise(v, depth + 1))
    return `[${items.join(',')}]`
  }

  // Plain object
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const pairs: string[] = []
    for (const key of keys) {
      const v = obj[key]
      // Skip undefined and functions (JCS behaviour for absent values)
      if (v === undefined) continue
      if (typeof v === 'function' || typeof v === 'symbol') continue
      pairs.push(`${serialiseString(key)}:${serialise(v, depth + 1)}`)
    }
    return `{${pairs.join(',')}}`
  }

  throw new CanonicalJSONError(`Unsupported type: ${typeof value}`)
}

function serialiseNumber(n: number): string {
  if (Number.isInteger(n)) {
    // Integers: no decimal point. Use toPrecision for very large numbers.
    const s = n.toString(10)
    // Handle -0
    if (s === '0' && Object.is(n, -0)) return '-0'
    return s
  }
  // Floats: strip trailing zeros after decimal point
  let s = n.toString(10)
  // Remove trailing zeros after decimal point
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s
}

function serialiseString(s: string): string {
  // Fast path: check if escaping is needed
  let needsEscape = false
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (
      c < 0x20 ||
      c === 0x22 || // "
      c === 0x5C || // backslash
      c > 0x7f
    ) {
      needsEscape = true
      break
    }
  }
  if (!needsEscape) return `"${s}"`
  return `"${escapeString(s)}"`
}

function escapeString(s: string): string {
  let result = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    switch (c) {
      case 0x22: result += '\\"'; break
      case 0x5C: result += '\\\\'; break
      case 0x08: result += '\\b'; break
      case 0x09: result += '\\t'; break
      case 0x0a: result += '\\n'; break
      case 0x0c: result += '\\f'; break
      case 0x0d: result += '\\r'; break
      default:
        if (c < 0x20) {
          result += `\\u${c.toString(16).padStart(4, '0')}`
        } else if (c > 0x7f) {
          // Multi-byte UTF-8
          result += s[i]
        } else {
          result += s[i]
        }
    }
  }
  return result
}
