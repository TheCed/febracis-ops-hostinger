import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../../data')
const dbPath = path.join(dataDir, 'febracis.sqlite')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL,
      consultant_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      meta_json TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consultants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      goals_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      sheet_row_id TEXT,
      sheet_key TEXT,
      full_name TEXT NOT NULL,
      preferred_name TEXT,
      email TEXT,
      phone TEXT,
      phone_normalized TEXT,
      whatsapp TEXT,
      consultant_id TEXT,
      consultant_name TEXT,
      status TEXT NOT NULL,
      presence TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      training_label TEXT,
      event_date TEXT,
      observations TEXT,
      courses_json TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      FOREIGN KEY (consultant_id) REFERENCES consultants(id)
    );

    CREATE TABLE IF NOT EXISTS client_notes (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_activity (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sheet_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      spreadsheet_id TEXT NOT NULL DEFAULT '',
      sheet_name TEXT NOT NULL DEFAULT 'Clientes',
      header_row INTEGER NOT NULL DEFAULT 1,
      id_header TEXT NOT NULL DEFAULT 'ID',
      mappings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      read_count INTEGER NOT NULL DEFAULT 0,
      created_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      unchanged_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      conflict_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      action TEXT NOT NULL,
      external_id TEXT,
      client_id TEXT,
      message TEXT,
      payload_json TEXT,
      FOREIGN KEY (run_id) REFERENCES sync_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      price_label TEXT,
      price_amount REAL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      marker_color TEXT NOT NULL DEFAULT 'gray',
      stacked INTEGER NOT NULL DEFAULT 0,
      sheet_column_key TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      capacity INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS course_events (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      date_label TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      location TEXT,
      capacity INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      event_id TEXT,
      status TEXT NOT NULL DEFAULT 'inscrito',
      present INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      decision INTEGER NOT NULL DEFAULT 0,
      decided_at TEXT,
      completed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(client_id, course_id, event_id),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES course_events(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      consultant_id TEXT,
      assignee_user_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      href TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL,
      color TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ficha_layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      layout_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );
  `)

  ensureColumn('users', 'google_sub', 'TEXT')
  ensureColumn('users', 'picture', 'TEXT')
  ensureColumn('users', 'auth_provider', "TEXT NOT NULL DEFAULT 'password'")
  ensureColumn('clients', 'external_id', 'TEXT')
  ensureColumn('clients', 'sheet_row', 'INTEGER')
  ensureColumn('clients', 'external_updated_at', 'TEXT')
  ensureColumn('clients', 'pipeline_stage', "TEXT NOT NULL DEFAULT 'novo'")
  ensureColumn('clients', 'next_action', 'TEXT')
  ensureColumn('clients', 'next_action_at', 'TEXT')
  ensureColumn('client_activity', 'meta_json', 'TEXT')

  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(external_id)`)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_external_id_unique ON clients(external_id) WHERE external_id IS NOT NULL AND external_id != ''`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_consultant ON clients(consultant_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)`)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL AND google_sub != ''`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enrollments_client ON enrollments(client_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)`)
}
