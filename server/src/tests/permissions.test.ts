import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ROLE_PERMISSIONS } from '../lib/permissions.js'

describe('Authorization matrix', () => {
  it('comercial cannot manage users or sheets sync', () => {
    const perms = ROLE_PERMISSIONS.comercial
    assert.equal(perms.includes('users.view'), false)
    assert.equal(perms.includes('users.edit'), false)
    assert.equal(perms.includes('sheets.sync'), false)
    assert.equal(perms.includes('settings.edit'), false)
  })

  it('admin has sensitive permissions', () => {
    const perms = ROLE_PERMISSIONS.admin
    assert.ok(perms.includes('users.edit'))
    assert.ok(perms.includes('sheets.sync'))
    assert.ok(perms.includes('settings.edit'))
  })

  it('viewer is read-mostly', () => {
    const perms = ROLE_PERMISSIONS.viewer
    assert.ok(perms.includes('clients.view'))
    assert.equal(perms.includes('clients.edit'), false)
    assert.equal(perms.includes('users.edit'), false)
  })
})
