import { db } from '../db.js'
import { nowIso } from '../utils.js'

/**
 * Versioned additive migrations for FEBRACIS OPS.
 * Never drops legacy CRM tables.
 */
export function runOpsMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>).map(
      (r) => r.id,
    ),
  )

  const migrations: Array<{ id: string; up: () => void }> = [
    { id: '20260910_ops_person_fields', up: migratePersonFields },
    { id: '20260910_ops_training_classes', up: migrateTrainingClasses },
    { id: '20260910_ops_enrollments_ops', up: migrateEnrollmentsOps },
    { id: '20260910_ops_contacts_import', up: migrateContactsAndImport },
    { id: '20260910_ops_proposals_stub', up: migrateProposalsStub },
    { id: '20260910_ops_turma_alerts', up: migrateTurmaAlerts },
    { id: '20260910_ops_contact_queue', up: migrateContactQueue },
  ]

  for (const m of migrations) {
    if (applied.has(m.id)) continue
    m.up()
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
      m.id,
      nowIso(),
    )
  }
}

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

/** Person = clients evolved */
function migratePersonFields() {
  ensureColumn('clients', 'cpf_raw', 'TEXT')
  ensureColumn('clients', 'cpf_normalized', 'TEXT')
  ensureColumn('clients', 'document_type', 'TEXT')
  ensureColumn('clients', 'salesforce_id', 'TEXT')
  ensureColumn('clients', 'salesforce_url', 'TEXT')
  ensureColumn('clients', 'grade_label', 'TEXT')
  ensureColumn('clients', 'identity_confidence', 'REAL')
  ensureColumn('clients', 'identity_notes', 'TEXT')
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients(cpf_normalized)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_sf ON clients(salesforce_id)`)
}

function migrateTrainingClasses() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_classes (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      course_code TEXT,
      course_name TEXT NOT NULL,
      turma_code TEXT,
      turma_label TEXT,
      unidade TEXT NOT NULL DEFAULT 'Chapecó',
      modalidade TEXT,
      modulo TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'EM_CAPTACAO',
      capacity INTEGER,
      meta_minima INTEGER,
      meta_ideal INTEGER,
      matriculados INTEGER NOT NULL DEFAULT 0,
      confirmados INTEGER NOT NULL DEFAULT 0,
      prioridade TEXT,
      responsavel_acao TEXT,
      acao_comercial TEXT,
      ativa_potencial INTEGER NOT NULL DEFAULT 1,
      ativa_ficha INTEGER NOT NULL DEFAULT 1,
      ativa_proposta INTEGER NOT NULL DEFAULT 1,
      planilha_origem TEXT,
      aba_origem TEXT,
      external_id TEXT,
      course_event_id TEXT,
      last_health_json TEXT,
      ultima_revisao TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (course_event_id) REFERENCES course_events(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tc_course ON training_classes(course_id);
    CREATE INDEX IF NOT EXISTS idx_tc_start ON training_classes(start_date);
    CREATE INDEX IF NOT EXISTS idx_tc_status ON training_classes(status);
    CREATE INDEX IF NOT EXISTS idx_tc_prio ON training_classes(prioridade);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_external
      ON training_classes(external_id) WHERE external_id IS NOT NULL AND external_id != '';
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS turma_status_catalog (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `)

  const statuses = [
    ['PLANEJADA', 'Planejada', 1],
    ['EM_CAPTACAO', 'Em captação', 2],
    ['CONFIRMACAO', 'Confirmação', 3],
    ['REALIZANDO', 'Realizando', 4],
    ['ENCERRADA', 'Encerrada', 5],
    ['CANCELADA', 'Cancelada', 6],
  ] as const

  const insert = db.prepare(
    `INSERT OR IGNORE INTO turma_status_catalog (slug, label, sort_order, active) VALUES (?, ?, ?, 1)`,
  )
  for (const [slug, label, order] of statuses) insert.run(slug, label, order)
}

