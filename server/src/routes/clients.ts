import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso, parseJson } from '../lib/utils.js'
import { assertClientAccess, consultantScopeId } from '../lib/scope.js'
import { requireAuth, requirePermission, writeAudit } from '../middleware/auth.js'

export interface ClientCourseProgress {
  courseId: string
  completed: boolean
  decision: boolean
  decidedAt?: string | null
  completedAt?: string | null
}

function mapClient(row: Record<string, unknown>, extras?: { notes?: unknown[]; activity?: unknown[] }) {
  return {
    id: String(row.id),
    externalIds: {
      googleSheetRowId: row.sheet_row_id ? String(row.sheet_row_id) : null,
      googleSheetKey: row.sheet_key ? String(row.sheet_key) : null,
    },
    fullName: String(row.full_name),
    preferredName: row.preferred_name ? String(row.preferred_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    phoneNormalized: row.phone_normalized ? String(row.phone_normalized) : null,
    whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    consultantId: row.consultant_id ? String(row.consultant_id) : null,
    consultantName: row.consultant_name ? String(row.consultant_name) : null,
    status: String(row.status),
    presence: String(row.presence),
    tags: parseJson<string[]>(String(row.tags_json), []),
    trainingLabel: row.training_label ? String(row.training_label) : null,
    eventDate: row.event_date ? String(row.event_date) : null,
    observations: row.observations ? String(row.observations) : null,
    pipelineStage: row.pipeline_stage ? String(row.pipeline_stage) : 'novo',
    nextAction: row.next_action ? String(row.next_action) : null,
    nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
    courses: parseJson<ClientCourseProgress[]>(String(row.courses_json), []),
    notes: extras?.notes ?? [],
    activity: extras?.activity ?? [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    syncedAt: row.synced_at ? String(row.synced_at) : null,
    source: String(row.source),
  }
}

function loadNotes(clientId: string) {
  return (
    db
      .prepare(
        `SELECT id, body, created_by_user_id, created_at
         FROM client_notes WHERE client_id = ? ORDER BY created_at DESC`,
      )
      .all(clientId) as Record<string, unknown>[]
  ).map((n) => ({
    id: String(n.id),
    body: String(n.body),
    createdByUserId: n.created_by_user_id ? String(n.created_by_user_id) : null,
    createdAt: String(n.created_at),
  }))
}

function loadActivity(clientId: string) {
  return (
    db
      .prepare(
        `SELECT id, type, message, created_by_user_id, created_at
         FROM client_activity WHERE client_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(clientId) as Record<string, unknown>[]
  ).map((a) => ({
    id: String(a.id),
    type: String(a.type),
    message: String(a.message),
    createdByUserId: a.created_by_user_id ? String(a.created_by_user_id) : null,
    createdAt: String(a.created_at),
  }))
}

function addActivity(
  clientId: string,
  type: string,
  message: string,
  userId?: string | null,
) {
  db.prepare(
    `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id('act'), clientId, type, message, userId ?? null, nowIso())
}

export function clientsRoutes(): Router {
  const router = createRouter()
  router.use(requireAuth)

  router.get('/', requirePermission('clients.view'), (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim().toLowerCase()
    const status = String(req.query.status ?? '').trim()
    const consultantId = String(req.query.consultantId ?? '').trim()
    const presence = String(req.query.presence ?? '').trim()
    const tag = String(req.query.tag ?? '').trim().toLowerCase()

    let rows = db
      .prepare('SELECT * FROM clients ORDER BY updated_at DESC')
      .all() as Record<string, unknown>[]

    const scope = consultantScopeId(req.user)
    if (scope) {
      rows = rows.filter((row) => String(row.consultant_id ?? '') === scope)
    }

    if (q) {
      rows = rows.filter((row) => {
        const hay = [
          row.full_name,
          row.preferred_name,
          row.email,
          row.phone,
          row.whatsapp,
          row.consultant_name,
          row.observations,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    if (status && status !== 'all') {
      rows = rows.filter((row) => String(row.status) === status)
    }
    if (consultantId && consultantId !== 'all') {
      rows = rows.filter((row) => String(row.consultant_id ?? '') === consultantId)
    }
    if (presence && presence !== 'all') {
      rows = rows.filter((row) => String(row.presence) === presence)
    }
    if (tag) {
      rows = rows.filter((row) =>
        parseJson<string[]>(String(row.tags_json), []).some((t) => t.toLowerCase() === tag),
      )
    }

    res.json(rows.map((row) => mapClient(row)))
  })

  router.get('/:id', requirePermission('clients.view'), (req: Request, res: Response) => {
    const row = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (!assertClientAccess(req.user, row.consultant_id ? String(row.consultant_id) : null)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    res.json(
      mapClient(row, {
        notes: loadNotes(String(row.id)),
        activity: loadActivity(String(row.id)),
      }),
    )
  })

  router.post('/', requirePermission('clients.edit'), (req: Request, res: Response) => {
    const schema = z.object({
      fullName: z.string().min(2),
      preferredName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional().or(z.literal('')),
      phone: z.string().nullable().optional(),
      whatsapp: z.string().nullable().optional(),
      consultantId: z.string().nullable().optional(),
      consultantName: z.string().nullable().optional(),
      status: z
        .enum(['lead', 'active', 'negotiating', 'won', 'inactive', 'archived'])
        .default('lead'),
      presence: z.enum(['unknown', 'present', 'absent']).default('unknown'),
      tags: z.array(z.string()).default([]),
      trainingLabel: z.string().nullable().optional(),
      eventDate: z.string().nullable().optional(),
      observations: z.string().nullable().optional(),
      courses: z
        .array(
          z.object({
            courseId: z.string(),
            completed: z.boolean(),
            decision: z.boolean(),
            decidedAt: z.string().nullable().optional(),
            completedAt: z.string().nullable().optional(),
          }),
        )
        .default([]),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() })
      return
    }

    const clientId = id('client')
    const createdAt = nowIso()
    const data = parsed.data

    db.prepare(
      `INSERT INTO clients (
        id, sheet_row_id, sheet_key, full_name, preferred_name, email, phone, phone_normalized,
        whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label,
        event_date, observations, courses_json, source, created_at, updated_at, synced_at
      ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, NULL)`,
    ).run(
      clientId,
      data.fullName.trim(),
      data.preferredName?.trim() || null,
      data.email || null,
      data.phone || null,
      data.phone || null,
      data.whatsapp || data.phone || null,
      data.consultantId || null,
      data.consultantName || null,
      data.status,
      data.presence,
      JSON.stringify(data.tags),
      data.trainingLabel || null,
      data.eventDate || null,
      data.observations || null,
      JSON.stringify(data.courses),
      createdAt,
      createdAt,
    )

    addActivity(clientId, 'other', 'Cliente criado', req.user?.id)
    writeAudit('clients.create', { userId: req.user?.id, meta: { clientId }, ip: req.ip })

    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as Record<
      string,
      unknown
    >
    res.status(201).json(
      mapClient(row, { notes: loadNotes(clientId), activity: loadActivity(clientId) }),
    )
  })

  router.patch('/:id', requirePermission('clients.edit'), (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (
      !assertClientAccess(
        req.user,
        existing.consultant_id ? String(existing.consultant_id) : null,
      )
    ) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const schema = z.object({
      fullName: z.string().min(2).optional(),
      preferredName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional().or(z.literal('')),
      phone: z.string().nullable().optional(),
      whatsapp: z.string().nullable().optional(),
      consultantId: z.string().nullable().optional(),
      consultantName: z.string().nullable().optional(),
      status: z
        .enum(['lead', 'active', 'negotiating', 'won', 'inactive', 'archived'])
        .optional(),
      presence: z.enum(['unknown', 'present', 'absent']).optional(),
      tags: z.array(z.string()).optional(),
      trainingLabel: z.string().nullable().optional(),
      eventDate: z.string().nullable().optional(),
      observations: z.string().nullable().optional(),
      pipelineStage: z.string().optional(),
      nextAction: z.string().nullable().optional(),
      nextActionAt: z.string().nullable().optional(),
      courses: z
        .array(
          z.object({
            courseId: z.string(),
            completed: z.boolean(),
            decision: z.boolean(),
            decidedAt: z.string().nullable().optional(),
            completedAt: z.string().nullable().optional(),
          }),
        )
        .optional(),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }

    const d = parsed.data
    const updatedAt = nowIso()
    const next = {
      full_name: d.fullName?.trim() ?? existing.full_name,
      preferred_name:
        d.preferredName !== undefined ? d.preferredName : existing.preferred_name,
      email: d.email !== undefined ? d.email || null : existing.email,
      phone: d.phone !== undefined ? d.phone : existing.phone,
      phone_normalized: d.phone !== undefined ? d.phone : existing.phone_normalized,
      whatsapp: d.whatsapp !== undefined ? d.whatsapp : existing.whatsapp,
      consultant_id: d.consultantId !== undefined ? d.consultantId : existing.consultant_id,
      consultant_name:
        d.consultantName !== undefined ? d.consultantName : existing.consultant_name,
      status: d.status ?? existing.status,
      presence: d.presence ?? existing.presence,
      tags_json: d.tags ? JSON.stringify(d.tags) : existing.tags_json,
      training_label:
        d.trainingLabel !== undefined ? d.trainingLabel : existing.training_label,
      event_date: d.eventDate !== undefined ? d.eventDate : existing.event_date,
      observations:
        d.observations !== undefined ? d.observations : existing.observations,
      courses_json: d.courses ? JSON.stringify(d.courses) : existing.courses_json,
      pipeline_stage: d.pipelineStage ?? existing.pipeline_stage ?? 'novo',
      next_action: d.nextAction !== undefined ? d.nextAction : existing.next_action,
      next_action_at:
        d.nextActionAt !== undefined ? d.nextActionAt : existing.next_action_at,
    }

    db.prepare(
      `UPDATE clients SET
        full_name = ?, preferred_name = ?, email = ?, phone = ?, phone_normalized = ?,
        whatsapp = ?, consultant_id = ?, consultant_name = ?, status = ?, presence = ?,
        tags_json = ?, training_label = ?, event_date = ?, observations = ?, courses_json = ?,
        pipeline_stage = ?, next_action = ?, next_action_at = ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      next.full_name,
      next.preferred_name,
      next.email,
      next.phone,
      next.phone_normalized,
      next.whatsapp,
      next.consultant_id,
      next.consultant_name,
      next.status,
      next.presence,
      next.tags_json,
      next.training_label,
      next.event_date,
      next.observations,
      next.courses_json,
      next.pipeline_stage,
      next.next_action,
      next.next_action_at,
      updatedAt,
      req.params.id,
    )

    if (d.pipelineStage && d.pipelineStage !== existing.pipeline_stage) {
      addActivity(
        String(req.params.id),
        'status_change',
        `Pipeline: ${existing.pipeline_stage || 'novo'} → ${d.pipelineStage}`,
        req.user?.id,
      )
    } else if (d.status && d.status !== existing.status) {
      addActivity(
        String(req.params.id),
        'status_change',
        `Status: ${existing.status} → ${d.status}`,
        req.user?.id,
      )
    } else if (d.courses) {
      addActivity(String(req.params.id), 'course_update', 'Cursos atualizados', req.user?.id)
    } else {
      addActivity(String(req.params.id), 'other', 'Cliente atualizado', req.user?.id)
    }

    writeAudit('clients.update', {
      userId: req.user?.id,
      meta: { clientId: req.params.id },
      ip: req.ip,
    })

    const row = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id) as Record<string, unknown>
    res.json(
      mapClient(row, {
        notes: loadNotes(String(req.params.id)),
        activity: loadActivity(String(req.params.id)),
      }),
    )
  })

  router.post('/:id/notes', requirePermission('clients.edit'), (req: Request, res: Response) => {
    const existing = db.prepare('SELECT id, consultant_id FROM clients WHERE id = ?').get(req.params.id) as
      | { id: string; consultant_id?: string }
      | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (!assertClientAccess(req.user, existing.consultant_id)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const body = String(req.body?.body ?? '').trim()
    if (!body) {
      res.status(400).json({ error: 'empty_note' })
      return
    }
    const noteId = id('note')
    const createdAt = nowIso()
    db.prepare(
      `INSERT INTO client_notes (id, client_id, body, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(noteId, req.params.id, body, req.user?.id ?? null, createdAt)
    addActivity(String(req.params.id), 'note', 'Nova observação registrada', req.user?.id)
    res.status(201).json({
      id: noteId,
      body,
      createdByUserId: req.user?.id ?? null,
      createdAt,
    })
  })

  return router
}
