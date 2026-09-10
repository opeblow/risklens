import type { RiskReport } from '../../lib/types'
import { buildSnapshot } from '../../lib/solana/receipt'

export interface ExportedReport {
  format: 'risklens:report:v1'
  report: RiskReport
  snapshot: ReturnType<typeof buildSnapshot>
}

export const EXPORT_FORMAT = 'risklens:report:v1'

/**
 * Build the export payload for a report. Embeds the snapshot alongside the
 * full report so the digest is reproducible from the snapshot alone.
 */
export function buildExport(report: RiskReport): ExportedReport {
  return {
    format: EXPORT_FORMAT,
    report,
    snapshot: buildSnapshot(report),
  }
}

/**
 * Serialise and download a report JSON file.
 * In browser: triggers a download. In non-browser: returns the JSON string.
 */
export function exportReportJson(report: RiskReport): string {
  const payload = buildExport(report)
  return JSON.stringify(payload, null, 2)
}

export function downloadReportJson(report: RiskReport, filename?: string): void {
  const json = exportReportJson(report)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `risklens-report-${report.mint.slice(0, 8)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const MAX_IMPORT_BYTES = 4 * 1024 * 1024 // 4 MB

/**
 * Strictly validate an imported report JSON.
 * Never silently strips unrecognized fields before hashing — instead
 * the full parsed object is hashed as-is, so tampered snapshots fail.
 */
export function parseImportedReport(
  json: string,
): { ok: true; payload: ExportedReport } | { ok: false; error: string } {
  if (new TextEncoder().encode(json).length > MAX_IMPORT_BYTES) {
    return { ok: false, error: `File is too large (max 4 MB).` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'File must contain a JSON object.' }
  }

  const p = parsed as Record<string, unknown>

  if (p.format !== EXPORT_FORMAT) {
    return {
      ok: false,
      error:
        'This file does not look like a RiskLens report export (missing format identifier).',
    }
  }

  if (!p.report || typeof p.report !== 'object') {
    return { ok: false, error: 'Missing report data in the file.' }
  }

  const r = p.report as Record<string, unknown>
  if (
    typeof r.mint !== 'string' ||
    typeof r.riskScore !== 'number' ||
    typeof r.grade !== 'string' ||
    !Array.isArray(r.factors)
  ) {
    return { ok: false, error: 'Report data is structurally incomplete.' }
  }

  if (!p.snapshot || typeof p.snapshot !== 'object') {
    return { ok: false, error: 'Missing snapshot data in the file.' }
  }

  const s = p.snapshot as Record<string, unknown>
  if (
    s.schemaVersion !== 'risklens:snapshot:v1' ||
    typeof s.scoringEngineVersion !== 'string' ||
    s.source === null || typeof s.source !== 'object' ||
    s.asset === null || typeof s.asset !== 'object' ||
    s.result === null || typeof s.result !== 'object'
  ) {
    return { ok: false, error: 'Snapshot schema is invalid or unrecognized.' }
  }

  return { ok: true, payload: p as unknown as ExportedReport }
}

/** Read a file and import a report from it. */
export async function importReportFile(
  file: File,
): Promise<{ ok: true; payload: ExportedReport } | { ok: false; error: string }> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'File is too large (max 4 MB).' }
  }
  const text = await file.text()
  return parseImportedReport(text)
}