function migrateEnrollmentsOps() {
  ensureColumn('enrollments', 'training_class_id', 'TEXT')
  ensureColumn('enrollments', 'confirmation_status', "TEXT NOT NULL DEFAULT 'matriculado'")
  ensureColumn('enrollments', 'financial_status', 'TEXT')
  ensureColumn('enrollments', 'matricula_salesforce', 'TEXT')
  ensureColumn('enrollments', 'grade_label', 'TEXT')
  ensureColumn('enrollments', 'transfer_to_enrollment_id', 'TEXT')
  ensureColumn('enrollments', 'transfer_from_enrollment_id', 'TEXT')
  ensureColumn('enrollments', 'source_sheet', 'TEXT')
  ensureColumn('enrollments', 'source_row', 'INTEGER')
  ensureColumn('enrollments', 'source_hash', 'TEXT')
  ensureColumn('enrollments', 'raw_json', 'TEXT')
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_tc ON enrollments(training_class_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_conf ON enrollments(confirmation_status)`)
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_enr_source_hash ON enrollments(source_hash) WHERE source_hash IS NOT NULL AND source_hash != ''`,
  )
}

function migrateContactsAndImport() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_events (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      training_class_id TEXT,
      enrollment_id TEXT,
      occurred_at TEXT NOT NULL,
      type TEXT,
      channel TEXT,
      consultant_id TEXT,
      consultant_name TEXT,
      result TEXT,
      observation TEXT,
      next_action TEXT,
      next_action_at TEXT,
      source_sheet TEXT,
      source_row INTEGER,
      source_hash TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ce_person ON contact_events(person_id);
    CREATE INDEX IF NOT EXISTS idx_ce_tc ON contact_events(training_class_id);

    CREATE TABLE IF NOT EXISTS import_runs (
      id TEXT PRIMARY KEY,
      spreadsheet_id TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      mapping_version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      summary_json TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS import_raw_rows (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      source_file TEXT,
      source_sheet TEXT NOT NULL,
      source_row INTEGER NOT NULL,
      schema_fingerprint TEXT,
      mapping_confidence REAL,
      source_hash TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      disposition TEXT NOT NULL,
      disposition_reason TEXT,
      person_id TEXT,
      training_class_id TEXT,
      enrollment_id TEXT,
      imported_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES import_runs(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_hash ON import_raw_rows(source_hash);
    CREATE INDEX IF NOT EXISTS idx_raw_run ON import_raw_rows(run_id);
    CREATE INDEX IF NOT EXISTS idx_raw_disp ON import_raw_rows(disposition);

    CREATE TABLE IF NOT EXISTS migration_issues (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      code TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      source_sheet TEXT,
      source_row INTEGER,
      person_id TEXT,
      training_class_id TEXT,
      message TEXT NOT NULL,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mi_code ON migration_issues(code);
    CREATE INDEX IF NOT EXISTS idx_mi_status ON migration_issues(status);

    CREATE TABLE IF NOT EXISTS possible_duplicates (
      id TEXT PRIMARY KEY,
      person_a_id TEXT NOT NULL,
      person_b_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_json TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `)
}

function migrateProposalsStub() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      consultant_id TEXT,
      course_id TEXT,
      training_class_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      table_price REAL,
      discount REAL,
      final_price REAL,
      condition_label TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `)
}

function migrateContactQueue() {
  ensureColumn('enrollments', 'contact_status', "TEXT NOT NULL DEFAULT 'nao_contatado'")
  ensureColumn('enrollments', 'contact_status_updated_at', 'TEXT')
  ensureColumn('enrollments', 'last_contacted_at', 'TEXT')
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_contact ON enrollments(contact_status)`)
}

function migrateTurmaAlerts() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS turma_alerts (
      id TEXT PRIMARY KEY,
      training_class_id TEXT NOT NULL,
      alert_key TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      prioridade TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(training_class_id, alert_key)
    );
    CREATE INDEX IF NOT EXISTS idx_ta_active ON turma_alerts(active);
  `)
}
