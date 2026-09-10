import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertClientAccess, consultantScopeId, shouldScopeToConsultant } from '../lib/scope.js'
import type { AuthUser } from '../middleware/auth.js'

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 'u1',
    name: 'T',
    email: 't@t.com',
    role: 'comercial',
    status: 'active',
    permissions: [],
    consultantId: 'consultant-vanessa',
    authProvider: 'password',
    googleSub: null,
    picture: null,
    createdAt: '',
    updatedAt: '',
    lastLoginAt: null,
    ...partial,
  }
}

describe('Portfolio scope', () => {
  it('scopes comercial with consultantId', () => {
    const u = user({})
    assert.equal(shouldScopeToConsultant(u), true)
    assert.equal(consultantScopeId(u), 'consultant-vanessa')
    assert.equal(assertClientAccess(u, 'consultant-vanessa'), true)
    assert.equal(assertClientAccess(u, 'consultant-lucas'), false)
  })

  it('does not scope admin', () => {
    const u = user({ role: 'admin', consultantId: null })
    assert.equal(shouldScopeToConsultant(u), false)
    assert.equal(assertClientAccess(u, 'consultant-lucas'), true)
  })
})
