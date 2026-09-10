/**
 * Multi-schema header detection for FEBRACIS historical turma sheets.
 * Headers vary across generations (ALUNO/CLIENTES, CPF/CNPJ, etc.).
 */

export type CanonicalField =
  | 'personName'
  | 'cpf'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'consultant'
  | 'confirmationStatus'
  | 'presence'
  | 'grade'
  | 'matriculaSales'
  | 'observation'
  | 'contact1'
  | 'contact2'
  | 'contact3'
  | 'contact4'
  | 'salesforceId'
  | 'salesforceUrl'
  | 'financial'
  | 'ignored'

const ALIASES: Record<CanonicalField, string[]> = {
  personName: ['aluno', 'alunos', 'cliente', 'clientes', 'nome', 'nome completo', 'participante'],
  cpf: ['cpf', 'cpf/cnpj', 'cnpj', 'documento'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['telefone', 'fone', 'celular', 'tel'],
  whatsapp: ['whatsapp', 'whats', 'zap'],
  consultant: ['consultor', 'consultora', 'vendedor', 'responsável', 'responsavel'],
  confirmationStatus: [
    'confirmação',
    'confirmacao',
    'status',
    'status vaga',
    'status confirmação',
    'status confirmacao',
  ],
  presence: ['presente', 'presença', 'presenca', 'presence'],
  grade: ['grade', 'faixa', 'nível', 'nivel'],
  matriculaSales: ['matricula sales', 'matrícula sales', 'matricula', 'salesforce matrícula'],
  observation: ['observação', 'observacao', 'obs', 'obs./contato', 'obs/contato', 'obs contato'],
  contact1: ['1º contato', '1o contato', '1 contato', 'primeiro contato'],
  contact2: ['2º contato', '2o contato', '2 contato', 'segundo contato'],
  contact3: ['3º contato', '3o contato', '3 contato', 'terceiro contato'],
  contact4: ['4º contato', '4o contato', '4 contato', 'quarto contato'],
  salesforceId: ['salesforce id', 'sf id', 'id salesforce'],
  salesforceUrl: ['salesforce', 'sf url', 'link salesforce', 'url salesforce'],
  financial: ['financeiro', 'pagamento', 'status pagamento', 'financeiro status'],
  ignored: [],
}

function normHeader(h: string) {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SchemaDetection {
  fingerprint: string
  mapping: Record<string, CanonicalField | 'unknown'>
  confidence: number
  knownFields: CanonicalField[]
  unknownHeaders: string[]
  missingRequired: CanonicalField[]
}

export function detectSchema(headers: string[]): SchemaDetection {
  const mapping: Record<string, CanonicalField | 'unknown'> = {}
  const used = new Set<CanonicalField>()
  const unknownHeaders: string[] = []

  for (const header of headers) {
    const n = normHeader(header)
    if (!n) {
      mapping[header] = 'ignored'
      continue
    }
    let hit: CanonicalField | null = null
    for (const [field, aliases] of Object.entries(ALIASES) as Array<[CanonicalField, string[]]>) {
      if (field === 'ignored') continue
      if (aliases.some((a) => n === normHeader(a) || n.includes(normHeader(a)))) {
        // prefer exact-ish matches; skip if already used for stronger uniqueness on identity fields
        if (
          (field === 'personName' || field === 'cpf' || field === 'email') &&
          used.has(field)
        ) {
          continue
        }
        hit = field
        break
      }
    }
    if (hit) {
      mapping[header] = hit
      used.add(hit)
    } else {
      mapping[header] = 'unknown'
      unknownHeaders.push(header)
    }
  }

  const knownFields = [...used]
  const missingRequired: CanonicalField[] = []
  if (!used.has('personName')) missingRequired.push('personName')

  const mappedCount = Object.values(mapping).filter((v) => v !== 'unknown' && v !== 'ignored').length
  const confidence =
    headers.length === 0 ? 0 : Math.max(0, Math.min(1, mappedCount / Math.max(headers.length, 1)))

  const fingerprint = headers.map(normHeader).filter(Boolean).join('|')

  return {
    fingerprint,
    mapping,
    confidence,
    knownFields,
    unknownHeaders,
    missingRequired,
  }
}

export function mapRowValues(
  headers: string[],
  values: string[],
  detection: SchemaDetection,
): Partial<Record<CanonicalField, string>> & { unknowns: Record<string, string> } {
  const out: Partial<Record<CanonicalField, string>> & { unknowns: Record<string, string> } = {
    unknowns: {},
  }
  headers.forEach((h, i) => {
    const field = detection.mapping[h]
    const val = values[i] ?? ''
    if (!field || field === 'ignored') return
    if (field === 'unknown') {
      if (val.trim()) out.unknowns[h] = val
      return
    }
    out[field] = val
  })
  return out
}
