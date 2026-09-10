import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso } from '../lib/utils.js'
import { requireAuth, requirePermission, writeAudit } from '../middleware/auth.js'

function mapCourse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: row.short_name ? String(row.short_name) : null,
    category: String(row.category),
    description: row.description ? String(row.description) : null,
    status: String(row.status),
    priceLabel: row.price_label ? String(row.price_label) : null,
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    currency: String(row.currency || 'BRL'),
    markerColor: String(row.marker_color || 'gray'),
    stacked: Boolean(row.stacked),
    sheetColumnKey: row.sheet_column_key ? String(row.sheet_column_key) : null,
    sortOrder: Number(row.sort_order || 0),
    capacity: row.capacity == null ? null : Number(row.capacity),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    name: String(row.name),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    dateLabel: row.date_label ? String(row.date_label) : null,
    status: String(row.status),
    location: row.location ? String(row.location) : null,
    capacity: row.capacity == null ? null : Number(row.capacity),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapEnrollment(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    courseId: String(row.course_id),
    eventId: row.event_id ? String(row.event_id) : null,
    status: String(row.status),
    present: Boolean(row.present),
    completed: Boolean(row.completed),
    decision: Boolean(row.decision),
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function courseMetrics(courseId: string) {
  const rows = db
    .prepare('SELECT * FROM enrollments WHERE course_id = ?')
    .all(courseId) as Record<string, unknown>[]
  const participants = rows.length
  const present = rows.filter((r) => r.present).length
  const completed = rows.filter((r) => r.completed).length
  const decisions = rows.filter((r) => r.decision).length
  return {
    participants,
    present,
    completed,
    decisions,
    conversionRate: present ? Math.round((decisions / present) * 100) : 0,
  }
}

export function coursesRoutes() {
  const router = Router()
  router.use(requireAuth)

  router.get('/', requirePermission('courses.view'), (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM courses ORDER BY sort_order ASC, name COLLATE NOCASE')
      .all() as Record<string, unknown>[]
    res.json(
      rows.map((row) => ({
        ...mapCourse(row),
        metrics: courseMetrics(String(row.id)),
      })),
    )
  })

  router.get('/:id', requirePermission('courses.view'), (req, res) => {
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const events = (
      db
        .prepare('SELECT * FROM course_events WHERE course_id = ? ORDER BY start_date DESC')
        .all(req.params.id) as Record<string, unknown>[]
    ).map(mapEvent)
    const enrollments = (
      db
        .prepare(
          `SELECT e.*, c.full_name as client_name
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           WHERE e.course_id = ?
           ORDER BY c.full_name COLLATE NOCASE`,
        )
        .all(req.params.id) as Record<string, unknown>[]
    ).map((e) => ({ ...mapEnrollment(e), clientName: String(e.client_name) }))

    res.json({
      ...mapCourse(row),
      metrics: courseMetrics(String(row.id)),
      events,
      enrollments,
    })
  })

  router.post('/', requirePermission('courses.edit'), (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      shortName: z.string().nullable().optional(),
      category: z.string().default('outro'),
      description: z.string().nullable().optional(),
      status: z.enum(['draft', 'scheduled', 'active', 'completed', 'archived']).default('active'),
      priceLabel: z.string().nullable().optional(),
      priceAmount: z.number().nullable().optional(),
      markerColor: z.enum(['green', 'yellow', 'gray']).default('gray'),
      stacked: z.boolean().default(false),
      sheetColumnKey: z.string().nullable().optional(),
      sortOrder: z.number().default(0),
      capacity: z.number().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const courseId = id('course')
    const createdAt = nowIso()
    const d = parsed.data
    db.prepare(
      `INSERT INTO courses (
        id, name, short_name, category, description, status, price_label, price_amount, currency,
        marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      courseId,
      d.name,
      d.shortName ?? null,
      d.category,
      d.description ?? null,
      d.status,
      d.priceLabel ?? null,
      d.priceAmount ?? null,
      d.markerColor,
      d.stacked ? 1 : 0,
      d.sheetColumnKey ?? null,
      d.sortOrder,
      d.capacity ?? null,
      createdAt,
      createdAt,
    )
    writeAudit('courses.create', { userId: req.user?.id, meta: { courseId }, ip: req.ip })
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as Record<
      string,
      unknown
    >
    res.status(201).json({ ...mapCourse(row), metrics: courseMetrics(courseId) })
  })

  router.post('/:id/events', requirePermission('courses.edit'), (req, res) => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!course) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const schema = z.object({
      name: z.string().min(2),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      dateLabel: z.string().nullable().optional(),
      status: z.string().default('scheduled'),
      location: z.string().nullable().optional(),
      capacity: z.number().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const eventId = id('event')
    const createdAt = nowIso()
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      eventId,
      req.params.id,
      parsed.data.name,
      parsed.data.startDate ?? null,
      parsed.data.endDate ?? null,
      parsed.data.dateLabel ?? null,
      parsed.data.status,
      parsed.data.location ?? null,
      parsed.data.capacity ?? null,
      createdAt,
      createdAt,
    )
    const row = db.prepare('SELECT * FROM course_events WHERE id = ?').get(eventId) as Record<
      string,
      unknown
    >
    res.status(201).json(mapEvent(row))
  })

  router.post('/:id/enrollments', requirePermission('courses.edit'), (req, res) => {
    const schema = z.object({
      clientId: z.string(),
      eventId: z.string().nullable().optional(),
      status: z.string().default('inscrito'),
      present: z.boolean().default(false),
      completed: z.boolean().default(false),
      decision: z.boolean().default(false),
      notes: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const enrollmentId = id('enr')
    const createdAt = nowIso()
    db.prepare(
      `INSERT INTO enrollments (
        id, client_id, course_id, event_id, status, present, completed, decision, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      enrollmentId,
      parsed.data.clientId,
      req.params.id,
      parsed.data.eventId ?? null,
      parsed.data.status,
      parsed.data.present ? 1 : 0,
      parsed.data.completed ? 1 : 0,
      parsed.data.decision ? 1 : 0,
      parsed.data.notes ?? null,
      createdAt,
      createdAt,
    )
    const row = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(enrollmentId) as Record<
      string,
      unknown
    >
    res.status(201).json(mapEnrollment(row))
  })

  router.patch('/enrollments/:enrollmentId', requirePermission('courses.edit'), (req, res) => {
    const existing = db
      .prepare('SELECT * FROM enrollments WHERE id = ?')
      .get(req.params.enrollmentId) as Record<string, unknown> | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const schema = z.object({
      present: z.boolean().optional(),
      completed: z.boolean().optional(),
      decision: z.boolean().optional(),
      status: z.string().optional(),
      notes: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const d = parsed.data
    const updatedAt = nowIso()
    db.prepare(
      `UPDATE enrollments SET
        present = ?, completed = ?, decision = ?, status = ?, notes = ?,
        completed_at = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      d.present ?? existing.present,
      d.completed ?? existing.completed,
      d.decision ?? existing.decision,
      d.status ?? existing.status,
      d.notes !== undefined ? d.notes : existing.notes,
      d.completed ? updatedAt : existing.completed_at,
      d.decision ? updatedAt : existing.decided_at,
      updatedAt,
      req.params.enrollmentId,
    )
    const row = db
      .prepare('SELECT * FROM enrollments WHERE id = ?')
      .get(req.params.enrollmentId) as Record<string, unknown>
    res.json(mapEnrollment(row))
  })

  return router
}
