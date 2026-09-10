import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso, parseJson } from '../lib/utils.js'
import { assertClientAccess, consultantScopeId } from '../lib/scope.js'
import { GOLDEN_FICHA_LAYOUT, LEGACY_COURSES } from '../lib/legacyCatalog.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export const DEFAULT_FICHA_LAYOUT = GOLDEN_FICHA_LAYOUT

function ensureDefaultLayout() {
  const existing = db.prepare('SELECT id, version, updated_by FROM ficha_layouts WHERE is_default = 1').get() as
    | { id: string; version: number; updated_by?: string | null }
    | undefined
  if (!existing) {
    db.prepare(
      `INSERT INTO ficha_layouts (id, name, version, layout_json, is_default, updated_at)
       VALUES (?, 'Padrão FEBRACIS Legacy', 1, ?, 1, ?)`,
    ).run(id('layout'), JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso())
    return
  }
  // Sync golden legacy layout until an admin explicitly saves (updated_by set).
  if (!existing.updated_by) {
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = 'Padrão FEBRACIS Legacy', updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso(), existing.id)
  }
}

/** Upsert full legacy course catalog (descriptions, prices, dates, markers). */
export function ensureLegacyCourses() {
  const now = nowIso()
  const insert = db.prepare(
    `INSERT INTO courses (
      id, name, short_name, category, description, status, price_label, price_amount, currency,
      marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
    ) VALUES (?, ?, NULL, 'catalog', ?, 'active', ?, NULL, 'BRL', ?, ?, NULL, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      price_label = excluded.price_label,
      marker_color = excluded.marker_color,
      stacked = excluded.stacked,
      sort_order = excluded.sort_order,
      status = 'active',
      updated_at = excluded.updated_at`,
  )
  for (const c of LEGACY_COURSES) {
    insert.run(
      c.id,
      c.name,
      c.description,
      c.priceLabel,
      c.markerColor,
      c.stacked ? 1 : 0,
      c.sortOrder,
      now,
      now,
    )
  }

  // Persist date labels into the newest event or a synthetic one for Ficha.
  for (const c of LEGACY_COURSES) {
    const ev = db
      .prepare(
        `SELECT id FROM course_events WHERE course_id = ? ORDER BY start_date DESC LIMIT 1`,
      )
      .get(c.id) as { id: string } | undefined
    if (ev) {
      db.prepare(`UPDATE course_events SET date_label = ? WHERE id = ?`).run(c.dateLabel, ev.id)
    } else {
      db.prepare(
        `INSERT INTO course_events (
          id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, NULL, ?, 'scheduled', 'Chapecó', NULL, ?, ?)`,
      ).run(id('evt'), c.id, c.name, c.dateLabel, now, now)
    }
  }
}

