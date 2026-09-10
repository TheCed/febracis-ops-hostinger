/**
 * Manual WhatsApp click-to-chat (no mass send).
 * Brazilian numbers: DDD + country 55. Chapecó default DDD = 49 when missing.
 */

export const CHAPECO_DDD = '49'

export interface WhatsAppClickInput {
  phone?: string | null
  fullName?: string | null
  preferredName?: string | null
  turmaLabel?: string | null
  courseName?: string | null
  confirmationStatus?: string | null
  consultantName?: string | null
  unidade?: string | null
}

export interface WhatsAppClickResult {
  ok: boolean
  e164: string | null
  nationalDigits: string | null
  url: string | null
  message: string
  firstName: string
  reason?: string
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function firstNameFrom(fullName?: string | null, preferredName?: string | null): string {
  const preferred = (preferredName || '').trim()
  if (preferred) return preferred.split(/\s+/)[0] || preferred
  const full = (fullName || '').trim()
  if (!full) return 'olá'
  return full.split(/\s+/)[0] || full
}

/**
 * Normalize a Brazilian phone into digits with country code 55 (no +).
 * Accepts (49) 99999-0000, 049..., 5549..., 9-digit mobile without DDD.
 */
export function normalizeBrWhatsApp(
  raw?: string | null,
  defaultDdd = CHAPECO_DDD,
): { e164: string | null; nationalDigits: string | null; reason?: string } {
  if (!raw || !String(raw).trim()) {
    return { e164: null, nationalDigits: null, reason: 'missing_phone' }
  }
  let digits = onlyDigits(String(raw))
  while (digits.startsWith('0')) digits = digits.slice(1)

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const national = digits.slice(2)
    return { e164: digits, nationalDigits: national }
  }
  if (digits.startsWith('55') && digits.length > 13) {
    const rest = digits.slice(2)
    if (rest.length === 10 || rest.length === 11) {
      return { e164: `55${rest}`, nationalDigits: rest }
    }
  }
  if (digits.length === 10 || digits.length === 11) {
    return { e164: `55${digits}`, nationalDigits: digits }
  }
  if (digits.length === 8 || digits.length === 9) {
    const national = `${defaultDdd}${digits}`
    return { e164: `55${national}`, nationalDigits: national }
  }
  return { e164: null, nationalDigits: null, reason: 'invalid_phone' }
}

export function buildConfirmacaoMessage(input: WhatsAppClickInput): string {
  const first = firstNameFrom(input.fullName, input.preferredName)
  const turma = (input.turmaLabel || input.courseName || 'turma FEBRACIS Chapecó').trim()
  const course =
    input.courseName && input.turmaLabel && input.courseName !== input.turmaLabel
      ? input.courseName.trim()
      : ''
  const conf = (input.confirmationStatus || '').trim()
  const unidade = (input.unidade || 'Chapecó').trim()

  const lines = [
    `Olá, ${first}! Aqui é da FEBRACIS ${unidade}.`,
    '',
    course
      ? `Estou falando sobre a turma ${turma} (${course}).`
      : `Estou falando sobre a turma ${turma}.`,
    'Gostaria de confirmar sua participação.',
  ]
  if (conf && !/^confirm/i.test(conf)) {
    lines.push(`No sistema sua situação aparece como: ${conf}.`)
  }
  lines.push('', 'Pode me retornar por aqui, por favor?')
  return lines.join('\n')
}

export function buildWhatsAppClick(input: WhatsAppClickInput): WhatsAppClickResult {
  const first = firstNameFrom(input.fullName, input.preferredName)
  const message = buildConfirmacaoMessage(input)
  const phone = normalizeBrWhatsApp(input.phone)
  if (!phone.e164) {
    return {
      ok: false,
      e164: null,
      nationalDigits: null,
      url: null,
      message,
      firstName: first,
      reason: phone.reason,
    }
  }
  const url = `https://wa.me/${phone.e164}?text=${encodeURIComponent(message)}`
  return {
    ok: true,
    e164: phone.e164,
    nationalDigits: phone.nationalDigits,
    url,
    message,
    firstName: first,
  }
}
