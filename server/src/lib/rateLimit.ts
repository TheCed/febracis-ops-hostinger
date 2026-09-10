/** Simple in-memory rate limiter for auth endpoints (per IP). */
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(opts: {
  key: string
  limit: number
  windowMs: number
}): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const current = hits.get(opts.key)
  if (!current || current.resetAt <= now) {
    hits.set(opts.key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (current.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) }
  }
  current.count += 1
  return { ok: true, retryAfterSec: 0 }
}
