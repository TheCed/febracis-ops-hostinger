import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, 'server', '.env') })

function bool(value: string | undefined, fallback = false) {
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

const publicUrl = (process.env.PUBLIC_URL || process.env.APP_URL || '').replace(/\/$/, '')
const defaultCors = 'http://localhost:5173,http://127.0.0.1:5173'
const corsList = (process.env.CORS_ORIGINS || defaultCors)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (publicUrl && !corsList.includes(publicUrl)) corsList.push(publicUrl)

export const env = {
  port: Number(process.env.PORT || 8787),
  nodeEnv,
  isProduction,
  publicUrl: publicUrl || null,
  /** Comma-separated origins. Production MUST set CORS_ORIGINS and/or PUBLIC_URL. */
  corsOrigins: corsList,
  /** Demo seed with known passwords — never in production, even if env flag is set. */
  allowDemoSeed: isProduction ? false : bool(process.env.ALLOW_DEMO_SEED, true),
  /** One-time first admin when DB has zero users (emergency / Hostinger). */
  bootstrapAdmin: {
    email: (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador',
  },
  cookieSecure: isProduction || bool(process.env.COOKIE_SECURE, false),
  googleAuth: {
    enabled: bool(process.env.GOOGLE_AUTH_ENABLED),
    oneTapEnabled: bool(process.env.GOOGLE_ONE_TAP_ENABLED),
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  googleSheets: {
    enabled: bool(process.env.GOOGLE_SHEETS_ENABLED),
    spreadsheetId:
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      '1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I',
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || 'Clientes',
    credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || '',
    credentialsJson: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || '',
  },
}
