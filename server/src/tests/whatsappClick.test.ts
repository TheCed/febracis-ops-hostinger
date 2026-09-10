import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildConfirmacaoMessage,
  buildWhatsAppClick,
  firstNameFrom,
  normalizeBrWhatsApp,
} from '../services/ops/whatsappClick.js'
import { CONTACT_STATUS_PRIORITY, normalizeContactStatus } from '../services/ops/contactStatus.js'

describe('whatsappClick', () => {
  it('normalizes Brazilian mobiles with DDD and +55', () => {
    assert.equal(normalizeBrWhatsApp('(49) 99999-0001').e164, '5549999990001')
    assert.equal(normalizeBrWhatsApp('5549991112233').e164, '5549991112233')
    assert.equal(normalizeBrWhatsApp('049988881111').e164, '5549988881111')
    assert.equal(normalizeBrWhatsApp('4933334444').e164, '554933334444')
  })

  it('assumes Chapecó DDD 49 when only local digits exist', () => {
    assert.equal(normalizeBrWhatsApp('999990001').e164, '5549999990001')
    assert.equal(normalizeBrWhatsApp('33334444').e164, '554933334444')
  })

  it('rejects empty or too-short numbers', () => {
    assert.equal(normalizeBrWhatsApp('').e164, null)
    assert.equal(normalizeBrWhatsApp('123').e164, null)
    assert.equal(normalizeBrWhatsApp(null).reason, 'missing_phone')
  })

  it('builds wa.me URL with personalized message and never auto-sends', () => {
    const result = buildWhatsAppClick({
      phone: '49 99999-0001',
      fullName: 'Maria Souza',
      turmaLabel: 'CEOP 06',
      courseName: 'CEOP',
      confirmationStatus: 'Aguardando',
    })
    assert.equal(result.ok, true)
    assert.ok(result.url?.startsWith('https://wa.me/5549999990001?text='))
    assert.match(result.message, /Maria/)
    assert.match(result.message, /CEOP 06/)
    assert.match(result.message, /Aguardando/)
    assert.equal(result.url?.includes('text='), true)
  })

  it('uses preferred name and omits confirmation line when already confirmed', () => {
    const msg = buildConfirmacaoMessage({
      fullName: 'Ana Clara Santos',
      preferredName: 'Aninha',
      turmaLabel: 'IF 08',
      confirmationStatus: 'Confirmado',
    })
    assert.match(msg, /Aninha/)
    assert.doesNotMatch(msg, /Confirmado/)
  })

  it('extracts first name', () => {
    assert.equal(firstNameFrom('João Lima'), 'João')
    assert.equal(firstNameFrom('João Lima', 'Joca'), 'Joca')
  })
})

describe('contactStatus', () => {
  it('defaults unknown values to nao_contatado', () => {
    assert.equal(normalizeContactStatus(''), 'nao_contatado')
    assert.equal(normalizeContactStatus('xyz'), 'nao_contatado')
    assert.equal(normalizeContactStatus('interessado'), 'interessado')
  })

  it('prioritizes unworked people first', () => {
    assert.ok(CONTACT_STATUS_PRIORITY.nao_contatado < CONTACT_STATUS_PRIORITY.contatado)
    assert.ok(CONTACT_STATUS_PRIORITY.sem_resposta < CONTACT_STATUS_PRIORITY.finalizado)
  })
})
