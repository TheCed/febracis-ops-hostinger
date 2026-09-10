import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Origin/Referer check for cookie-authenticated mutations.
 * Complements CORS; rejects cross-site form posts that browsers still send with cookies.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) {
    next()
    return
  }

  const origin = req.get('origin')
  if (origin) {
    if (env.corsOrigins.includes(origin)) {
      next()
      return
    }
    res.status(403).json({ error: 'csrf_origin_blocked' })
    return
  }

  const referer = req.get('referer')
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (env.corsOrigins.includes(refOrigin)) {
        next()
        return
      }
    } catch {
      /* ignore parse errors */
    }
    res.status(403).json({ error: 'csrf_referer_blocked' })
    return
  }

  // Non-browser clients (curl/smoke) without Origin/Referer: allow in development only.
  if (!env.isProduction) {
    next()
    return
  }

  res.status(403).json({ error: 'csrf_missing_origin' })
}
