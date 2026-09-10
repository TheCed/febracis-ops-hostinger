import { buildWhatsAppClick } from './whatsappClick.js'
import { CONTACT_STATUS_LABEL, CONTACT_STATUS_PRIORITY, normalizeContactStatus } from './contactStatus.js'

export interface ConfirmacaoItem {
  enrollmentId: string
  personId: string
  fullName: string
  preferredName: string | null
  firstName: string
  phone: string | null
  email: string | null
  consultantName: string | null
  confirmationStatus: string
  contactStatus: string
  contactStatusLabel: string
  contactPriority: number
  lastContactedAt: string | null
  present: boolean
  grade: string | null
  financialStatus: string | null
  sourceSheet: string | null
  sourceRow: number | null
  turmaId: string | null
  courseName: string | null
  turmaLabel: string | null
  startDate: string | null
  turmaStatus: string | null
  whatsappE164: string | null
  whatsappUrl: string | null
  whatsappMessage: string
  phoneValid: boolean
}

export function mapConfirmacaoRow(p: Record<string, unknown>): ConfirmacaoItem {
  const fullName = String(p.full_name || '')
  const preferredName = p.preferred_name ? String(p.preferred_name) : null
  const phoneRaw = String(p.whatsapp || p.phone || p.phone_normalized || '')
  const turmaLabel = p.turma_label ? String(p.turma_label) : null
  const courseName = p.course_name ? String(p.course_name) : null
  const confirmationStatus = String(p.confirmation_status || p.status || '')
  const wa = buildWhatsAppClick({
    phone: phoneRaw,
    fullName,
    preferredName,
    turmaLabel,
    courseName,
    confirmationStatus,
    consultantName: p.consultant_name ? String(p.consultant_name) : null,
  })
  const contactStatus = normalizeContactStatus(p.contact_status ? String(p.contact_status) : null)

  return {
    enrollmentId: String(p.id),
    personId: String(p.client_id),
    fullName,
    preferredName,
    firstName: wa.firstName,
    phone: p.phone ? String(p.phone) : phoneRaw || null,
    email: p.email ? String(p.email) : null,
    consultantName: p.consultant_name ? String(p.consultant_name) : null,
    confirmationStatus,
    contactStatus,
    contactStatusLabel: CONTACT_STATUS_LABEL[contactStatus],
    contactPriority: CONTACT_STATUS_PRIORITY[contactStatus],
    lastContactedAt: p.last_contacted_at ? String(p.last_contacted_at) : null,
    present: Boolean(p.present),
    grade: p.grade_label ? String(p.grade_label) : null,
    financialStatus: p.financial_status ? String(p.financial_status) : null,
    sourceSheet: p.source_sheet ? String(p.source_sheet) : null,
    sourceRow: p.source_row != null ? Number(p.source_row) : null,
    turmaId: p.turma_id ? String(p.turma_id) : p.training_class_id ? String(p.training_class_id) : null,
    courseName,
    turmaLabel,
    startDate: p.start_date ? String(p.start_date) : null,
    turmaStatus: p.turma_status ? String(p.turma_status) : null,
    whatsappE164: wa.e164,
    whatsappUrl: wa.url,
    whatsappMessage: wa.message,
    phoneValid: wa.ok,
  }
}

export const CONFIRMACAO_SELECT = `
  e.id, e.client_id, e.confirmation_status, e.status, e.present, e.grade_label,
  e.financial_status, e.source_sheet, e.source_row, e.training_class_id,
  e.contact_status, e.last_contacted_at,
  c.full_name, c.preferred_name, c.phone, c.phone_normalized, c.whatsapp, c.email, c.consultant_name,
  t.id as turma_id, t.course_name, t.turma_label, t.start_date, t.status as turma_status
`
