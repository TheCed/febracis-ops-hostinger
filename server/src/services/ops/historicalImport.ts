import { createHash } from 'node:crypto'
import { db } from '../../lib/db.js'
import { id, nowIso } from '../../lib/utils.js'
import { detectSchema, mapRowValues, type SchemaDetection } from './schemaDetector.js'
import { computeTurmaHealth } from './turmaHealth.js'
import { ensureUnknownCourseId, resolveCourseId } from './courseResolve.js'
import { syncTurmaAlert } from './turmaAlerts.js'

export const MAPPING_VERSION = 'ops-historical-v1'

export interface HistoricalSheetTab {
  sourceFile: string
  sourceSheet: string
  headers: string[]
  /** Each inner array aligned to headers */
  rows: string[][]
}

export interface ImportSummary {
  runId: string
  tabsAnalyzed: number
  schemasDetected: number
  sourceRecords: number
  imported: number
  needsReview: number
  ignored: number
  peopleUpserted: number
  classesUpserted: number
  enrollmentsUpserted: number
  contactsCreated: number
  possibleDuplicates: number
  issues: number
  unknownStatuses: Record<string, number>
  unmappedColumns: string[]
}

function hashRow(parts: string[]) {
  return createHash('sha256').update(parts.join('\u0001')).digest('hex')
}

function normalizeCpf(raw?: string) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11 && digits.length !== 14) return null
  return digits
}

function normalizeEmail(raw?: string) {
  if (!raw?.trim()) return null
  return raw.trim().toLowerCase()
}

function normalizePhone(raw?: string) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  return d.length >= 10 ? d : null
}

function parseTurmaFromSheetName(sheet: string): { courseHint: string; turmaLabel: string } {
  const cleaned = sheet.trim()
  return { courseHint: cleaned.split(/\s+/)[0] || cleaned, turmaLabel: cleaned }
}

/**
 * Import engine: RAW + disposition for every source row.
 * Live Google fetch is separate; this accepts already-read tabs (production or fixtures).
 */
