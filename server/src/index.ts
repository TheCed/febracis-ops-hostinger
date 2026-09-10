import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import { migrate } from './lib/db.js'
import { runOpsMigrations } from './lib/migrations/opsMigrations.js'
import { seedIfEmpty, seedCatalogIfEmpty } from './seed.js'
import { env } from './config/env.js'
import { requireSameOrigin } from './middleware/csrf.js'
import { authRoutes, usersRoutes } from './routes/auth.js'
import { clientsRoutes } from './routes/clients.js'
import { consultantsRoutes } from './routes/consultants.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { googleSheetsRoutes } from './routes/googleSheets.js'
import { coursesRoutes } from './routes/courses.js'
import { crmExtraRoutes } from './routes/crmExtra.js'
import { fichaRoutes, ensureLegacyCourses } from './routes/ficha.js'
import { reportsRoutes } from './routes/reports.js'
import { opsRoutes } from './routes/ops.js'
import { ensureDemoOpenTurmas } from './services/ops/courseResolve.js'
import { computeTurmaHealth } from './services/ops/turmaHealth.js'
import { syncTurmaAlert } from './services/ops/turmaAlerts.js'
import { db } from './lib/db.js'
import { nowIso } from './lib/utils.js'
import { webDistDir } from './lib/paths.js'

const webDist = webDistDir()

migrate()
runOpsMigrations()
seedIfEmpty()
seedCatalogIfEmpty()
ensureLegacyCourses()
if (!env.isProduction) {
  ensureDemoOpenTurmas()
  refreshDemoTurmaHealth()
}

function refreshDemoTurmaHealth() {
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
}

const app = express()
const PORT = env.port

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      if (env.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('CORS blocked'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/api', requireSameOrigin)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'febracis-ops',
    version: '2.1.0',
    product: 'FEBRACIS OPS',
    googleAuth: env.googleAuth.enabled,
    googleSheets: env.googleSheets.enabled,
    spa: fs.existsSync(webDist),
  })
})

app.use('/api/auth', authRoutes())
app.use('/api/users', usersRoutes())
app.use('/api/clients', clientsRoutes())
app.use('/api/consultants', consultantsRoutes())
app.use('/api/dashboard', dashboardRoutes())
app.use('/api/google-sheets', googleSheetsRoutes())
app.use('/api/courses', coursesRoutes())
app.use('/api/crm', crmExtraRoutes())
app.use('/api/ficha', fichaRoutes())
app.use('/api/reports', reportsRoutes())
app.use('/api/ops', opsRoutes())

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  if (err && typeof err === 'object' && 'message' in err && String((err as Error).message).includes('CORS')) {
    res.status(403).json({ error: 'cors_blocked' })
    return
  }
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: 'invalid_json' })
    return
  }
  res.status(500).json({
    error: 'internal_error',
    ...(env.isProduction ? {} : { detail: err instanceof Error ? err.message : 'unknown' }),
  })
})

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: env.isProduction ? '1h' : 0 }))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>FEBRACIS OPS API</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">
  <h1>FEBRACIS OPS API</h1>
  <p>SPA não encontrada (<code>web/dist</code>). Em Hostinger o ZIP já inclui o build.</p>
  <p>Health: <a href="/api/health">/api/health</a></p>
</body></html>`)
  })
}

// Hostinger LSNode injects PORT; do not hardcode host binding.
app.listen(PORT, () => {
  console.log(`FEBRACIS OPS listening on port ${PORT}`)
  console.log(`SPA: ${fs.existsSync(webDist) ? webDist : 'missing'}`)
})
