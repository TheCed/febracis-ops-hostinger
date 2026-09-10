import { db } from '../../lib/db.js'
import { id, nowIso, parseJson } from '../../lib/utils.js'
import { env } from '../../config/env.js'
import { createSheetsClient } from './client.js'
import {
  DEFAULT_MAPPINGS,
  mapSheetRow,
  normalizePhone,
  type SheetColumnMapping,
} from './normalizer.js'

export type SyncAction =
  | 'create'
  | 'update'
  | 'unchanged'
  | 'conflict'
  | 'invalid'
  | 'skip'

export interface SyncPreviewItem {
  action: SyncAction
  externalId?: string | null
  clientId?: string | null
  message: string
  mapped?: Record<string, unknown>
}

export interface SyncResult {
  runId: string
  mode: 'dry-run' | 'apply'
  status: 'success' | 'partial' | 'error'
  read: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  conflicts: number
  errors: number
  items: SyncPreviewItem[]
  clientMode: 'mock' | 'production'
}

export interface SheetSettings {
  enabled: boolean
  spreadsheetId: string
  sheetName: string
  headerRow: number
  idHeader: string
  mappings: SheetColumnMapping[]
  updatedAt: string
  envEnabled: boolean
  clientMode: 'mock' | 'production'
}

function getClient() {
  return createSheetsClient({
    enabled: env.googleSheets.enabled,
    credentialsPath: env.googleSheets.credentialsPath,
    credentialsJson: env.googleSheets.credentialsJson,
  })
}

export function getSheetSettings(): SheetSettings {
  const row = db.prepare('SELECT * FROM sheet_settings WHERE id = 1').get() as
    | Record<string, unknown>
    | undefined

  const client = getClient()
  if (!row) {
    const updatedAt = nowIso()
    db.prepare(
      `INSERT INTO sheet_settings (id, enabled, spreadsheet_id, sheet_name, header_row, id_header, mappings_json, updated_at)
       VALUES (1, 0, ?, ?, 1, 'ID', ?, ?)`,
    ).run(
      env.googleSheets.spreadsheetId,
      env.googleSheets.sheetName,
      JSON.stringify(DEFAULT_MAPPINGS),
      updatedAt,
    )
    return getSheetSettings()
  }

  return {
    enabled: Boolean(row.enabled) || env.googleSheets.enabled,
    spreadsheetId: String(row.spreadsheet_id || env.googleSheets.spreadsheetId),
    sheetName: String(row.sheet_name || env.googleSheets.sheetName),
    headerRow: Number(row.header_row || 1),
    idHeader: String(row.id_header || 'ID'),
    mappings: parseJson<SheetColumnMapping[]>(String(row.mappings_json), DEFAULT_MAPPINGS),
    updatedAt: String(row.updated_at),
    envEnabled: env.googleSheets.enabled,
    clientMode: client.mode,
  }
}

export function saveSheetSettings(input: Partial<SheetSettings>): SheetSettings {
  const current = getSheetSettings()
  const next = {
    enabled: input.enabled ?? current.enabled,
    spreadsheetId: input.spreadsheetId ?? current.spreadsheetId,
    sheetName: input.sheetName ?? current.sheetName,
    headerRow: input.headerRow ?? current.headerRow,
    idHeader: input.idHeader ?? current.idHeader,
    mappings: input.mappings ?? current.mappings,
  }
  const updatedAt = nowIso()
  db.prepare(
    `UPDATE sheet_settings SET enabled = ?, spreadsheet_id = ?, sheet_name = ?, header_row = ?, id_header = ?, mappings_json = ?, updated_at = ? WHERE id = 1`,
  ).run(
    next.enabled ? 1 : 0,
    next.spreadsheetId,
    next.sheetName,
    next.headerRow,
    next.idHeader,
    JSON.stringify(next.mappings),
    updatedAt,
  )
  return getSheetSettings()
}

function findConsultantId(name: string | null | undefined): {
  id: string | null
  conflict: boolean
} {
  const n = (name || '').trim()
  if (!n) return { id: null, conflict: false }
  const row = db
    .prepare('SELECT id, name FROM consultants WHERE lower(name) = lower(?)')
    .get(n) as { id: string; name: string } | undefined
  if (row) return { id: row.id, conflict: false }
  return { id: null, conflict: true }
}

function findByExternalId(externalId: string) {
  return db.prepare('SELECT * FROM clients WHERE external_id = ?').get(externalId) as
    | Record<string, unknown>
    | undefined
}

function findSoftDuplicate(phone: string, email: string) {
  const phoneDigits = normalizePhone(phone).digits
  const emailNorm = email.trim().toLowerCase()
  const rows = db.prepare('SELECT * FROM clients').all() as Record<string, unknown>[]
  return rows.filter((r) => {
    const p = normalizePhone(String(r.phone_normalized || r.phone || '')).digits
    const e = String(r.email || '').toLowerCase()
    return (phoneDigits && p && p === phoneDigits) || (emailNorm && e && e === emailNorm)
  })
}

