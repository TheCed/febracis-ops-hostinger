import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso } from '../lib/utils.js'
import { assertClientAccess, consultantScopeId } from '../lib/scope.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export function crmExtraRoutes() {
  const router = Router()
  router.use(requireAuth)

  router.get('/pipeline/stages', requirePermission('clients.view'), (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY sort_order')
      .all() as Record<string, unknown>[]
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        sortOrder: Number(r.sort_order),
        color: r.color ? String(r.color) : null,
      })),
    )
  })

  router.get('/pipeline/board', requirePermission('clients.view'), (req, res) => {
    const stages = db
      .prepare('SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY sort_order')
      .all() as Record<string, unknown>[]
    let clients = db
      .prepare(
        `SELECT id, full_name, preferred_name, consultant_id, consultant_name, status, pipeline_stage, next_action, next_action_at
         FROM clients ORDER BY updated_at DESC`,
      )
      .all() as Record<string, unknown>[]
    const scope = consultantScopeId(req.user)
    if (scope) {
      clients = clients.filter((c) => String(c.consultant_id || '') === scope)
    }

    res.json({
      stages: stages.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        slug: String(s.slug),
        color: s.color ? String(s.color) : null,
        clients: clients
          .filter((c) => String(c.pipeline_stage || 'novo') === String(s.slug))
          .map((c) => ({
            id: String(c.id),
            fullName: String(c.full_name),
            preferredName: c.preferred_name ? String(c.preferred_name) : null,
            consultantName: c.consultant_name ? String(c.consultant_name) : null,
            status: String(c.status),
            nextAction: c.next_action ? String(c.next_action) : null,
            nextActionAt: c.next_action_at ? String(c.next_action_at) : null,
          })),
      })),
    })
  })

  router.post('/pipeline/move', requirePermission('clients.edit'), (req, res) => {
    const schema = z.object({
      clientId: z.string().min(1),
      stageSlug: z.string().min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }

    const stage = db
      .prepare('SELECT slug FROM pipeline_stages WHERE slug = ? AND active = 1')
      .get(parsed.data.stageSlug)
    if (!stage) {
      res.status(400).json({ error: 'invalid_stage' })
      return
    }

    const existing = db
      .prepare('SELECT id, pipeline_stage, consultant_id FROM clients WHERE id = ?')
      .get(parsed.data.clientId) as
      | { id: string; pipeline_stage?: string; consultant_id?: string }
      | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (!assertClientAccess(req.user, existing.consultant_id)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const updatedAt = nowIso()
    db.prepare('UPDATE clients SET pipeline_stage = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.stageSlug,
      updatedAt,
      parsed.data.clientId,
    )
    db.prepare(
      `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
       VALUES (?, ?, 'status_change', ?, ?, ?)`,
    ).run(
      id('act'),
      parsed.data.clientId,
      `Pipeline: ${existing.pipeline_stage || 'novo'} → ${parsed.data.stageSlug}`,
      req.user?.id ?? null,
      updatedAt,
    )

    res.json({ ok: true, clientId: parsed.data.clientId, stageSlug: parsed.data.stageSlug })
  })

  router.get('/tasks', requirePermission('clients.view'), (req, res) => {
    const status = String(req.query.status || 'open')
    const rows = (
      status === 'all'
        ? db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
        : db
            .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC')
            .all(status)
    ) as Record<string, unknown>[]

    res.json(
      rows.map((t) => ({
        id: String(t.id),
        clientId: t.client_id ? String(t.client_id) : null,
        consultantId: t.consultant_id ? String(t.consultant_id) : null,
        assigneeUserId: t.assignee_user_id ? String(t.assignee_user_id) : null,
        title: String(t.title),
        description: t.description ? String(t.description) : null,
        status: String(t.status),
        priority: String(t.priority),
        dueAt: t.due_at ? String(t.due_at) : null,
        completedAt: t.completed_at ? String(t.completed_at) : null,
        createdAt: String(t.created_at),
        updatedAt: String(t.updated_at),
      })),
    )
  })

  router.post('/tasks', requirePermission('clients.edit'), (req, res) => {
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().nullable().optional(),
      clientId: z.string().nullable().optional(),
      consultantId: z.string().nullable().optional(),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      dueAt: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const taskId = id('task')
    const createdAt = nowIso()
    db.prepare(
      `INSERT INTO tasks (id, client_id, consultant_id, assignee_user_id, title, description, status, priority, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    ).run(
      taskId,
      parsed.data.clientId ?? null,
      parsed.data.consultantId ?? null,
      req.user?.id ?? null,
      parsed.data.title,
      parsed.data.description ?? null,
      parsed.data.priority,
      parsed.data.dueAt ?? null,
      createdAt,
      createdAt,
    )
    res.status(201).json({ id: taskId })
  })

  router.patch('/tasks/:id', requirePermission('clients.edit'), (req, res) => {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const status = req.body?.status ? String(req.body.status) : String(existing.status)
    const updatedAt = nowIso()
    db.prepare(
      `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
    ).run(status, status === 'done' ? updatedAt : null, updatedAt, req.params.id)
    res.json({ ok: true })
  })

  router.get('/notifications', requirePermission('dashboard.view'), (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id IS NULL OR user_id = ?
         ORDER BY created_at DESC LIMIT 50`,
      )
      .all(req.user!.id) as Record<string, unknown>[]
    res.json(
      rows.map((n) => ({
        id: String(n.id),
        type: String(n.type),
        title: String(n.title),
        body: n.body ? String(n.body) : null,
        href: n.href ? String(n.href) : null,
        readAt: n.read_at ? String(n.read_at) : null,
        createdAt: String(n.created_at),
      })),
    )
  })

  router.post('/notifications/:id/read', requirePermission('dashboard.view'), (req, res) => {
    const result = db
      .prepare(
        `UPDATE notifications SET read_at = ?
         WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
      )
      .run(nowIso(), req.params.id, req.user!.id)
    if (result.changes === 0) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ ok: true })
  })

  router.get('/search', requirePermission('dashboard.view'), (req, res) => {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase()
    if (!q) {
      res.json({ clients: [], consultants: [], courses: [] })
      return
    }
    const scope = consultantScopeId(req.user)
    const clients = (
      db.prepare('SELECT id, full_name, email, phone, consultant_id FROM clients').all() as Record<
        string,
        unknown
      >[]
    )
      .filter((c) => !scope || String(c.consultant_id || '') === scope)
      .filter((c) =>
        [c.full_name, c.email, c.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 8)
      .map((c) => ({
        id: String(c.id),
        label: String(c.full_name),
        meta: String(c.phone || c.email || ''),
        href: `/app/clientes/${c.id}`,
      }))

    const consultants = (
      db.prepare('SELECT id, name, email FROM consultants').all() as Record<string, unknown>[]
    )
      .filter((c) =>
        [c.name, c.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 5)
      .map((c) => ({
        id: String(c.id),
        label: String(c.name),
        meta: String(c.email || ''),
        href: `/app/consultores`,
      }))

    const courses = (
      db.prepare('SELECT id, name, category FROM courses').all() as Record<string, unknown>[]
    )
      .filter((c) => String(c.name).toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({
        id: String(c.id),
        label: String(c.name),
        meta: String(c.category),
        href: `/app/cursos/${c.id}`,
      }))

    res.json({ clients, consultants, courses })
  })

  return router
}