export function fichaRoutes() {
  const router = Router()
  router.use(requireAuth)
  ensureDefaultLayout()
  ensureLegacyCourses()

  router.get('/layout', requirePermission('clients.print'), (_req, res) => {
    const row = db.prepare('SELECT * FROM ficha_layouts WHERE is_default = 1').get() as
      | Record<string, unknown>
      | undefined
    res.json({
      id: row ? String(row.id) : null,
      name: row ? String(row.name) : 'Padrão',
      version: row ? Number(row.version) : 1,
      layout: row
        ? parseJson(String(row.layout_json), DEFAULT_FICHA_LAYOUT)
        : DEFAULT_FICHA_LAYOUT,
      updatedAt: row ? String(row.updated_at) : null,
    })
  })

  router.put('/layout', requirePermission('ficha.edit'), (req, res) => {
    const schema = z.object({
      layout: z.record(z.any()),
      name: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    ensureDefaultLayout()
    const current = db.prepare('SELECT * FROM ficha_layouts WHERE is_default = 1').get() as Record<
      string,
      unknown
    >
    const updatedAt = nowIso()
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = COALESCE(?, name), version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?`,
    ).run(
      JSON.stringify(parsed.data.layout),
      parsed.data.name ?? null,
      updatedAt,
      req.user?.id ?? null,
      current.id,
    )
    const row = db.prepare('SELECT * FROM ficha_layouts WHERE id = ?').get(current.id) as Record<
      string,
      unknown
    >
    res.json({
      id: String(row.id),
      version: Number(row.version),
      layout: parseJson(String(row.layout_json), DEFAULT_FICHA_LAYOUT),
      updatedAt: String(row.updated_at),
    })
  })

  router.post('/layout/reset', requirePermission('ficha.edit'), (req, res) => {
    ensureDefaultLayout()
    const current = db.prepare('SELECT id FROM ficha_layouts WHERE is_default = 1').get() as {
      id: string
    }
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = 'Padrão FEBRACIS Legacy', version = version + 1, updated_at = ?, updated_by = NULL WHERE id = ?`,
    ).run(JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso(), current.id)
    res.json({ layout: DEFAULT_FICHA_LAYOUT })
  })

  router.get('/data/:clientId', requirePermission('clients.print'), (req, res) => {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.clientId) as
      | Record<string, unknown>
      | undefined
    if (!client) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (
      !assertClientAccess(req.user, client.consultant_id ? String(client.consultant_id) : null)
    ) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const courses = db
      .prepare(
        `SELECT * FROM courses WHERE status IN ('active','scheduled','completed') ORDER BY sort_order ASC`,
      )
      .all() as Record<string, unknown>[]

    const enrollments = db
      .prepare('SELECT * FROM enrollments WHERE client_id = ?')
      .all(req.params.clientId) as Record<string, unknown>[]

    const byCourse = new Map(enrollments.map((e) => [String(e.course_id), e]))

    const legacy = parseJson<
      Array<{ courseId: string; completed?: boolean; decision?: boolean }>
    >(String(client.courses_json || '[]'), [])

    const catalogDates = new Map(LEGACY_COURSES.map((c) => [c.id, c.dateLabel]))

    const rows = courses.map((course) => {
      const enr = byCourse.get(String(course.id))
      const leg = legacy.find((l) => l.courseId === String(course.id))
      const event = db
        .prepare(
          `SELECT date_label, start_date FROM course_events WHERE course_id = ? ORDER BY start_date DESC LIMIT 1`,
        )
        .get(String(course.id)) as { date_label?: string; start_date?: string } | undefined
      return {
        courseId: String(course.id),
        name: String(course.name),
        description: course.description ? String(course.description) : '',
        priceLabel: course.price_label ? String(course.price_label) : '',
        dateLabel:
          event?.date_label ||
          event?.start_date ||
          catalogDates.get(String(course.id)) ||
          '',
        markerColor: String(course.marker_color || 'gray'),
        stacked: Boolean(course.stacked),
        completed: enr ? Boolean(enr.completed) : Boolean(leg?.completed),
        decision: enr ? Boolean(enr.decision) : Boolean(leg?.decision),
      }
    })

    const layoutRow = db.prepare('SELECT layout_json FROM ficha_layouts WHERE is_default = 1').get() as
      | { layout_json: string }
      | undefined

    const totalMarked = rows.filter((r) => r.completed || r.decision).length

    res.json({
      client: {
        id: String(client.id),
        fullName: String(client.full_name),
        preferredName: client.preferred_name ? String(client.preferred_name) : null,
        consultantName: client.consultant_name ? String(client.consultant_name) : null,
      },
      courses: rows,
      totalMarked,
      totalCompleted: rows.filter((r) => r.completed).length,
      layout: layoutRow
        ? parseJson(layoutRow.layout_json, DEFAULT_FICHA_LAYOUT)
        : DEFAULT_FICHA_LAYOUT,
    })
  })

  router.get('/mass', requirePermission('print.mass'), (req, res) => {
    const consultantId = String(req.query.consultantId || '')
    let clients = db.prepare('SELECT id, full_name, consultant_id FROM clients').all() as Record<
      string,
      unknown
    >[]
    const scope = consultantScopeId(req.user)
    if (scope) {
      clients = clients.filter((c) => String(c.consultant_id || '') === scope)
    } else if (consultantId) {
      clients = clients.filter((c) => String(c.consultant_id || '') === consultantId)
    }
    res.json({
      clientIds: clients.map((c) => String(c.id)),
      count: clients.length,
    })
  })

  return router
}
