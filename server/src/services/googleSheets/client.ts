import type { SheetRow } from './normalizer.js'
import { detectSchema } from '../ops/schemaDetector.js'

export interface SheetTitle {
  title: string
  sheetId: number
}

export interface GoogleSheetsClient {
  mode: 'mock' | 'production'
  testConnection(): Promise<{ ok: boolean; message: string }>
  listSheetTitles(spreadsheetId: string): Promise<SheetTitle[]>
  readRows(spreadsheetId: string, sheetName: string, headerRow: number): Promise<{
    headers: string[]
    rows: SheetRow[]
  }>
  /** Reads A1:Z40, finds header row with ALUNO/CLIENTES/etc., returns data rows. */
  readTurmaTab(spreadsheetId: string, sheetName: string): Promise<{
    headers: string[]
    rows: SheetRow[]
    headerRow: number
  }>
}

const MOCK_HEADERS = [
  'ID',
  'Nome',
  'Telefone',
  'WhatsApp',
  'Email',
  'Consultor',
  'Treinamento',
  'Data',
  'Presença',
  'Status',
  'Observações',
]

const MOCK_ROWS: string[][] = [
  [
    'EXT-1001',
    'João Pedro Almeida',
    '49988880001',
    '49988880001',
    'joao.almeida@email.com',
    'Vanessa',
    'Método CIS',
    '15/09/2026',
    'Sim',
    'Ativo',
    'Lead quente da planilha mock',
  ],
  [
    'EXT-1002',
    'Ana Clara Ribeiro',
    '(49) 98888-0002',
    '',
    'ana.ribeiro@email.com',
    'Lucas',
    'FCIS',
    '2026-10-01',
    'Presente',
    'Negociando',
    '',
  ],
]

/** Chapecó confirmações workbook (produção OPS). */
export const CHAPECO_CONFIRMACOES_SPREADSHEET_ID =
  '1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I'

const SKIP_TAB_RE = /^(legendas|modelo|cancelad)/i

export function shouldImportTurmaTab(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (SKIP_TAB_RE.test(t)) return false
  return true
}

/** 1-based header row index; prefers rows that detect personName. */
export function findHeaderRowIndex(matrix: string[][]): number {
  const limit = Math.min(matrix.length, 25)
  let best = { row: 1, score: -1 }
  for (let i = 0; i < limit; i++) {
    const headers = (matrix[i] || []).map((h) => String(h || '').trim())
    if (!headers.some(Boolean)) continue
    const d = detectSchema(headers)
    const hasName = d.knownFields.includes('personName')
    const score = (hasName ? 10 : 0) + d.knownFields.length + d.confidence
    if (hasName && score > best.score) {
      best = { row: i + 1, score }
    }
  }
  return best.score >= 0 ? best.row : 1
}

function matrixToRows(matrix: string[][], headerRow1Based: number) {
  const headerIdx = Math.max(0, headerRow1Based - 1)
  if (!matrix.length || headerIdx >= matrix.length) return { headers: [] as string[], rows: [] as SheetRow[] }
  const headers = (matrix[headerIdx] || []).map((h) => String(h || '').trim())
  const rows: SheetRow[] = matrix.slice(headerIdx + 1).map((line) => {
    const row: SheetRow = {}
    headers.forEach((h, i) => {
      if (!h) return
      row[h] = String(line[i] ?? '')
    })
    return row
  })
  return { headers, rows }
}

export class MockGoogleSheetsClient implements GoogleSheetsClient {
  mode = 'mock' as const

  async testConnection() {
    return { ok: true, message: 'Mock Sheets OK (sem credenciais Google)' }
  }

  async listSheetTitles() {
    return [
      { title: 'IF 08', sheetId: 1 },
      { title: 'CEOP05', sheetId: 2 },
      { title: 'LEGENDAS', sheetId: 3 },
    ]
  }

