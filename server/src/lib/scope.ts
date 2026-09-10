import type { AuthUser } from '../middleware/auth.js'

/** Non-admin users with a consultant portfolio only see their own clients. */
export function shouldScopeToConsultant(user: AuthUser | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return false
  return Boolean(user.consultantId)
}

export function consultantScopeId(user: AuthUser | undefined): string | null {
  return shouldScopeToConsultant(user) ? user!.consultantId : null
}

export function assertClientAccess(
  user: AuthUser | undefined,
  clientConsultantId: string | null | undefined,
): boolean {
  const scope = consultantScopeId(user)
  if (!scope) return true
  return String(clientConsultantId || '') === scope
}