export function runHistoricalImport(
  tabs: HistoricalSheetTab[],
  opts: { userId?: string | null; spreadsheetId?: string; mode?: 'apply' | 'dry-run' } = {},
): ImportSummary {
  const mode = opts.mode ?? 'apply'
  const runId = id('imprun')
  const startedAt = nowIso()
  const unmapped = new Set<string>()
  const unknownStatuses: Record<string, number> = {}
  let imported = 0
  let needsReview = 0
  let ignored = 0
  let people = 0
  let classes = 0
  let enrollments = 0
  let contacts = 0
  let dupes = 0
  let issues = 0
  let sourceRecords = 0
  const fingerprints = new Set<string>()

  if (mode === 'apply') {
    db.prepare(
      `INSERT INTO import_runs (id, spreadsheet_id, mode, status, mapping_version, started_at, user_id)
       VALUES (?, ?, ?, 'running', ?, ?, ?)`,
    ).run(runId, opts.spreadsheetId ?? null, mode, MAPPING_VERSION, startedAt, opts.userId ?? null)
  }

  const insertIssue = db.prepare(
    `INSERT INTO migration_issues (id, run_id, code, severity, source_sheet, source_row, person_id, training_class_id, message, payload_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  )

  function issue(
    code: string,
    message: string,
    meta: {
      sheet?: string
      row?: number
      personId?: string | null
      classId?: string | null
      severity?: string
      payload?: unknown
    } = {},
  ) {
    issues += 1
    if (mode !== 'apply') return
    insertIssue.run(
      id('issue'),
      runId,
      code,
      meta.severity ?? 'warning',
      meta.sheet ?? null,
      meta.row ?? null,
      meta.personId ?? null,
      meta.classId ?? null,
      message,
      meta.payload ? JSON.stringify(meta.payload) : null,
      nowIso(),
    )
  }

  for (const tab of tabs) {
    const detection = detectSchema(tab.headers)
    fingerprints.add(detection.fingerprint)
    detection.unknownHeaders.forEach((h) => unmapped.add(h))
    if (detection.missingRequired.length) {
      issue('MISSING_HEADER', `Aba ${tab.sourceSheet}: faltam campos ${detection.missingRequired.join(',')}`, {
        sheet: tab.sourceSheet,
        severity: 'error',
        payload: detection,
      })
    }
    if (detection.confidence < 0.35) {
      issue('INFERRED_SCHEMA', `Schema fraco (${detection.confidence}) em ${tab.sourceSheet}`, {
        sheet: tab.sourceSheet,
        payload: detection,
      })
    }

    const { courseHint, turmaLabel } = parseTurmaFromSheetName(tab.sourceSheet)
    let classId: string | null = null

    if (mode === 'apply') {
      const existing = db
        .prepare(
          `SELECT id FROM training_classes WHERE aba_origem = ? AND planilha_origem = ? LIMIT 1`,
        )
        .get(tab.sourceSheet, tab.sourceFile) as { id: string } | undefined
      if (existing) {
        classId = existing.id
      } else {
        classId = id('turma')
        const courseId = resolveCourseId(courseHint)
        const course = courseId
          ? (db.prepare('SELECT id, name FROM courses WHERE id = ?').get(courseId) as
              | { id: string; name: string }
              | undefined)
          : undefined
        db.prepare(
          `INSERT INTO training_classes (
            id, course_id, course_code, course_name, turma_label, unidade, status,
            planilha_origem, aba_origem, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'Chapecó', 'ENCERRADA', ?, ?, ?, ?)`,
        ).run(
          classId,
          course?.id ?? null,
          courseHint,
          course?.name ?? turmaLabel,
          turmaLabel,
          tab.sourceFile,
          tab.sourceSheet,
          nowIso(),
          nowIso(),
        )
        classes += 1
      }
    }

    tab.rows.forEach((values, idx) => {
      const sourceRow = idx + 2 // assume header row 1
      sourceRecords += 1
      const mapped = mapRowValues(tab.headers, values, detection)
      const rawObj: Record<string, string> = {}
      tab.headers.forEach((h, i) => {
        rawObj[h] = values[i] ?? ''
      })
      const sourceHash = hashRow([
        tab.sourceFile,
        tab.sourceSheet,
        String(sourceRow),
        JSON.stringify(rawObj),
      ])

      if (mode === 'apply') {
        const already = db
          .prepare('SELECT id, disposition FROM import_raw_rows WHERE source_hash = ?')
          .get(sourceHash) as { id: string; disposition: string } | undefined
        if (already) {
          ignored += 1
          return
        }
      }

      const name = mapped.personName?.trim()
      if (!name) {
        ignored += 1
        persistRaw(tab, sourceRow, detection, sourceHash, rawObj, 'IGNORED_WITH_REASON', 'MISSING_PERSON_NAME')
        issue('MISSING_PERSON_NAME', 'Linha sem nome', { sheet: tab.sourceSheet, row: sourceRow })
        return
      }

      const cpfNorm = normalizeCpf(mapped.cpf)
      const email = normalizeEmail(mapped.email)
      if (mapped.email && !email) {
        issue('INVALID_EMAIL', `Email inválido: ${mapped.email}`, {
          sheet: tab.sourceSheet,
          row: sourceRow,
        })
      }
      const phone = normalizePhone(mapped.phone || mapped.whatsapp)

      let personId: string | null = null
      let disposition: 'IMPORTED' | 'NEEDS_REVIEW' = cpfNorm || email ? 'IMPORTED' : 'NEEDS_REVIEW'
      if (mapped.cpf && !cpfNorm) {
        issue('INVALID_CPF', `CPF inválido: ${mapped.cpf}`, { sheet: tab.sourceSheet, row: sourceRow })
        disposition = 'NEEDS_REVIEW'
      }

      if (mode === 'apply') {
        personId = resolvePerson({
          name,
          cpfNorm,
          email,
          phone,
          salesforce: mapped.salesforceId || mapped.salesforceUrl,
          grade: mapped.grade,
          onDupe: (a, b, reason, evidence) => {
            dupes += 1
            db.prepare(
              `INSERT INTO possible_duplicates (id, person_a_id, person_b_id, reason, evidence_json, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'open', ?)`,
            ).run(id('dup'), a, b, reason, JSON.stringify(evidence), nowIso())
            issue('POSSIBLE_DUPLICATE', reason, {
              sheet: tab.sourceSheet,
              row: sourceRow,
              personId: a,
              payload: evidence,
            })
          },
          onConflict: (msg, payload) => {
            issue('CONFLICTING_PERSON_DATA', msg, {
              sheet: tab.sourceSheet,
              row: sourceRow,
              payload,
            })
            disposition = 'NEEDS_REVIEW'
          },
        })
        if (personId) people += 1

        if (personId && classId) {
          const enrHash = hashRow([personId, classId, sourceHash])
          const existsEnr = db
            .prepare('SELECT id FROM enrollments WHERE source_hash = ?')
            .get(enrHash) as { id: string } | undefined
          let enrollmentId = existsEnr?.id
          if (!enrollmentId) {
            enrollmentId = id('enr')
            const statusRaw = (mapped.confirmationStatus || '').trim()
            if (statusRaw) {
              unknownStatuses[statusRaw] = (unknownStatuses[statusRaw] || 0) + 1
            }
            const present = /^(sim|s|x|presente|1)$/i.test((mapped.presence || '').trim())
            const courseRow = db
              .prepare('SELECT course_id FROM training_classes WHERE id = ?')
              .get(classId) as { course_id: string | null } | undefined
            const courseId = courseRow?.course_id || ensureUnknownCourseId()
            const presentFlag = present ? 1 : 0
            db.prepare(
              `INSERT INTO enrollments (
                id, client_id, course_id, event_id, training_class_id, status, confirmation_status,
                present, completed, decision, grade_label, matricula_salesforce, notes,
                source_sheet, source_row, source_hash, raw_json, created_at, updated_at
              ) VALUES (?, ?, ?, NULL, ?, 'inscrito', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              enrollmentId,
              personId,
              courseId,
              classId,
              statusRaw || 'matriculado',
              presentFlag,
              presentFlag,
              mapped.grade || null,
              mapped.matriculaSales || null,
              mapped.observation || null,
              tab.sourceSheet,
              sourceRow,
              enrHash,
              JSON.stringify(rawObj),
              nowIso(),
              nowIso(),
            )
            enrollments += 1
          }

          for (const [key, field] of [
            ['contact1', mapped.contact1],
            ['contact2', mapped.contact2],
            ['contact3', mapped.contact3],
            ['contact4', mapped.contact4],
          ] as const) {
            if (!field?.trim()) continue
            db.prepare(
              `INSERT INTO contact_events (
                id, person_id, training_class_id, enrollment_id, occurred_at, type, channel,
                observation, source_sheet, source_row, source_hash, raw_json, created_at
              ) VALUES (?, ?, ?, ?, ?, 'legacy_cell', 'unknown', ?, ?, ?, ?, ?, ?)`,
            ).run(
              id('ce'),
              personId,
              classId,
              enrollmentId,
              nowIso(),
              field,
              tab.sourceSheet,
              sourceRow,
              hashRow([enrHash, key, field]),
              JSON.stringify({ cell: key, text: field }),
              nowIso(),
            )
            contacts += 1
          }
        }

        persistRaw(
          tab,
          sourceRow,
          detection,
          sourceHash,
          rawObj,
          disposition,
          disposition === 'NEEDS_REVIEW' ? 'LOW_IDENTITY_CONFIDENCE' : null,
          personId,
          classId,
        )
      }

      if (disposition === 'IMPORTED') imported += 1
      else needsReview += 1
    })

    if (mode === 'apply' && classId) {
      refreshClassCounts(classId)
    }
  }

  const summary: ImportSummary = {
    runId,
    tabsAnalyzed: tabs.length,
    schemasDetected: fingerprints.size,
    sourceRecords,
    imported,
    needsReview,
    ignored,
    peopleUpserted: people,
    classesUpserted: classes,
    enrollmentsUpserted: enrollments,
    contactsCreated: contacts,
    possibleDuplicates: dupes,
    issues,
    unknownStatuses,
    unmappedColumns: [...unmapped],
  }

  if (mode === 'apply') {
    db.prepare(
      `UPDATE import_runs SET status = 'success', finished_at = ?, summary_json = ? WHERE id = ?`,
    ).run(nowIso(), JSON.stringify(summary), runId)
  }

  return summary

  function persistRaw(
    tab: HistoricalSheetTab,
    sourceRow: number,
    detection: SchemaDetection,
    sourceHash: string,
    rawObj: Record<string, string>,
    disposition: string,
    reason: string | null,
    personId?: string | null,
    classId?: string | null,
  ) {
    if (mode !== 'apply') return
    db.prepare(
      `INSERT OR IGNORE INTO import_raw_rows (
        id, run_id, source_file, source_sheet, source_row, schema_fingerprint, mapping_confidence,
        source_hash, raw_json, disposition, disposition_reason, person_id, training_class_id, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id('raw'),
      runId,
      tab.sourceFile,
      tab.sourceSheet,
      sourceRow,
      detection.fingerprint,
      detection.confidence,
      sourceHash,
      JSON.stringify(rawObj),
      disposition,
      reason,
      personId ?? null,
      classId ?? null,
      nowIso(),
    )
  }
}

function resolvePerson(opts: {
  name: string
  cpfNorm: string | null
  email: string | null
  phone: string | null
  salesforce?: string
  grade?: string
  onDupe: (a: string, b: string, reason: string, evidence: unknown) => void
  onConflict: (msg: string, payload: unknown) => void
}): string {
  if (opts.cpfNorm) {
    const byCpf = db
      .prepare('SELECT * FROM clients WHERE cpf_normalized = ?')
      .get(opts.cpfNorm) as Record<string, unknown> | undefined
    if (byCpf) {
      if (opts.email && byCpf.email && String(byCpf.email).toLowerCase() !== opts.email) {
        opts.onConflict('CPF match com email diferente', {
          cpf: opts.cpfNorm,
          existingEmail: byCpf.email,
          email: opts.email,
        })
      }
      return String(byCpf.id)
    }
  }

  if (opts.salesforce) {
    const sf = opts.salesforce.trim()
    const bySf = db
      .prepare(
        `SELECT * FROM clients WHERE salesforce_id = ? OR salesforce_url = ? LIMIT 1`,
      )
      .get(sf, sf) as Record<string, unknown> | undefined
    if (bySf) return String(bySf.id)
  }

  // Soft evidence only — never auto-merge on phone/email alone
  const softPhoneHits = opts.phone
    ? (db
        .prepare(
          `SELECT id, full_name FROM clients WHERE phone_normalized = ? OR whatsapp = ? LIMIT 5`,
        )
        .all(opts.phone, opts.phone) as Array<{ id: string; full_name: string }>)
    : []

  const personId = id('person')
  const createdAt = nowIso()
  db.prepare(
    `INSERT INTO clients (
      id, full_name, preferred_name, email, phone, phone_normalized, whatsapp,
      consultant_id, consultant_name, status, presence, tags_json, courses_json, source,
      cpf_normalized, cpf_raw, salesforce_id, salesforce_url, grade_label,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'lead', 'unknown', '[]', '[]', 'historical_import',
      ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    personId,
    opts.name,
    opts.name.split(/\s+/)[0] || opts.name,
    opts.email,
    opts.phone,
    opts.phone,
    opts.phone,
    opts.cpfNorm,
    opts.cpfNorm,
    opts.salesforce && !opts.salesforce.startsWith('http') ? opts.salesforce : null,
    opts.salesforce?.startsWith('http') ? opts.salesforce : null,
    opts.grade ?? null,
    createdAt,
    createdAt,
  )

  for (const hit of softPhoneHits) {
    const sameName = hit.full_name.trim().toLowerCase() === opts.name.trim().toLowerCase()
    opts.onDupe(
      personId,
      hit.id,
      sameName ? 'POSSIBLE_DUPLICATE_NAME_PHONE' : 'POSSIBLE_DUPLICATE_PHONE',
      {
        phone: opts.phone,
        name: opts.name,
        other: hit.full_name,
      },
    )
  }

  return personId
}

function refreshClassCounts(classId: string) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) as matriculados,
         SUM(CASE WHEN lower(confirmation_status) LIKE '%confirm%' OR present = 1 THEN 1 ELSE 0 END) as confirmados
       FROM enrollments WHERE training_class_id = ?`,
    )
    .get(classId) as { matriculados: number; confirmados: number }

  const tc = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(classId) as Record<
    string,
    unknown
  >
  const health = computeTurmaHealth({
    startDate: tc.start_date ? String(tc.start_date) : null,
    capacity: tc.capacity != null ? Number(tc.capacity) : null,
    metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
    metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
    matriculados: Number(row.matriculados),
    confirmados: Number(row.confirmados || 0),
    status: String(tc.status),
  })

  db.prepare(
    `UPDATE training_classes SET
      matriculados = ?, confirmados = ?, prioridade = ?, last_health_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    health.matriculados,
    health.confirmados,
    health.prioridade,
    JSON.stringify(health),
    nowIso(),
    classId,
  )

  syncTurmaAlert(
    classId,
    String(tc.course_name),
    tc.turma_label ? String(tc.turma_label) : null,
    health,
  )
}