  async readRows(_spreadsheetId: string, _sheetName: string, _headerRow: number) {
    const rows: SheetRow[] = MOCK_ROWS.map((values) => {
      const row: SheetRow = {}
      MOCK_HEADERS.forEach((h, i) => {
        row[h] = values[i] ?? ''
      })
      return row
    })
    return { headers: MOCK_HEADERS, rows }
  }

  async readTurmaTab(_spreadsheetId: string, sheetName: string) {
    const headers = ['ALUNO', 'CPF/CNPJ', 'TELEFONE', 'EMAIL', 'LINK COMPRA', 'CONSULTOR']
    const rows: SheetRow[] = [
      {
        ALUNO: `Mock Aluno ${sheetName}`,
        'CPF/CNPJ': '12345678901',
        TELEFONE: '49999990000',
        EMAIL: 'mock@febracis.local',
        'LINK COMPRA': '',
        CONSULTOR: 'Vanessa',
      },
    ]
    return { headers, rows, headerRow: 5 }
  }
}

export class ProductionGoogleSheetsClient implements GoogleSheetsClient {
  mode = 'production' as const

  constructor(
    private readonly opts: {
      credentialsPath?: string
      credentialsJson?: string
    },
  ) {}

  async testConnection() {
    if (!this.opts.credentialsPath && !this.opts.credentialsJson) {
      return {
        ok: false,
        message: 'Credenciais Google Sheets não configuradas (use MOCK ou defina GOOGLE_SHEETS_CREDENTIALS_*)',
      }
    }
    try {
      await this.getAuth()
      return { ok: true, message: 'Credenciais carregadas (produção)' }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Falha ao carregar credenciais',
      }
    }
  }

  private async getAuth() {
    const { GoogleAuth } = await import('google-auth-library')
    if (this.opts.credentialsJson) {
      const credentials = JSON.parse(this.opts.credentialsJson)
      return new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      })
    }
    const { appRoot } = await import('../../lib/paths.js')
    const pathMod = await import('node:path')
    const keyFile = pathMod.isAbsolute(this.opts.credentialsPath || '')
      ? this.opts.credentialsPath!
      : pathMod.join(appRoot(), this.opts.credentialsPath || '')
    return new GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  }

  private async requestJson<T>(url: string): Promise<T> {
    const auth = await this.getAuth()
    const client = await auth.getClient()
    const res = await client.request<{ data: T }>({ url })
    return res.data
  }

  async listSheetTitles(spreadsheetId: string): Promise<SheetTitle[]> {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `?fields=sheets.properties(sheetId%2Ctitle)`
    const data = await this.requestJson<{
      sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>
    }>(url)
    return (data.sheets || [])
      .map((s) => ({
        title: String(s.properties?.title || '').trim(),
        sheetId: Number(s.properties?.sheetId || 0),
      }))
      .filter((s) => s.title)
  }

  private async readMatrix(spreadsheetId: string, sheetName: string, rangeA1: string) {
    const range = `${sheetName}!${rangeA1}`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`
    const data = await this.requestJson<{ values?: string[][] }>(url)
    return data.values || []
  }

  async readRows(spreadsheetId: string, sheetName: string, headerRow: number) {
    const values = await this.readMatrix(spreadsheetId, sheetName, `A${headerRow}:Z`)
    if (!values.length) return { headers: [], rows: [] }
    return matrixToRows(values, 1)
  }

  async readTurmaTab(spreadsheetId: string, sheetName: string) {
    const preview = await this.readMatrix(spreadsheetId, sheetName, 'A1:Z40')
    const headerRow = findHeaderRowIndex(preview)
    // Re-read from detected header through a wide band
    const values = await this.readMatrix(spreadsheetId, sheetName, `A${headerRow}:Z`)
    const { headers, rows } = matrixToRows(values, 1)
    return { headers, rows, headerRow }
  }
}

export function createSheetsClient(opts: {
  enabled: boolean
  credentialsPath?: string
  credentialsJson?: string
}): GoogleSheetsClient {
  if (opts.enabled && (opts.credentialsPath || opts.credentialsJson)) {
    return new ProductionGoogleSheetsClient(opts)
  }
  return new MockGoogleSheetsClient()
}