function snapshotComparable(mapped: Record<string, unknown>, consultantId: string | null) {
  return JSON.stringify({
    fullName: mapped.fullName,
    email: mapped.email,
    phone: mapped.phone,
    whatsapp: mapped.whatsapp || mapped.phone,
    status: mapped.status,
    presence: mapped.presence,
    consultantId,
    trainingLabel: mapped.trainingLabel,
    eventDate: mapped.eventDate,
    observations: mapped.observations,
  })
}

export async function testSheetsConnection() {
  const client = getClient()
  const settings = getSheetSettings()
  const result = await client.testConnection()
  return {
    ...result,
    clientMode: client.mode,
    spreadsheetId: settings.spreadsheetId,
    sheetName: settings.sheetName,
  }
}

export async function runSheetSync(opts: {
  dryRun: boolean
  userId?: string | null
}): Promise<SyncResult> {
  const settings = getSheetSettings()
  const client = getClient()
  const startedAt = nowIso()
  const runId = id('sync')

  db.prepare(
    `INSERT INTO sync_runs (id, source, mode, status, started_at, user_id)
     VALUES (?, 'google_sheets', ?, 'running', ?, ?)`,
  ).run(runId, opts.dryRun ? 'dry-run' : 'apply', startedAt, opts.userId ?? null)

  const items: SyncPreviewItem[] = []
  let created = 0
  let updated = 0
  let unchanged = 0
  let skipped = 0
  let conflicts = 0
  let errors = 0

  try {
    const { rows } = await client.readRows(
      settings.spreadsheetId || 'mock',
      settings.sheetName,
      settings.headerRow,
    )

    const seenExternal = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const mappedRow = mapSheetRow(rows[i], i + settings.headerRow + 1, settings.mappings)
      const externalId = String(mappedRow.mapped.externalId || '').trim()

      if (mappedRow.incomplete) {
        items.push({
          action: 'invalid',
          externalId: externalId || null,
          message: `Campos obrigatórios ausentes: ${mappedRow.missingRequired.join(', ')}`,
          mapped: mappedRow.mapped,
        })
        errors += 1
        continue
      }

      if (seenExternal.has(externalId)) {
        items.push({
          action: 'conflict',
          externalId,
          message: 'external_id duplicado na própria planilha',
          mapped: mappedRow.mapped,
        })
        conflicts += 1
        continue
      }
      seenExternal.add(externalId)

      const consultant = findConsultantId(String(mappedRow.mapped.consultantName || ''))
      if (consultant.conflict) {
        items.push({
          action: 'conflict',
          externalId,
          message: `Consultor não encontrado: ${mappedRow.mapped.consultantName}`,
          mapped: mappedRow.mapped,
        })
        conflicts += 1
        continue
      }

      const existing = findByExternalId(externalId)
      if (!existing) {
        const soft = findSoftDuplicate(
          String(mappedRow.mapped.phone || ''),
          String(mappedRow.mapped.email || ''),
        ).filter((r) => !r.external_id)
        if (soft.length) {
          items.push({
            action: 'conflict',
            externalId,
            clientId: String(soft[0].id),
            message: 'Possível duplicata por telefone/email (sem merge automático)',
            mapped: mappedRow.mapped,
          })
          conflicts += 1
          continue
        }

        items.push({
          action: 'create',
          externalId,
          message: `Novo cliente: ${mappedRow.mapped.fullName}`,
          mapped: mappedRow.mapped,
        })
        created += 1

        if (!opts.dryRun) {
          const clientId = id('client')
          const createdAt = nowIso()
          const phone = String(mappedRow.mapped.phone || '')
          const phoneNorm = normalizePhone(phone)
          db.prepare(
            `INSERT INTO clients (
              id, sheet_row_id, sheet_key, external_id, sheet_row, full_name, preferred_name, email, phone, phone_normalized,
              whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label, event_date, observations,
              courses_json, source, created_at, updated_at, synced_at, external_updated_at, pipeline_stage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'google_sheets', ?, ?, ?, ?, 'novo')`,
          ).run(
            clientId,
            null,
            externalId,
            externalId,
            mappedRow.rowIndex,
            mappedRow.mapped.fullName,
            null,
            mappedRow.mapped.email || null,
            phoneNorm.display || null,
            phoneNorm.digits || null,
            mappedRow.mapped.whatsapp || phoneNorm.display || null,
            consultant.id,
            mappedRow.mapped.consultantName || null,
            mappedRow.mapped.status || 'lead',
            mappedRow.mapped.presence || 'unknown',
            JSON.stringify(['sheets']),
            mappedRow.mapped.trainingLabel || null,
            mappedRow.mapped.eventDate || null,
            mappedRow.mapped.observations || null,
            createdAt,
            createdAt,
            createdAt,
            createdAt,
          )
          db.prepare(
            `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
             VALUES (?, ?, 'sync', ?, ?, ?)`,
          ).run(id('act'), clientId, 'Cliente criado via Google Sheets', opts.userId ?? null, createdAt)
        }
        continue
      }

      const nextSnap = snapshotComparable(mappedRow.mapped, consultant.id)
      const currentSnap = snapshotComparable(
        {
          fullName: existing.full_name,
          email: existing.email,
          phone: existing.phone,
          whatsapp: existing.whatsapp,
          status: existing.status,
          presence: existing.presence,
          trainingLabel: existing.training_label,
          eventDate: existing.event_date,
          observations: existing.observations,
        },
        existing.consultant_id ? String(existing.consultant_id) : null,
      )

      if (nextSnap === currentSnap) {
        items.push({
          action: 'unchanged',
          externalId,
          clientId: String(existing.id),
          message: 'Sem alterações',
        })
        unchanged += 1
        continue
      }

      items.push({
        action: 'update',
        externalId,
        clientId: String(existing.id),
        message: `Atualizar: ${mappedRow.mapped.fullName}`,
        mapped: mappedRow.mapped,
      })
      updated += 1

      if (!opts.dryRun) {
        const updatedAt = nowIso()
        const phone = String(mappedRow.mapped.phone || '')
        const phoneNorm = normalizePhone(phone)
        db.prepare(
          `UPDATE clients SET
            full_name = ?, email = ?, phone = ?, phone_normalized = ?, whatsapp = ?,
            consultant_id = ?, consultant_name = ?, status = ?, presence = ?,
            training_label = ?, event_date = ?, observations = ?,
            sheet_row = ?, synced_at = ?, external_updated_at = ?, updated_at = ?, source = 'google_sheets'
           WHERE id = ?`,
        ).run(
          mappedRow.mapped.fullName,
          mappedRow.mapped.email || null,
          phoneNorm.display || null,
          phoneNorm.digits || null,
          mappedRow.mapped.whatsapp || phoneNorm.display || null,
          consultant.id,
          mappedRow.mapped.consultantName || null,
          mappedRow.mapped.status || existing.status,
          mappedRow.mapped.presence || existing.presence,
          mappedRow.mapped.trainingLabel || null,
          mappedRow.mapped.eventDate || null,
          mappedRow.mapped.observations || null,
          mappedRow.rowIndex,
          updatedAt,
          updatedAt,
          updatedAt,
          existing.id,
        )
        db.prepare(
          `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
           VALUES (?, ?, 'sync', ?, ?, ?)`,
        ).run(
          id('act'),
          existing.id,
          'Cliente atualizado via Google Sheets',
          opts.userId ?? null,
          updatedAt,
        )
      }
    }

    const status =
      errors || conflicts ? (created || updated ? 'partial' : 'partial') : 'success'
    const finishedAt = nowIso()
    db.prepare(
      `UPDATE sync_runs SET status = ?, finished_at = ?, read_count = ?, created_count = ?, updated_count = ?,
       unchanged_count = ?, skipped_count = ?, conflict_count = ?, error_count = ?, summary_json = ?
       WHERE id = ?`,
    ).run(
      status,
      finishedAt,
      rows.length,
      created,
      updated,
      unchanged,
      skipped,
      conflicts,
      errors,
      JSON.stringify({ dryRun: opts.dryRun, clientMode: client.mode }),
      runId,
    )

    const insertItem = db.prepare(
      `INSERT INTO sync_items (id, run_id, action, external_id, client_id, message, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const item of items) {
      insertItem.run(
        id('syncitem'),
        runId,
        item.action,
        item.externalId ?? null,
        item.clientId ?? null,
        item.message,
        item.mapped ? JSON.stringify(item.mapped) : null,
      )
    }

    return {
      runId,
      mode: opts.dryRun ? 'dry-run' : 'apply',
      status,
      read: rows.length,
      created,
      updated,
      unchanged,
      skipped,
      conflicts,
      errors,
      items,
      clientMode: client.mode,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed'
    db.prepare(
      `UPDATE sync_runs SET status = 'error', finished_at = ?, error_count = 1, summary_json = ? WHERE id = ?`,
    ).run(nowIso(), JSON.stringify({ message }), runId)
    return {
      runId,
      mode: opts.dryRun ? 'dry-run' : 'apply',
      status: 'error',
      read: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      conflicts: 0,
      errors: 1,
      items: [{ action: 'invalid', message }],
      clientMode: client.mode,
    }
  }
}

export function listSyncRuns(limit = 20) {
  return db
    .prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[]
}

export function getSyncRun(runId: string) {
  const run = db.prepare('SELECT * FROM sync_runs WHERE id = ?').get(runId) as
    | Record<string, unknown>
    | undefined
  if (!run) return null
  const items = db
    .prepare('SELECT * FROM sync_items WHERE run_id = ?')
    .all(runId) as Record<string, unknown>[]
  return { run, items }
}
