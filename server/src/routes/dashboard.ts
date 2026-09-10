import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import { db } from '../lib/db.js'
import { parseJson } from '../lib/utils.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export function dashboardRoutes(): Router {
  const router = createRouter()
  router.use(requireAuth, requirePermission('dashboard.view'))

  router.get('/summary', (_req: Request, res: Response) => {
    const clients = db.prepare('SELECT * FROM clients').all() as Record<string, unknown>[]
    const consultants = db
      .prepare('SELECT id, name FROM consultants WHERE active = 1')
      .all() as Array<{ id: string; name: string }>

    const total = clients.length
    const active = clients.filter((c) =>
      ['active', 'negotiating', 'won'].includes(String(c.status)),
    ).length
    const present = clients.filter((c) => String(c.presence) === 'present').length

    let decisions = 0
    let completed = 0
    let clientsWithDecision = 0
    for (const client of clients) {
      const courses = parseJson<Array<{ completed?: boolean; decision?: boolean }>>(
        String(client.courses_json),
        [],
      )
      const clientDecisions = courses.filter((c) => c.decision).length
      decisions += clientDecisions
      completed += courses.filter((c) => c.completed).length
      if (clientDecisions > 0) clientsWithDecision += 1
    }

    const byConsultant = consultants.map((consultant) => {
      const bag = clients.filter((c) => String(c.consultant_id) === consultant.id)
      return {
        consultantId: consultant.id,
        name: consultant.name,
        clients: bag.length,
        present: bag.filter((c) => String(c.presence) === 'present').length,
      }
    })

    const recentActivity = (
      db
        .prepare(
          `SELECT a.id, a.type, a.message, a.created_at, c.full_name as client_name, c.id as client_id
           FROM client_activity a
           JOIN clients c ON c.id = a.client_id
           ORDER BY a.created_at DESC
           LIMIT 12`,
        )
        .all() as Record<string, unknown>[]
    ).map((row) => ({
      id: String(row.id),
      type: String(row.type),
      message: String(row.message),
      createdAt: String(row.created_at),
      clientId: String(row.client_id),
      clientName: String(row.client_name),
    }))

    const coursesCatalog = Number(
      (db.prepare(`SELECT COUNT(*) as c FROM courses`).get() as { c: number }).c,
    )

    res.json({
      clientsTotal: total,
      clientsActive: active,
      presenceRate: total ? Math.round((present / total) * 100) : 0,
      decisions,
      completedCourses: completed,
      conversionRate: present ? Math.round((clientsWithDecision / present) * 100) : 0,
      coursesCatalog,
      byConsultant,
      recentActivity,
    })
  })

  return router
}
