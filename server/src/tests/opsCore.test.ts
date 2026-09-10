import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectSchema, mapRowValues } from '../services/ops/schemaDetector.js'
import { computeTurmaHealth } from '../services/ops/turmaHealth.js'
import {
  evaluateEligibility,
  DEFAULT_ELIGIBILITY_CONFIG,
} from '../services/ops/potentialEligibility.js'

describe('schemaDetector', () => {
  it('detects ALUNO / CPF / E-MAIL generation', () => {
    const d = detectSchema(['ALUNO', 'CPF', 'TELEFONE', 'E-MAIL', 'CONFIRMAÇÃO', 'PRESENÇA'])
    assert.ok(d.knownFields.includes('personName'))
    assert.ok(d.knownFields.includes('cpf'))
    assert.ok(d.knownFields.includes('email'))
    assert.ok(d.confidence >= 0.8)
  })

  it('detects CLIENTES / CPF/CNPJ / Status Vaga generation', () => {
    const d = detectSchema(['CLIENTES', 'CPF/CNPJ', 'WhatsApp', 'Status Vaga', '1º CONTATO'])
    assert.equal(d.mapping['CLIENTES'], 'personName')
    assert.equal(d.mapping['CPF/CNPJ'], 'cpf')
    assert.equal(d.mapping['Status Vaga'], 'confirmationStatus')
  })

  it('maps row values by detected schema', () => {
    const headers = ['Nome', 'Documento', 'Status']
    const d = detectSchema(headers)
    const mapped = mapRowValues(headers, ['Ana', '123', 'Confirmado'], d)
    assert.equal(mapped.personName, 'Ana')
    assert.equal(mapped.cpf, '123')
    assert.equal(mapped.confirmationStatus, 'Confirmado')
  })
})

describe('turmaHealth', () => {
  const baseNow = new Date('2026-09-10T12:00:00')

  it('marks DEFINIR_META when meta missing', () => {
    const h = computeTurmaHealth({
      startDate: '2026-09-20',
      metaMinima: null,
      matriculados: 10,
      confirmados: 8,
      now: baseNow,
    })
    assert.equal(h.prioridade, 'DEFINIR_META')
  })

  it('marks CRITICA when ≤7 days and low meta occupancy', () => {
    const h = computeTurmaHealth({
      startDate: '2026-09-15',
      metaMinima: 50,
      matriculados: 20,
      confirmados: 20,
      now: baseNow,
    })
    assert.equal(h.prioridade, 'CRITICA')
    assert.ok((h.ocupacaoMeta ?? 0) < 60)
    assert.equal(h.faltaMetaMinima, 30)
    assert.ok((h.ritmoNecessarioDia ?? 0) > 0)
  })

  it('marks META_ATINGIDA when confirmados >= meta', () => {
    const h = computeTurmaHealth({
      startDate: '2026-09-20',
      metaMinima: 50,
      confirmados: 50,
      matriculados: 52,
      now: baseNow,
    })
    assert.equal(h.prioridade, 'META_ATINGIDA')
  })

  it('computes forecast when velocity provided', () => {
    const h = computeTurmaHealth({
      startDate: '2026-09-20',
      metaMinima: 50,
      confirmados: 20,
      matriculados: 22,
      ritmo7d: 1.5,
      now: baseNow,
    })
    assert.ok(h.forecastConfirmados != null)
    assert.ok(h.desvioForecastMeta != null)
  })
})

describe('potentialEligibility', () => {
  it('blocks people who already completed the target course', () => {
    const r = evaluateEligibility(
      {
        personId: 'p1',
        fullName: 'Test',
        consultantName: null,
        grade: null,
        completedCourseIds: ['ceop'],
        enrolledCourseIds: [],
        lastTurmaLabel: 'CEOP 05',
      },
      'ceop',
    )
    assert.equal(r.eligible, false)
  })

  it('allows historical people without the target course', () => {
    const r = evaluateEligibility(
      {
        personId: 'p2',
        fullName: 'Test',
        consultantName: 'Vanessa',
        grade: 'Green',
        completedCourseIds: ['if'],
        enrolledCourseIds: [],
        lastTurmaLabel: 'IF 08',
      },
      'ceop',
      DEFAULT_ELIGIBILITY_CONFIG,
    )
    assert.equal(r.eligible, true)
  })
})
