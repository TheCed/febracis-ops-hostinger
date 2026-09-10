import type { SheetRow } from './normalizer.js'

export interface GoogleSheetsClient {
  mode: 'mock' | 'production'
  testConnection(): Promise<{ ok: boolean; message: string }>
  readRows(spreadsheetId: string, sheetName: string, headerRow: number): Promise<{
    headers: string[]
    rows: SheetRow[]
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
  [
    'EXT-1003',
    '  Pedro   Souza  ',
    '49988880003',
    '49988880003',
    'PEDRO@EMAIL.COM',
    'Consultor Inexistente',
    'ML5',
    '01/11/2026',
    'Não',
    'Lead',
    'Conflito de consultor esperado',
  ],
  [
    '',
    '',
    '49988880004',
    '',
    '',
    'Maria',
    '',
    '',
    '',
    '',
    'Linha inválida sem ID/Nome',
  ],
  [
    'EXT-1001',
    'João Pedro Almeida Duplicado',
    '49988880005',
    '',
    'joao.dup@email.com',
    'Vanessa',
    'CIS',
    '15/09/2026',
    'Sim',
    'Ativo',
    'Mesmo external_id — conflito/dedupe',
  ],
]

export class MockGoogleSheetsClient implements GoogleSheetsClient {
  mode = 'mock' as const

  async testConnection() {
    return { ok: true, message: 'Mock Sheets OK (sem credenciais Google)' }
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
}

/** Production client — requires credentials. Falls back message if missing. */
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
    return new GoogleAuth({
      keyFile: this.opts.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  }

  async readRows(spreadsheetId: string, sheetName: string, headerRow: number) {
    const auth = await this.getAuth()
    const client = await auth.getClient()
    const range = `${sheetName}!A${headerRow}:Z`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`
    const res = await client.request<{ data: { values?: string[][] } }>({ url })
    const values = res.data.values || []
    if (!values.length) return { headers: [], rows: [] }
    const headers = values[0].map((h) => String(h || '').trim())
    const rows: SheetRow[] = values.slice(1).map((line) => {
      const row: SheetRow = {}
      headers.forEach((h, i) => {
        row[h] = String(line[i] ?? '')
      })
      return row
    })
    return { headers, rows }
  }
}

export function createSheetsClient(opts: {
  enabled: boolean
  credentialsPath?: string
  credentialsJson?: string
}): GoogleSheetsClient {
  if (
    opts.enabled &&
    (opts.credentialsPath || opts.credentialsJson)
  ) {
    return new ProductionGoogleSheetsClient(opts)
  }
  return new MockGoogleSheetsClient()
}
