import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso, parseJson } from '../lib/utils.js'
import { requireAuth, requirePermission, writeAudit } from '../middleware/auth.js'

function mapConsultant(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    active: Boolean(row.active),
    userId: row.user_id ? String(row.user_id) : null,
    goals: parseJson(String(row.goals_json), {
      clientsTarget: null,
      presenceTarget: null,
      decisionsTarget: null,
      revenueTarget: null,
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function statsFor(consultantId: string) {
  const clients = db
    .prepare('SELECT * FROM clients WHERE consultant_id = ?')
    .all(consultantId) as Record<string, unknown>[]

  let present = 0
  let decisions = 0
  let coursesSold = 0
  let active = 0

  for (const client of clients) {
    if (['active', 'negotiating', 'won'].includes(String(client.status))) active += 1
    if (String(client.presence) === 'present') present += 1
    const courses = parseJson<Array<{ completed?: boolean; decision?: boolean }>>(
      String(client.courses_json),
      [],
    )
    decisions += courses.filter((c) => c.decision).length
    coursesSold += courses.filter((c) => c.completed || c.decision).length
  }

  const total = clients.length
  return {
    consultantId,
    clientsTotal: total,
    clientsActive: active,
    presenceRate: total ? Math.round((present / total) * 100) : 0,
    decisions,
    conversions: decisions,
    coursesSold,
  }
}

export function consultantsRoutes(): Router {
  const router = createRouter()
  router.use(requireAuth)

  router.get('/', requirePermission('consultants.view'), (_req: Request, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM consultants ORDER BY name COLLATE NOCASE')
      .all() as Record<string, unknown>[]

    res.json(
      rows.map((row) => ({
        ...mapConsultant(row),
        stats: statsFor(String(row.id)),
      })),
    )
  })

  router.get('/:id', requirePermission('consultants.view'), (req: Request, res: Response) => {
    const row = db
      .prepare('SELECT * FROM consultants WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const clients = (
      db
        .prepare('SELECT * FROM clients WHERE consultant_id = ? ORDER BY full_name COLLATE NOCASE')
        .all(req.params.id) as Record<string, unknown>[]
    ).map((c) => ({
      id: String(c.id),
      fullName: String(c.full_name),
      preferredName: c.preferred_name ? String(c.preferred_name) : null,
      status: String(c.status),
      presence: String(c.presence),
      phone: c.phone ? String(c.phone) : null,
      updatedAt: String(c.updated_at),
    }))

    res.json({
      ...mapConsultant(row),
      stats: statsFor(String(row.id)),
      clients,
    })
  })

  router.post('/', requirePermission('consultants.edit'), (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email().nullable().optional().or(z.literal('')),
      phone: z.string().nullable().optional(),
      active: z.boolean().default(true),
      goals: z
        .object({
          clientsTarget: z.number().nullable().optional(),
          presenceTarget: z.number().nullable().optional(),
          decisionsTarget: z.number().nullable().optional(),
          revenueTarget: z.number().nullable().optional(),
        })
        .optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }

    const consultantId = id('consultant')
    const createdAt = nowIso()
    db.prepare(
      `INSERT INTO consultants (id, name, email, phone, active, user_id, goals_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).run(
      consultantId,
      parsed.data.name.trim(),
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.active ? 1 : 0,
      JSON.stringify(
        parsed.data.goals ?? {
          clientsTarget: 30,
          presenceTarget: 80,
          decisionsTarget: 20,
          revenueTarget: null,
        },
      ),
      createdAt,
      createdAt,
    )

    writeAudit('consultants.create', {
      userId: req.user?.id,
      meta: { consultantId },
      ip: req.ip,
    })

    const row = db
      .prepare('SELECT * FROM consultants WHERE id = ?')
      .get(consultantId) as Record<string, unknown>
    res.status(201).json({ ...mapConsultant(row), stats: statsFor(consultantId) })
  })

  return router
}
