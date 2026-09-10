import { Router } from 'express'
import { db } from '../lib/db.js'
import { parseJson } from '../lib/utils.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export function reportsRoutes() {
  const router = Router()
  router.use(requireAuth, requirePermission('reports.view'))

  router.get('/summary', (req, res) => {
    const consultantId = String(req.query.consultantId || '')
    let clients = db.prepare('SELECT * FROM clients').all() as Record<string, unknown>[]
    if (consultantId) {
      clients = clients.filter((c) => String(c.consultant_id || '') === consultantId)
    }

    const byStatus: Record<string, number> = {}
    const byPresence: Record<string, number> = {}
    for (const c of clients) {
      byStatus[String(c.status)] = (byStatus[String(c.status)] || 0) + 1
      byPresence[String(c.presence)] = (byPresence[String(c.presence)] || 0) + 1
    }

    const enrollments = db.prepare('SELECT * FROM enrollments').all() as Record<string, unknown>[]
    const decisions = enrollments.filter((e) => e.decision).length
    const completed = enrollments.filter((e) => e.completed).length

    const tasksOpen = Number(
      (db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'open'`).get() as { c: number }).c,
    )

    res.json({
      clients: clients.length,
      byStatus,
      byPresence,
      enrollments: enrollments.length,
      decisions,
      completed,
      tasksOpen,
      generatedAt: new Date().toISOString(),
    })
  })

  router.get('/consultants', (_req, res) => {
    const consultants = db.prepare('SELECT * FROM consultants').all() as Record<string, unknown>[]
    const result = consultants.map((cons) => {
      const clients = db
        .prepare('SELECT * FROM clients WHERE consultant_id = ?')
        .all(cons.id) as Record<string, unknown>[]
      let decisions = 0
      for (const client of clients) {
        const enrCount = Number(
          (
            db
              .prepare('SELECT COUNT(*) as c FROM enrollments WHERE client_id = ? AND decision = 1')
              .get(client.id) as { c: number }
          ).c,
        )
        if (enrCount > 0) {
          decisions += enrCount
        } else {
          const courses = parseJson<Array<{ decision?: boolean }>>(
            String(client.courses_json || '[]'),
            [],
          )
          decisions += courses.filter((c) => c.decision).length
        }
      }
      return {
        id: String(cons.id),
        name: String(cons.name),
        clients: clients.length,
        present: clients.filter((c) => String(c.presence) === 'present').length,
        decisions,
        active: clients.filter((c) =>
          ['active', 'negotiating', 'won'].includes(String(c.status)),
        ).length,
      }
    })
    res.json(result)
  })

  return router
}
