import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso, parseJson } from '../lib/utils.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { computeTurmaHealth } from '../services/ops/turmaHealth.js'
import {
  runHistoricalImport,
  type HistoricalSheetTab,
} from '../services/ops/historicalImport.js'
import { createSheetsClient, shouldImportTurmaTab } from '../services/googleSheets/client.js'
import { env } from '../config/env.js'
import { FIXTURE_HISTORICAL_TABS } from '../services/ops/fixtures/historicalTabs.js'
import { ensureDemoOpenTurmas } from '../services/ops/courseResolve.js'
import { listActiveAlerts, syncTurmaAlert } from '../services/ops/turmaAlerts.js'
import {
  DEFAULT_ELIGIBILITY_CONFIG,
  evaluateEligibility,
  type PersonHistoryLite,
} from '../services/ops/potentialEligibility.js'
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABEL,
  OPEN_CONTACT_STATUSES,
  contactStatusSortSql,
  isContactStatus,
  normalizeContactStatus,
  type ContactStatus,
} from '../services/ops/contactStatus.js'
import { CONFIRMACAO_SELECT, mapConfirmacaoRow } from '../services/ops/confirmacaoMapper.js'

export function opsRoutes() {
  const router = Router()
  router.use(requireAuth)

  router.get('/turmas', requirePermission('dashboard.view'), (req, res) => {
    const priority = String(req.query.priority || '')
    const windowDays = Number(req.query.windowDays || 0)
    let rows = db
      .prepare(`SELECT * FROM training_classes ORDER BY start_date IS NULL, start_date ASC`)
      .all() as Record<string, unknown>[]

    if (priority) {
      rows = rows.filter((r) => String(r.prioridade || '') === priority)
    }
    if (windowDays > 0) {
      const now = Date.now()
      rows = rows.filter((r) => {
        if (!r.start_date) return false
        const d = new Date(String(r.start_date)).getTime() - now
        const days = d / 86400000
        return days >= 0 && days <= windowDays
      })
    }

    res.json(
      rows.map((r) => {
        const health =
          parseJson(String(r.last_health_json || 'null'), null) ||
          computeTurmaHealth({
            startDate: r.start_date ? String(r.start_date) : null,
            capacity: r.capacity != null ? Number(r.capacity) : null,
            metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
            metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
            matriculados: Number(r.matriculados || 0),
            confirmados: Number(r.confirmados || 0),
            status: String(r.status),
          })
        return {
          id: String(r.id),
          courseId: r.course_id ? String(r.course_id) : null,
          courseName: String(r.course_name),
          turmaLabel: r.turma_label ? String(r.turma_label) : null,
          unidade: String(r.unidade || 'Chapecó'),
          startDate: r.start_date ? String(r.start_date) : null,
          endDate: r.end_date ? String(r.end_date) : null,
          status: String(r.status),
          capacity: r.capacity != null ? Number(r.capacity) : null,
          metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
          metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
          matriculados: Number(r.matriculados || 0),
          confirmados: Number(r.confirmados || 0),
          prioridade: r.prioridade ? String(r.prioridade) : health.prioridade,
          responsavelAcao: r.responsavel_acao ? String(r.responsavel_acao) : null,
          acaoComercial: r.acao_comercial ? String(r.acao_comercial) : null,
          health,
        }
      }),
    )
  })

  router.get('/turmas/:id', requirePermission('dashboard.view'), (req, res) => {
    const r = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!r) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const participants = db
      .prepare(
        `SELECT ${CONFIRMACAO_SELECT}
         FROM enrollments e
         JOIN clients c ON c.id = e.client_id
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE e.training_class_id = ?
         ORDER BY ${contactStatusSortSql()}, c.full_name`,
      )
      .all(req.params.id) as Record<string, unknown>[]

    const health =
      parseJson(String(r.last_health_json || 'null'), null) ||
      computeTurmaHealth({
        startDate: r.start_date ? String(r.start_date) : null,
        capacity: r.capacity != null ? Number(r.capacity) : null,
        metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
        metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
        matriculados: Number(r.matriculados || 0),
        confirmados: Number(r.confirmados || 0),
        status: String(r.status),
      })

    res.json({
      turma: {
        id: String(r.id),
        courseName: String(r.course_name),
        turmaLabel: r.turma_label ? String(r.turma_label) : null,
        startDate: r.start_date ? String(r.start_date) : null,
        status: String(r.status),
        metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
        metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
        capacity: r.capacity != null ? Number(r.capacity) : null,
      },
      health,
      contactStatuses: CONTACT_STATUS_LABEL,
      participants: participants.map(mapConfirmacaoRow),
    })
  })

  router.patch('/turmas/:id', requirePermission('courses.edit'), (req, res) => {
    const existing = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const schema = z.object({
      metaMinima: z.number().int().nonnegative().nullable().optional(),
      metaIdeal: z.number().int().nonnegative().nullable().optional(),
      capacity: z.number().int().nonnegative().nullable().optional(),
      startDate: z.string().nullable().optional(),
      status: z.string().optional(),
      responsavelAcao: z.string().nullable().optional(),
      acaoComercial: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const d = parsed.data
    const metaMin =
      d.metaMinima !== undefined ? d.metaMinima : (existing.meta_minima as number | null)
    const metaIdeal =
      d.metaIdeal !== undefined ? d.metaIdeal : (existing.meta_ideal as number | null)
    const capacity = d.capacity !== undefined ? d.capacity : (existing.capacity as number | null)
    const startDate =
      d.startDate !== undefined ? d.startDate : (existing.start_date as string | null)
    const status = d.status ?? String(existing.status)

    const health = computeTurmaHealth({
      startDate,
      capacity,
      metaMinima: metaMin,
      metaIdeal,
      matriculados: Number(existing.matriculados || 0),
      confirmados: Number(existing.confirmados || 0),
      status,
    })

    db.prepare(
      `UPDATE training_classes SET
        meta_minima = ?, meta_ideal = ?, capacity = ?, start_date = ?, status = ?,
        responsavel_acao = COALESCE(?, responsavel_acao),
        acao_comercial = COALESCE(?, acao_comercial),
        prioridade = ?, last_health_json = ?, ultima_revisao = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      metaMin,
      metaIdeal,
      capacity,
      startDate,
      status,
      d.responsavelAcao ?? null,
      d.acaoComercial ?? null,
      health.prioridade,
      JSON.stringify(health),
      nowIso(),
      nowIso(),
      req.params.id,
    )
    syncTurmaAlert(
      req.params.id,
      String(existing.course_name),
      existing.turma_label ? String(existing.turma_label) : null,
      health,
    )
    res.json({ ok: true, health })
  })

  router.get('/alerts', requirePermission('dashboard.view'), (_req, res) => {
    res.json(
      listActiveAlerts().map((a) => ({
        id: String(a.id),
        trainingClassId: String(a.training_class_id),
        title: String(a.title),
        body: a.body ? String(a.body) : null,
        prioridade: a.prioridade ? String(a.prioridade) : null,
        courseName: String(a.course_name),
        turmaLabel: a.turma_label ? String(a.turma_label) : null,
        updatedAt: String(a.updated_at),
      })),
    )
  })

  router.get('/turmas/:id/potenciais', requirePermission('clients.view'), (req, res) => {
    const tc = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!tc) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const targetCourseId = tc.course_id ? String(tc.course_id) : null
    if (!targetCourseId || targetCourseId === 'course_unknown') {
      res.json({
        status: 'PARCIAL',
        total: 0,
        byConsultant: [],
        items: [],
        note: 'Turma sem course_id de catálogo — não é possível calcular potenciais.',
        pendingRules: DEFAULT_ELIGIBILITY_CONFIG.pendingBusinessRules,
      })
      return
    }

    const people = db.prepare('SELECT * FROM clients').all() as Record<string, unknown>[]
    const eligible: Array<{
      personId: string
      fullName: string
      consultantName: string | null
      grade: string | null
      lastTurmaLabel: string | null
      reasons: string[]
    }> = []

    for (const p of people) {
      const pid = String(p.id)
      const completed = db
        .prepare(
          `SELECT DISTINCT course_id FROM enrollments WHERE client_id = ? AND (completed = 1 OR present = 1)`,
        )
        .all(pid) as Array<{ course_id: string }>
      const enrolledOpen = db
        .prepare(
          `SELECT DISTINCT e.course_id FROM enrollments e
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.client_id = ?
             AND e.course_id = ?
             AND (t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`,
        )
        .all(pid, targetCourseId) as Array<{ course_id: string }>
      const lastTurma = db
        .prepare(
          `SELECT t.turma_label FROM enrollments e
           JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.client_id = ?
           ORDER BY t.start_date DESC LIMIT 1`,
        )
        .get(pid) as { turma_label: string } | undefined

      const lite: PersonHistoryLite = {
        personId: pid,
        fullName: String(p.full_name),
        consultantName: p.consultant_name ? String(p.consultant_name) : null,
        grade: p.grade_label ? String(p.grade_label) : null,
        completedCourseIds: completed.map((c) => c.course_id),
        enrolledCourseIds: enrolledOpen.map((c) => c.course_id),
        lastTurmaLabel: lastTurma?.turma_label ?? null,
      }
      const result = evaluateEligibility(lite, targetCourseId)
      if (!result.eligible) continue
      eligible.push({
        personId: pid,
        fullName: lite.fullName,
        consultantName: lite.consultantName,
        grade: lite.grade,
        lastTurmaLabel: lite.lastTurmaLabel,
        reasons: result.reasons,
      })
    }

    const byConsultant: Record<string, number> = {}
    for (const e of eligible) {
      const k = e.consultantName || 'Sem consultor'
      byConsultant[k] = (byConsultant[k] || 0) + 1
    }

    res.json({
      status: 'FUNCIONANDO',
      courseId: targetCourseId,
      courseName: String(tc.course_name),
      turmaLabel: tc.turma_label ? String(tc.turma_label) : null,
      total: eligible.length,
      byConsultant: Object.entries(byConsultant)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      items: eligible.slice(0, 100),
      pendingRules: DEFAULT_ELIGIBILITY_CONFIG.pendingBusinessRules,
    })
  })

  router.post('/turmas/refresh-health', requirePermission('courses.edit'), (_req, res) => {
    const rows = db.prepare('SELECT id FROM training_classes').all() as Array<{ id: string }>
    for (const r of rows) {
      const tc = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(r.id) as Record<
        string,
        unknown
      >
      const health = computeTurmaHealth({
        startDate: tc.start_date ? String(tc.start_date) : null,
        capacity: tc.capacity != null ? Number(tc.capacity) : null,
        metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
        metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
        matriculados: Number(tc.matriculados || 0),
        confirmados: Number(tc.confirmados || 0),
        status: String(tc.status),
      })
      db.prepare(
        `UPDATE training_classes SET prioridade = ?, last_health_json = ?, updated_at = ? WHERE id = ?`,
      ).run(health.prioridade, JSON.stringify(health), nowIso(), r.id)
      syncTurmaAlert(
        r.id,
        String(tc.course_name),
        tc.turma_label ? String(tc.turma_label) : null,
        health,
      )
    }
    res.json({ ok: true, refreshed: rows.length })
  })

  router.get('/painel', requirePermission('dashboard.view'), (_req, res) => {
    const turmas = db.prepare('SELECT * FROM training_classes').all() as Record<string, unknown>[]
    const byPriority: Record<string, number> = {}
    for (const t of turmas) {
      const p = String(t.prioridade || 'SEM_ACAO')
      byPriority[p] = (byPriority[p] || 0) + 1
    }
    const critical = turmas
      .filter((t) => ['CRITICA', 'ALTA', 'DEFINIR_META'].includes(String(t.prioridade)))
      .slice(0, 12)
      .map((t) => ({
        id: String(t.id),
        courseName: String(t.course_name),
        turmaLabel: t.turma_label ? String(t.turma_label) : null,
        startDate: t.start_date ? String(t.start_date) : null,
        prioridade: String(t.prioridade || 'SEM_ACAO'),
        confirmados: Number(t.confirmados || 0),
        metaMinima: t.meta_minima != null ? Number(t.meta_minima) : null,
        health: parseJson(String(t.last_health_json || 'null'), null),
      }))

    res.json({
      product: 'FEBRACIS OPS',
      totals: { turmas: turmas.length, byPriority },
      attention: critical,
      migration: latestMigrationSummary(),
      sheetsPilot: {
        spreadsheetId: env.googleSheets.spreadsheetId || null,
        enabled: env.googleSheets.enabled,
        mode: createSheetsClient({
          enabled: env.googleSheets.enabled,
          credentialsPath: env.googleSheets.credentialsPath,
          credentialsJson: env.googleSheets.credentialsJson,
        }).mode,
      },
    })
  })

  router.get('/migration/issues', requirePermission('settings.view'), (req, res) => {
    const status = String(req.query.status || 'open')
    const rows = (
      status === 'all'
        ? db.prepare('SELECT * FROM migration_issues ORDER BY created_at DESC LIMIT 200').all()
        : db
            .prepare(
              'SELECT * FROM migration_issues WHERE status = ? ORDER BY created_at DESC LIMIT 200',
            )
            .all(status)
    ) as Record<string, unknown>[]
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        severity: String(r.severity),
        sourceSheet: r.source_sheet ? String(r.source_sheet) : null,
        sourceRow: r.source_row != null ? Number(r.source_row) : null,
        message: String(r.message),
        status: String(r.status),
        createdAt: String(r.created_at),
      })),
    )
  })

  router.post('/migration/run-fixtures', requirePermission('sheets.sync'), (req, res) => {
    const summary = runHistoricalImport(FIXTURE_HISTORICAL_TABS, {
      userId: req.user?.id,
      spreadsheetId: 'fixtures',
      mode: 'apply',
    })
    ensureDemoOpenTurmas()
    // refresh health for demo turmas
    const demos = db
      .prepare(`SELECT id FROM training_classes WHERE external_id LIKE 'demo-%'`)
      .all() as Array<{ id: string }>
    for (const d of demos) {
      const tc = db.prepare('SELECT * FROM training_classes WHERE id = ?').get(d.id) as Record<
        string,
        unknown
      >
      const health = computeTurmaHealth({
        startDate: tc.start_date ? String(tc.start_date) : null,
        capacity: tc.capacity != null ? Number(tc.capacity) : null,
        metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
        metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
        matriculados: Number(tc.matriculados || 0),
        confirmados: Number(tc.confirmados || 0),
        status: String(tc.status),
      })
      db.prepare(
        `UPDATE training_classes SET prioridade = ?, last_health_json = ?, updated_at = ? WHERE id = ?`,
      ).run(health.prioridade, JSON.stringify(health), nowIso(), d.id)
      syncTurmaAlert(
        d.id,
        String(tc.course_name),
        tc.turma_label ? String(tc.turma_label) : null,
        health,
      )
    }
    res.json({ status: 'FUNCIONANDO', source: 'fixtures', summary, demoTurmas: demos.length })
  })

  router.post('/migration/run-sheet', requirePermission('sheets.sync'), async (req, res) => {
    const spreadsheetId =
      String(req.body?.spreadsheetId || '').trim() ||
      env.googleSheets.spreadsheetId ||
      ''
    const client = createSheetsClient({
      enabled: env.googleSheets.enabled,
      credentialsPath: env.googleSheets.credentialsPath,
      credentialsJson: env.googleSheets.credentialsJson,
    })
    if (client.mode !== 'production' || !spreadsheetId) {
      res.status(503).json({
        status: 'PENDENTE CREDENCIAL',
        error: 'google_sheets_credentials_required',
        hint:
          'Configure GOOGLE_SHEETS_ENABLED=true + GOOGLE_SHEETS_CREDENTIALS_JSON (ou PATH) + SPREADSHEET_ID. Compartilhe a planilha com o e-mail da service account.',
        spreadsheetIdExpected:
          spreadsheetId || '1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I',
      })
      return
    }

    const bodySheets = z.array(z.string()).optional().parse(req.body?.sheets)
    let sheetNames = bodySheets
    if (!sheetNames?.length) {
      try {
        const titles = await client.listSheetTitles(spreadsheetId)
        sheetNames = titles.map((t) => t.title).filter(shouldImportTurmaTab)
      } catch (err) {
        console.warn('listSheetTitles failed', err)
        sheetNames = []
      }
    }

    if (!sheetNames.length) {
      res.status(502).json({ error: 'no_sheets_listed', status: 'PARCIAL' })
      return
    }

    const tabs: HistoricalSheetTab[] = []
    const failed: Array<{ sheet: string; error: string }> = []
    for (const name of sheetNames) {
      try {
        const { headers, rows } = await client.readTurmaTab(spreadsheetId, name)
        if (!headers.length) {
          failed.push({ sheet: name, error: 'empty_or_no_header' })
          continue
        }
        tabs.push({
          sourceFile: 'CONFIRMACOES_TURMA_CHAPECO',
          sourceSheet: name,
          headers,
          rows: rows.map((r) => headers.map((h) => String(r[h] ?? ''))),
        })
      } catch (err) {
        failed.push({
          sheet: name,
          error: err instanceof Error ? err.message : 'read_failed',
        })
        console.warn('sheet read failed', name, err)
      }
    }

    if (!tabs.length) {
      res.status(502).json({ error: 'no_sheets_readable', status: 'PARCIAL', failed })
      return
    }

    const summary = runHistoricalImport(tabs, {
      userId: req.user?.id,
      spreadsheetId,
      mode: 'apply',
    })
    res.json({
      status: 'FUNCIONANDO',
      source: 'google_sheets',
      spreadsheetId,
      tabsImported: tabs.map((t) => t.sourceSheet),
      failed,
      summary,
    })
  })

  router.get('/migration/sheets', requirePermission('sheets.sync'), async (_req, res) => {
    const spreadsheetId = env.googleSheets.spreadsheetId
    const client = createSheetsClient({
      enabled: env.googleSheets.enabled,
      credentialsPath: env.googleSheets.credentialsPath,
      credentialsJson: env.googleSheets.credentialsJson,
    })
    if (client.mode !== 'production' || !spreadsheetId) {
      res.status(503).json({
        status: 'PENDENTE CREDENCIAL',
        error: 'google_sheets_credentials_required',
        spreadsheetId: spreadsheetId || null,
      })
      return
    }
    try {
      const titles = await client.listSheetTitles(spreadsheetId)
      res.json({
        spreadsheetId,
        sheets: titles.map((t) => ({
          ...t,
          importable: shouldImportTurmaTab(t.title),
        })),
      })
    } catch (err) {
      res.status(502).json({
        error: 'sheets_list_failed',
        message: err instanceof Error ? err.message : 'unknown',
      })
    }
  })

  router.get('/confirmacoes', requirePermission('dashboard.view'), (req, res) => {
    const turmaId = String(req.query.turmaId || '').trim()
    const statusFilter = String(req.query.contactStatus || '').trim()
    const q = String(req.query.q || '').trim().toLowerCase()
    const queue = String(req.query.queue || 'aberta')
    const includeClosed = String(req.query.includeClosed || '') === '1'

    const where: string[] = ['e.training_class_id IS NOT NULL']
    const params: unknown[] = []

    if (turmaId) {
      where.push('e.training_class_id = ?')
      params.push(turmaId)
    }
    if (!includeClosed) {
      where.push(`(t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`)
    }
    if (statusFilter && isContactStatus(statusFilter)) {
      where.push(`COALESCE(e.contact_status, 'nao_contatado') = ?`)
      params.push(statusFilter)
    } else if (queue === 'aberta') {
      const open = OPEN_CONTACT_STATUSES.map(() => '?').join(',')
      where.push(`COALESCE(e.contact_status, 'nao_contatado') IN (${open})`)
      params.push(...OPEN_CONTACT_STATUSES)
    } else if (queue === 'pendente') {
      where.push(
        `COALESCE(e.contact_status, 'nao_contatado') IN ('nao_contatado','sem_resposta')`,
      )
    }

    const rows = db
      .prepare(
        `SELECT ${CONFIRMACAO_SELECT}
         FROM enrollments e
         JOIN clients c ON c.id = e.client_id
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${contactStatusSortSql()}, t.start_date IS NULL, t.start_date ASC, c.full_name`,
      )
      .all(...params) as Record<string, unknown>[]

    let items = rows.map(mapConfirmacaoRow)
    if (q) {
      items = items.filter((item) => {
        const hay = `${item.fullName} ${item.phone || ''} ${item.turmaLabel || ''} ${item.courseName || ''} ${item.consultantName || ''}`.toLowerCase()
        return hay.includes(q)
      })
    }

    const allForTotals = db
      .prepare(
        `SELECT COALESCE(e.contact_status, 'nao_contatado') as contact_status
         FROM enrollments e
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE e.training_class_id IS NOT NULL
           ${turmaId ? 'AND e.training_class_id = ?' : ''}
           ${includeClosed ? '' : `AND (t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`}`,
      )
      .all(...(turmaId ? [turmaId] : [])) as Array<{ contact_status: string }>

    const totals: Record<string, number> = { all: allForTotals.length }
    for (const s of CONTACT_STATUSES) totals[s] = 0
    for (const row of allForTotals) {
      const s = normalizeContactStatus(row.contact_status)
      totals[s] = (totals[s] || 0) + 1
    }
    totals.pendente = (totals.nao_contatado || 0) + (totals.sem_resposta || 0)
    totals.aberta = OPEN_CONTACT_STATUSES.reduce((n, s) => n + (totals[s] || 0), 0)

    const next = items.find((i) => i.contactStatus === 'nao_contatado' || i.contactStatus === 'sem_resposta') || null

    res.json({
      items,
      next,
      totals,
      contactStatuses: CONTACT_STATUS_LABEL,
      count: items.length,
    })
  })

  router.patch(
    '/enrollments/:enrollmentId/contact',
    requirePermission('clients.edit'),
    (req, res) => {
      const existing = db
        .prepare(
          `SELECT ${CONFIRMACAO_SELECT}
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.id = ?`,
        )
        .get(req.params.enrollmentId) as Record<string, unknown> | undefined
      if (!existing) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      const schema = z.object({
        contactStatus: z.enum(CONTACT_STATUSES).optional(),
        observation: z.string().max(2000).optional(),
        openedWhatsApp: z.boolean().optional(),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_payload' })
        return
      }
      const d = parsed.data
      if (!d.contactStatus && !d.openedWhatsApp && d.observation == null) {
        res.status(400).json({ error: 'nothing_to_update' })
        return
      }

      const current = normalizeContactStatus(
        existing.contact_status ? String(existing.contact_status) : null,
      )
      let nextStatus: ContactStatus = current
      if (d.contactStatus) nextStatus = d.contactStatus
      else if (d.openedWhatsApp && current === 'nao_contatado') nextStatus = 'contatado'

      const now = nowIso()
      const lastContacted =
        d.openedWhatsApp || nextStatus !== 'nao_contatado'
          ? now
          : existing.last_contacted_at
            ? String(existing.last_contacted_at)
            : null

      db.prepare(
        `UPDATE enrollments SET
          contact_status = ?,
          contact_status_updated_at = ?,
          last_contacted_at = ?,
          updated_at = ?
         WHERE id = ?`,
      ).run(nextStatus, now, lastContacted, now, req.params.enrollmentId)

      const eventType = d.openedWhatsApp ? 'whatsapp_open' : 'contact_status'
      db.prepare(
        `INSERT INTO contact_events (
          id, person_id, training_class_id, enrollment_id, occurred_at, type, channel,
          consultant_id, consultant_name, result, observation, source_sheet, source_row,
          raw_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id('ce'),
        String(existing.client_id),
        existing.training_class_id ? String(existing.training_class_id) : null,
        String(req.params.enrollmentId),
        now,
        eventType,
        'whatsapp',
        req.user?.consultantId || null,
        req.user?.name || null,
        nextStatus,
        d.observation || (d.openedWhatsApp ? 'Abriu conversa no WhatsApp (envio manual)' : null),
        existing.source_sheet ? String(existing.source_sheet) : null,
        existing.source_row != null ? Number(existing.source_row) : null,
        JSON.stringify({
          openedWhatsApp: Boolean(d.openedWhatsApp),
          from: current,
          to: nextStatus,
          autoSend: false,
        }),
        now,
      )

      const updated = db
        .prepare(
          `SELECT ${CONFIRMACAO_SELECT}
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.id = ?`,
        )
        .get(req.params.enrollmentId) as Record<string, unknown>

      res.json({ item: mapConfirmacaoRow(updated), previousStatus: current })
    },
  )

  router.post('/turmas', requirePermission('courses.edit'), (req, res) => {
    const schema = z.object({
      courseName: z.string().min(2),
      courseId: z.string().nullable().optional(),
      turmaLabel: z.string().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      capacity: z.number().int().optional(),
      metaMinima: z.number().int().optional(),
      metaIdeal: z.number().int().optional(),
      status: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const d = parsed.data
    const turmaId = id('turma')
    const health = computeTurmaHealth({
      startDate: d.startDate,
      capacity: d.capacity,
      metaMinima: d.metaMinima,
      metaIdeal: d.metaIdeal,
      matriculados: 0,
      confirmados: 0,
      status: d.status || 'EM_CAPTACAO',
    })
    db.prepare(
      `INSERT INTO training_classes (
        id, course_id, course_name, turma_label, unidade, start_date, end_date, status,
        capacity, meta_minima, meta_ideal, prioridade, last_health_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Chapecó', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      turmaId,
      d.courseId ?? null,
      d.courseName,
      d.turmaLabel ?? d.courseName,
      d.startDate ?? null,
      d.endDate ?? null,
      d.status || 'EM_CAPTACAO',
      d.capacity ?? null,
      d.metaMinima ?? null,
      d.metaIdeal ?? null,
      health.prioridade,
      JSON.stringify(health),
      nowIso(),
      nowIso(),
    )
    res.status(201).json({ id: turmaId, health })
  })

  return router
}

function latestMigrationSummary() {
  const row = db
    .prepare(`SELECT * FROM import_runs ORDER BY started_at DESC LIMIT 1`)
    .get() as Record<string, unknown> | undefined
  if (!row) return null
  return {
    runId: String(row.id),
    status: String(row.status),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    summary: parseJson(String(row.summary_json || 'null'), null),
  }
}
