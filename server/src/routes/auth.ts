import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { id, nowIso } from '../lib/utils.js'
import {
  issueSession,
  mapUserRow,
  publicUser,
  requireAuth,
  requirePermission,
  sessionCookieName,
  writeAudit,
} from '../middleware/auth.js'
import { ROLE_PERMISSIONS } from '../lib/permissions.js'
import { googleAuthPublicConfig, verifyGoogleIdToken } from '../services/googleAuth/verify.js'
import { env } from '../config/env.js'
import { rateLimit } from '../lib/rateLimit.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function statusError(status: string) {
  if (status === 'pending') return 'pending_approval'
  if (status === 'rejected') return 'rejected'
  return 'user_disabled'
}

export function authRoutes(): Router {
  const router = createRouter()

  router.get('/google/config', (_req, res) => {
    res.json(googleAuthPublicConfig())
  })

  router.post('/login', (req: Request, res: Response) => {
    const limited = rateLimit({
      key: `login:${req.ip || 'unknown'}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    })
    if (!limited.ok) {
      res.status(429).json({ error: 'rate_limited', retryAfterSec: limited.retryAfterSec })
      return
    }

    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }

    const email = parsed.data.email.trim().toLowerCase()
    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as Record<string, unknown> | undefined

    const hash = row ? String(row.password_hash || '') : ''
    if (!row || !hash || !bcrypt.compareSync(parsed.data.password, hash)) {
      writeAudit('auth.login_failed', { meta: { email }, ip: req.ip })
      res.status(401).json({ error: 'invalid_credentials' })
      return
    }

    if (String(row.status) !== 'active') {
      res.status(403).json({ error: statusError(String(row.status)), status: String(row.status) })
      return
    }

    const session = issueSession(res, String(row.id))
    const user = mapUserRow({
      ...row,
      last_login_at: session.createdAt,
      updated_at: session.createdAt,
    })
    writeAudit('auth.login', { userId: user.id, ip: req.ip })
    res.json({ token: 'cookie', expiresAt: session.expiresAt, user: publicUser(user) })
  })

  router.post('/google', async (req: Request, res: Response) => {
    const limited = rateLimit({
      key: `google:${req.ip || 'unknown'}`,
      limit: 30,
      windowMs: 15 * 60 * 1000,
    })
    if (!limited.ok) {
      res.status(429).json({ error: 'rate_limited', retryAfterSec: limited.retryAfterSec })
      return
    }

    const credential = String(req.body?.credential || '')
    if (!credential) {
      res.status(400).json({ error: 'missing_credential' })
      return
    }

    try {
      const identity = await verifyGoogleIdToken(credential)
      const bySub = db
        .prepare('SELECT * FROM users WHERE google_sub = ?')
        .get(identity.sub) as Record<string, unknown> | undefined

      if (bySub) {
        if (String(bySub.status) !== 'active') {
          res
            .status(403)
            .json({ error: statusError(String(bySub.status)), status: String(bySub.status) })
          return
        }
        const session = issueSession(res, String(bySub.id))
        const user = mapUserRow({
          ...bySub,
          last_login_at: session.createdAt,
          updated_at: session.createdAt,
        })
        writeAudit('auth.google_login', { userId: user.id, ip: req.ip })
        res.json({
          token: 'cookie',
          expiresAt: session.expiresAt,
          user: publicUser(user),
          outcome: 'login',
        })
        return
      }

      const byEmail = db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(identity.email) as Record<string, unknown> | undefined

      if (byEmail) {
        if (String(byEmail.status) !== 'active') {
          res
            .status(403)
            .json({ error: statusError(String(byEmail.status)), status: String(byEmail.status) })
          return
        }
        const provider = String(byEmail.auth_provider || 'password')
        const nextProvider = provider === 'password' ? 'both' : provider === 'google' ? 'google' : 'both'
        db.prepare(
          `UPDATE users SET google_sub = ?, picture = ?, auth_provider = ?, updated_at = ? WHERE id = ?`,
        ).run(identity.sub, identity.picture || null, nextProvider, nowIso(), byEmail.id)

        const session = issueSession(res, String(byEmail.id))
        const refreshed = db
          .prepare('SELECT * FROM users WHERE id = ?')
          .get(byEmail.id) as Record<string, unknown>
        writeAudit('auth.google_link', { userId: String(byEmail.id), ip: req.ip })
        res.json({
          token: 'cookie',
          expiresAt: session.expiresAt,
          user: publicUser(mapUserRow(refreshed)),
          outcome: 'linked',
        })
        return
      }

      const userId = id('user')
      const createdAt = nowIso()
      db.prepare(
        `INSERT INTO users
          (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at, google_sub, picture, auth_provider)
         VALUES (?, ?, ?, 'comercial', 'pending', '', ?, NULL, ?, ?, ?, ?, 'google')`,
      ).run(
        userId,
        identity.name,
        identity.email,
        JSON.stringify(ROLE_PERMISSIONS.comercial),
        createdAt,
        createdAt,
        identity.sub,
        identity.picture || null,
      )

      writeAudit('auth.google_register_pending', {
        userId,
        meta: { email: identity.email },
        ip: req.ip,
      })

      db.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, href, created_at)
         SELECT ?, id, 'user_pending', 'Nova solicitação Google', ?, '/app/configuracoes?tab=users', ?
         FROM users WHERE role = 'admin' AND status = 'active'`,
      ).run(id('notif'), `${identity.name} (${identity.email}) solicitou acesso.`, createdAt)

      res.status(202).json({
        outcome: 'pending',
        message: 'Solicitação enviada. Aguarde a aprovação de um administrador.',
      })
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : 'google_auth_failed'
      writeAudit('auth.google_failed', { meta: { code }, ip: req.ip })
      res.status(401).json({ error: code })
    }
  })

  router.post('/logout', requireAuth, (req: Request, res: Response) => {
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken)
    }
    writeAudit('auth.logout', { userId: req.user?.id, ip: req.ip })
    res.clearCookie(sessionCookieName(), { path: '/' })
    res.json({ ok: true })
  })

  router.get('/me', requireAuth, (req: Request, res: Response) => {
    res.json(publicUser(req.user!))
  })

  return router
}

