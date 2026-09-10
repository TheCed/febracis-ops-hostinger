export type SheetRow = Record<string, string>

export interface SheetColumnMapping {
  crmField: string
  sheetHeader: string
  required?: boolean
  transform?: 'trim' | 'name' | 'phone' | 'email' | 'date' | 'boolean' | 'status' | 'presence' | 'none'
}

export const DEFAULT_MAPPINGS: SheetColumnMapping[] = [
  { crmField: 'externalId', sheetHeader: 'ID', required: true, transform: 'trim' },
  { crmField: 'fullName', sheetHeader: 'Nome', required: true, transform: 'name' },
  { crmField: 'phone', sheetHeader: 'Telefone', transform: 'phone' },
  { crmField: 'whatsapp', sheetHeader: 'WhatsApp', transform: 'phone' },
  { crmField: 'email', sheetHeader: 'Email', transform: 'email' },
  { crmField: 'consultantName', sheetHeader: 'Consultor', transform: 'name' },
  { crmField: 'trainingLabel', sheetHeader: 'Treinamento', transform: 'trim' },
  { crmField: 'eventDate', sheetHeader: 'Data', transform: 'date' },
  { crmField: 'presence', sheetHeader: 'Presença', transform: 'presence' },
  { crmField: 'status', sheetHeader: 'Status', transform: 'status' },
  { crmField: 'observations', sheetHeader: 'Observações', transform: 'trim' },
]

export function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizePhone(value: string): { display: string; digits: string; whatsapp: string } {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  let display = digits
  if (digits.length === 11) {
    display = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  } else if (digits.length === 10) {
    display = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  const whatsapp = digits ? `55${digits}` : ''
  return { display, digits, whatsapp }
}

export function normalizeBoolean(value: string): boolean {
  const v = value.trim().toLowerCase()
  return ['1', 'true', 'sim', 's', 'yes', 'y', 'x', 'presente', 'ok'].includes(v)
}

export function normalizePresence(value: string): 'present' | 'absent' | 'unknown' {
  const v = value.trim().toLowerCase()
  if (!v) return 'unknown'
  if (['presente', 'sim', 's', '1', 'true', 'x', 'yes'].includes(v)) return 'present'
  if (['ausente', 'nao', 'não', 'n', '0', 'false', 'no'].includes(v)) return 'absent'
  return 'unknown'
}

export function normalizeStatus(value: string): string {
  const v = value.trim().toLowerCase()
  const map: Record<string, string> = {
    lead: 'lead',
    novo: 'lead',
    ativo: 'active',
    active: 'active',
    negociando: 'negotiating',
    negotiating: 'negotiating',
    ganho: 'won',
    won: 'won',
    convertido: 'won',
    inativo: 'inactive',
    inactive: 'inactive',
    arquivado: 'archived',
    archived: 'archived',
    perdido: 'inactive',
  }
  return map[v] || (v ? 'lead' : 'lead')
}

export function normalizeDate(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const iso = Date.parse(v)
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10)
  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(v)
  if (br) {
    const day = br[1].padStart(2, '0')
    const month = br[2].padStart(2, '0')
    const year = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${year}-${month}-${day}`
  }
  return v
}

export function transformValue(
  value: string,
  transform: NonNullable<SheetColumnMapping['transform']>,
): unknown {
  switch (transform) {
    case 'name':
      return normalizeName(value)
    case 'email':
      return normalizeEmail(value)
    case 'phone':
      return normalizePhone(value).display
    case 'date':
      return normalizeDate(value)
    case 'boolean':
      return normalizeBoolean(value)
    case 'presence':
      return normalizePresence(value)
    case 'status':
      return normalizeStatus(value)
    case 'trim':
    case 'none':
    default:
      return value.trim()
  }
}

export interface MappedSheetRow {
  rowIndex: number
  raw: SheetRow
  mapped: Record<string, unknown>
  incomplete: boolean
  missingRequired: string[]
}

export function mapSheetRow(
  row: SheetRow,
  rowIndex: number,
  mappings: SheetColumnMapping[],
): MappedSheetRow {
  const mapped: Record<string, unknown> = {}
  const missingRequired: string[] = []
  for (const mapping of mappings) {
    const raw = row[mapping.sheetHeader] ?? ''
    const trimmed = String(raw).trim()
    if (mapping.required && !trimmed) missingRequired.push(mapping.sheetHeader)
    mapped[mapping.crmField] = transformValue(trimmed, mapping.transform ?? 'none')
  }
  return {
    rowIndex,
    raw: row,
    mapped,
    incomplete: missingRequired.length > 0,
    missingRequired,
  }
}
