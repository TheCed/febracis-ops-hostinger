import { randomBytes } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../lib/db.js'
import { parseJson } from '../lib/utils.js'
import type { Permission } from '../lib/permissions.js'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  permissions: Permission[]
  consultantId: string | null
  authProvider: string
  googleSub: string | null
  picture: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      sessionToken?: string
    }
  }
}

const COOKIE = 'febracis_session'

export function sessionCookieName() {
  return COOKIE
}

export function mapUserRow(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    status: String(row.status),
    permissions: parseJson<Permission[]>(String(row.permissions_json), []),
    consultantId: row.consultant_id ? String(row.consultant_id) : null,
    authProvider: String(row.auth_provider || 'password'),
    googleSub: row.google_sub ? String(row.google_sub) : null,
    picture: row.picture ? String(row.picture) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  }
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
    consultantId: user.consultantId,
    authProvider: user.authProvider,
    googleSub: user.googleSub,
    picture: user.picture,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE] as string | undefined
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const session = db
    .prepare(
      `SELECT s.token, s.expires_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as Record<string, unknown> | undefined

  if (!session) {
    res.clearCookie(COOKIE)
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  if (String(session.expires_at) < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    res.clearCookie(COOKIE)
    res.status(401).json({ error: 'session_expired' })
    return
  }

  if (String(session.status) !== 'active') {
    res.status(403).json({ error: 'user_disabled', status: String(session.status) })
    return
  }

  req.sessionToken = token
  req.user = mapUserRow(session)
  next()
}

export function requirePermission(...needed: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    const ok = needed.every((p) => req.user!.permissions.includes(p))
    if (!ok) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}

export function requireAnyPermission(...needed: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    const ok = needed.some((p) => req.user!.permissions.includes(p))
    if (!ok) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}

export function writeAudit(
  action: string,
  opts: { userId?: string | null; meta?: unknown; ip?: string | null } = {},
) {
  db.prepare(
    `INSERT INTO audit_events (id, user_id, action, meta_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    opts.userId ?? null,
    action,
    opts.meta ? JSON.stringify(opts.meta) : null,
    opts.ip ?? null,
    new Date().toISOString(),
  )
}

import { env } from '../config/env.js'

export function issueSession(res: Response, userId: string) {
  // Invalidate previous sessions to reduce session fixation risk on login.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  const token = randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).run(token, userId, expiresAt, createdAt)
  db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
    createdAt,
    createdAt,
    userId,
  )
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 14 * 86400000,
    path: '/',
  })
  return { token, expiresAt, createdAt }
}