export function usersRoutes(): Router {
  const router = createRouter()
  router.use(requireAuth)

  router.get('/', requirePermission('users.view'), (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all() as Record<string, unknown>[]
    res.json(rows.map((row) => publicUser(mapUserRow(row))))
  })

  router.post('/', requirePermission('users.edit'), (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['admin', 'comercial', 'layout', 'viewer']),
      consultantId: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }

    const email = parsed.data.email.trim().toLowerCase()
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      res.status(409).json({ error: 'exists' })
      return
    }

    const createdAt = nowIso()
    const userId = id('user')
    db.prepare(
      `INSERT INTO users
        (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at, auth_provider)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 'password')`,
    ).run(
      userId,
      parsed.data.name.trim(),
      email,
      parsed.data.role,
      bcrypt.hashSync(parsed.data.password, 12),
      JSON.stringify(ROLE_PERMISSIONS[parsed.data.role]),
      parsed.data.consultantId ?? null,
      createdAt,
      createdAt,
    )
    writeAudit('users.create', { userId: req.user?.id, meta: { createdUserId: userId }, ip: req.ip })
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>
    res.status(201).json(publicUser(mapUserRow(row)))
  })

  router.post('/:id/approve', requirePermission('users.edit'), (req, res) => {
    const schema = z.object({
      role: z.enum(['admin', 'comercial', 'layout', 'viewer']).optional(),
      consultantId: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body || {})
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const role = parsed.data.role || String(row.role)
    db.prepare(
      `UPDATE users SET status = 'active', role = ?, permissions_json = ?, consultant_id = COALESCE(?, consultant_id), updated_at = ? WHERE id = ?`,
    ).run(
      role,
      JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.comercial),
      parsed.data.consultantId ?? null,
      nowIso(),
      req.params.id,
    )
    writeAudit('users.approve', { userId: req.user?.id, meta: { target: req.params.id }, ip: req.ip })
    const refreshed = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.params.id) as Record<string, unknown>
    res.json(publicUser(mapUserRow(refreshed)))
  })

  router.post('/:id/reject', requirePermission('users.edit'), (req, res) => {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    db.prepare(`UPDATE users SET status = 'rejected', updated_at = ? WHERE id = ?`).run(
      nowIso(),
      req.params.id,
    )
    writeAudit('users.reject', { userId: req.user?.id, meta: { target: req.params.id }, ip: req.ip })
    res.json({ ok: true })
  })

  router.patch('/:id', requirePermission('users.edit'), (req, res) => {
    const schema = z.object({
      status: z.enum(['active', 'pending', 'disabled', 'rejected']).optional(),
      role: z.enum(['admin', 'comercial', 'layout', 'viewer']).optional(),
      consultantId: z.string().nullable().optional(),
      name: z.string().min(2).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' })
      return
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined
    if (!row) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const role = parsed.data.role || String(row.role)
    db.prepare(
      `UPDATE users SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        role = ?,
        permissions_json = ?,
        consultant_id = COALESCE(?, consultant_id),
        updated_at = ?
       WHERE id = ?`,
    ).run(
      parsed.data.name ?? null,
      parsed.data.status ?? null,
      role,
      JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer),
      parsed.data.consultantId === undefined ? null : parsed.data.consultantId,
      nowIso(),
      req.params.id,
    )
    const refreshed = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(req.params.id) as Record<string, unknown>
    res.json(publicUser(mapUserRow(refreshed)))
  })

  return router
}

export function authEnvHint() {
  return { googleAuthEnabled: env.googleAuth.enabled }
}
