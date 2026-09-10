import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  mapSheetRow,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizePresence,
  normalizeStatus,
  DEFAULT_MAPPINGS,
} from '../services/googleSheets/normalizer.js'

describe('SheetNormalizer', () => {
  it('normalizes names, emails and phones', () => {
    assert.equal(normalizeName('  Ana   Clara  '), 'Ana Clara')
    assert.equal(normalizeEmail('  PEDRO@Email.COM '), 'pedro@email.com')
    assert.equal(normalizePhone('(49) 98888-0001').digits, '49988880001')
    assert.equal(normalizePhone('5549991112233').digits, '49991112233')
  })

  it('normalizes presence and status variants', () => {
    assert.equal(normalizePresence('Sim'), 'present')
    assert.equal(normalizePresence('não'), 'absent')
    assert.equal(normalizeStatus('Ativo'), 'active')
    assert.equal(normalizeStatus('Negociando'), 'negotiating')
  })

  it('flags incomplete required headers', () => {
    const mapped = mapSheetRow({ ID: '', Nome: '' }, 2, DEFAULT_MAPPINGS)
    assert.equal(mapped.incomplete, true)
    assert.ok(mapped.missingRequired.includes('ID'))
    assert.ok(mapped.missingRequired.includes('Nome'))
  })

  it('maps a valid row by header names (not column indexes)', () => {
    const mapped = mapSheetRow(
      {
        ID: 'EXT-9',
        Nome: 'Teste User',
        Telefone: '49988889999',
        WhatsApp: '',
        Email: 't@e.com',
        Consultor: 'Vanessa',
        Treinamento: 'CIS',
        Data: '15/09/2026',
        Presença: 'X',
        Status: 'Lead',
        Observações: 'ok',
      },
      3,
      DEFAULT_MAPPINGS,
    )
    assert.equal(mapped.incomplete, false)
    assert.equal(mapped.mapped.externalId, 'EXT-9')
    assert.equal(mapped.mapped.fullName, 'Teste User')
    assert.equal(mapped.mapped.presence, 'present')
    assert.equal(mapped.mapped.status, 'lead')
    assert.equal(mapped.mapped.eventDate, '2026-09-15')
  })
})
