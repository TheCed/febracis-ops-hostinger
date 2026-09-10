export const CONTACT_STATUSES = [
  'nao_contatado',
  'contatado',
  'respondeu',
  'sem_resposta',
  'interessado',
  'finalizado',
] as const

export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  nao_contatado: 'Não contatado',
  contatado: 'Contatado',
  respondeu: 'Respondeu',
  sem_resposta: 'Sem resposta',
  interessado: 'Interessado',
  finalizado: 'Finalizado',
}

/** Lower = work first. */
export const CONTACT_STATUS_PRIORITY: Record<ContactStatus, number> = {
  nao_contatado: 0,
  sem_resposta: 1,
  contatado: 2,
  respondeu: 3,
  interessado: 4,
  finalizado: 5,
}

export const OPEN_CONTACT_STATUSES: ContactStatus[] = [
  'nao_contatado',
  'sem_resposta',
  'contatado',
  'respondeu',
  'interessado',
]

export function isContactStatus(value: string): value is ContactStatus {
  return (CONTACT_STATUSES as readonly string[]).includes(value)
}

export function normalizeContactStatus(value?: string | null): ContactStatus {
  const v = (value || '').trim().toLowerCase()
  if (isContactStatus(v)) return v
  return 'nao_contatado'
}

export function contactStatusSortSql(column = 'e.contact_status'): string {
  return `CASE COALESCE(${column}, 'nao_contatado')
    WHEN 'nao_contatado' THEN 0
    WHEN 'sem_resposta' THEN 1
    WHEN 'contatado' THEN 2
    WHEN 'respondeu' THEN 3
    WHEN 'interessado' THEN 4
    WHEN 'finalizado' THEN 5
    ELSE 6
  END`
}
