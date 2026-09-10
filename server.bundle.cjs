var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/src/index.ts
var import_express11 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);

// server/src/lib/db.ts
var import_node_sqlite = require("node:sqlite");
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);

// server/src/lib/paths.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
function appRoot() {
  const cwd = process.cwd();
  if (import_node_fs.default.existsSync(import_node_path.default.join(cwd, "server", "package.json")) || import_node_fs.default.existsSync(import_node_path.default.join(cwd, "web", "dist"))) {
    return cwd;
  }
  if (import_node_fs.default.existsSync(import_node_path.default.join(cwd, "src")) && import_node_fs.default.existsSync(import_node_path.default.join(cwd, "package.json"))) {
    return import_node_path.default.resolve(cwd, "..");
  }
  return cwd;
}
function dataDir() {
  return import_node_path.default.join(appRoot(), "server", "data");
}
function webDistDir() {
  return import_node_path.default.join(appRoot(), "web", "dist");
}
function envFileCandidates() {
  const root = appRoot();
  return [
    import_node_path.default.join(root, "app.env"),
    import_node_path.default.join(root, ".env"),
    import_node_path.default.join(root, "server", ".env")
  ];
}

// server/src/lib/db.ts
var dataDir2 = dataDir();
var dbPath = import_node_path2.default.join(dataDir2, "febracis.sqlite");
if (!import_node_fs2.default.existsSync(dataDir2)) {
  import_node_fs2.default.mkdirSync(dataDir2, { recursive: true });
}
var db = new import_node_sqlite.DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
function migrate() {
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
  `);
  ensureColumn("users", "google_sub", "TEXT");
  ensureColumn("users", "picture", "TEXT");
  ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'password'");
  ensureColumn("clients", "external_id", "TEXT");
  ensureColumn("clients", "sheet_row", "INTEGER");
  ensureColumn("clients", "external_updated_at", "TEXT");
  ensureColumn("clients", "pipeline_stage", "TEXT NOT NULL DEFAULT 'novo'");
  ensureColumn("clients", "next_action", "TEXT");
  ensureColumn("clients", "next_action_at", "TEXT");
  ensureColumn("client_activity", "meta_json", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(external_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_external_id_unique ON clients(external_id) WHERE external_id IS NOT NULL AND external_id != ''`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_consultant ON clients(consultant_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL AND google_sub != ''`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enrollments_client ON enrollments(client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)`);
}

// server/src/lib/utils.ts
var import_node_crypto = require("node:crypto");
function id(prefix) {
  const value = (0, import_node_crypto.randomUUID)();
  return prefix ? `${prefix}-${value}` : value;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// server/src/lib/migrations/opsMigrations.ts
function runOpsMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map(
      (r) => r.id
    )
  );
  const migrations = [
    { id: "20260910_ops_person_fields", up: migratePersonFields },
    { id: "20260910_ops_training_classes", up: migrateTrainingClasses },
    { id: "20260910_ops_enrollments_ops", up: migrateEnrollmentsOps },
    { id: "20260910_ops_contacts_import", up: migrateContactsAndImport },
    { id: "20260910_ops_proposals_stub", up: migrateProposalsStub },
    { id: "20260910_ops_turma_alerts", up: migrateTurmaAlerts },
    { id: "20260910_ops_contact_queue", up: migrateContactQueue }
  ];
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    m.up();
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
      m.id,
      nowIso()
    );
  }
}
function ensureColumn2(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
function migratePersonFields() {
  ensureColumn2("clients", "cpf_raw", "TEXT");
  ensureColumn2("clients", "cpf_normalized", "TEXT");
  ensureColumn2("clients", "document_type", "TEXT");
  ensureColumn2("clients", "salesforce_id", "TEXT");
  ensureColumn2("clients", "salesforce_url", "TEXT");
  ensureColumn2("clients", "grade_label", "TEXT");
  ensureColumn2("clients", "identity_confidence", "REAL");
  ensureColumn2("clients", "identity_notes", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients(cpf_normalized)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_sf ON clients(salesforce_id)`);
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
      unidade TEXT NOT NULL DEFAULT 'Chapec\xF3',
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
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS turma_status_catalog (
      slug TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
  const statuses = [
    ["PLANEJADA", "Planejada", 1],
    ["EM_CAPTACAO", "Em capta\xE7\xE3o", 2],
    ["CONFIRMACAO", "Confirma\xE7\xE3o", 3],
    ["REALIZANDO", "Realizando", 4],
    ["ENCERRADA", "Encerrada", 5],
    ["CANCELADA", "Cancelada", 6]
  ];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO turma_status_catalog (slug, label, sort_order, active) VALUES (?, ?, ?, 1)`
  );
  for (const [slug, label, order] of statuses) insert.run(slug, label, order);
}
function migrateEnrollmentsOps() {
  ensureColumn2("enrollments", "training_class_id", "TEXT");
  ensureColumn2("enrollments", "confirmation_status", "TEXT NOT NULL DEFAULT 'matriculado'");
  ensureColumn2("enrollments", "financial_status", "TEXT");
  ensureColumn2("enrollments", "matricula_salesforce", "TEXT");
  ensureColumn2("enrollments", "grade_label", "TEXT");
  ensureColumn2("enrollments", "transfer_to_enrollment_id", "TEXT");
  ensureColumn2("enrollments", "transfer_from_enrollment_id", "TEXT");
  ensureColumn2("enrollments", "source_sheet", "TEXT");
  ensureColumn2("enrollments", "source_row", "INTEGER");
  ensureColumn2("enrollments", "source_hash", "TEXT");
  ensureColumn2("enrollments", "raw_json", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_tc ON enrollments(training_class_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_conf ON enrollments(confirmation_status)`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_enr_source_hash ON enrollments(source_hash) WHERE source_hash IS NOT NULL AND source_hash != ''`
  );
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
  `);
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
  `);
}
function migrateContactQueue() {
  ensureColumn2("enrollments", "contact_status", "TEXT NOT NULL DEFAULT 'nao_contatado'");
  ensureColumn2("enrollments", "contact_status_updated_at", "TEXT");
  ensureColumn2("enrollments", "last_contacted_at", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_enr_contact ON enrollments(contact_status)`);
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
  `);
}

// server/src/seed.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);

// server/src/lib/permissions.ts
var ALL_PERMISSIONS = [
  "dashboard.view",
  "clients.view",
  "clients.edit",
  "clients.print",
  "print.mass",
  "consultants.view",
  "consultants.edit",
  "courses.view",
  "courses.edit",
  "users.view",
  "users.edit",
  "settings.view",
  "settings.edit",
  "sheets.sync",
  "ficha.edit",
  "reports.view"
];
var ROLE_PERMISSIONS = {
  admin: [...ALL_PERMISSIONS],
  comercial: [
    "dashboard.view",
    "clients.view",
    "clients.edit",
    "clients.print",
    "print.mass",
    "consultants.view",
    "courses.view",
    "reports.view"
  ],
  layout: [
    "dashboard.view",
    "clients.view",
    "clients.print",
    "print.mass",
    "courses.view",
    "ficha.edit"
  ],
  viewer: ["dashboard.view", "clients.view", "consultants.view", "courses.view", "reports.view"]
};

// server/src/config/env.ts
var import_dotenv = __toESM(require("dotenv"), 1);
for (const envPath of envFileCandidates()) {
  import_dotenv.default.config({ path: envPath });
}
function bool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
var nodeEnv = process.env.NODE_ENV || "development";
var isProduction = nodeEnv === "production";
var publicUrl = (process.env.PUBLIC_URL || process.env.APP_URL || "").replace(/\/$/, "");
var defaultCors = "http://localhost:5173,http://127.0.0.1:5173";
var corsList = (process.env.CORS_ORIGINS || defaultCors).split(",").map((s) => s.trim()).filter(Boolean);
if (publicUrl && !corsList.includes(publicUrl)) corsList.push(publicUrl);
var env = {
  port: Number(process.env.PORT || 3e3),
  nodeEnv,
  isProduction,
  publicUrl: publicUrl || null,
  /** Comma-separated origins. Production MUST set CORS_ORIGINS and/or PUBLIC_URL. */
  corsOrigins: corsList,
  /** Demo seed with known passwords — never in production, even if env flag is set. */
  allowDemoSeed: isProduction ? false : bool(process.env.ALLOW_DEMO_SEED, true),
  /** One-time first admin when DB has zero users (emergency / Hostinger). */
  bootstrapAdmin: {
    email: (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "",
    name: process.env.BOOTSTRAP_ADMIN_NAME || "Administrador"
  },
  cookieSecure: isProduction || bool(process.env.COOKIE_SECURE, false),
  googleAuth: {
    enabled: bool(process.env.GOOGLE_AUTH_ENABLED),
    oneTapEnabled: bool(process.env.GOOGLE_ONE_TAP_ENABLED),
    clientId: process.env.GOOGLE_CLIENT_ID || ""
  },
  googleSheets: {
    enabled: bool(process.env.GOOGLE_SHEETS_ENABLED),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || "Clientes",
    credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || "",
    credentialsJson: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || ""
  }
};

// server/src/seed.ts
function count(table) {
  return Number(db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c);
}
function tryBootstrapAdmin() {
  const { email, password, name } = env.bootstrapAdmin;
  if (!email || !password) return { created: false };
  if (password.length < 10) {
    console.warn("[seed] BOOTSTRAP_ADMIN_PASSWORD too short (min 10). Skipped.");
    return { created: false };
  }
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO users
      (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', 'active', ?, ?, NULL, ?, ?)`
  ).run(
    id("user"),
    name,
    email,
    import_bcryptjs.default.hashSync(password, 12),
    JSON.stringify(ROLE_PERMISSIONS.admin),
    createdAt,
    createdAt
  );
  console.log(`[seed] Bootstrap admin created: ${email}`);
  return { created: true };
}
function seedIfEmpty() {
  if (count("users") > 0) return { seeded: false };
  const bootstrap = tryBootstrapAdmin();
  if (bootstrap.created) return { seeded: true, bootstrap: true };
  if (!env.allowDemoSeed) {
    console.warn(
      "[seed] Skipped demo seed (production / ALLOW_DEMO_SEED=false). Set BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD."
    );
    return { seeded: false, skipped: true };
  }
  const createdAt = nowIso();
  const consultants = [
    {
      id: "consultant-vanessa",
      name: "Vanessa",
      email: "vanessa@febracis.local",
      phone: "(49) 99999-1001"
    },
    {
      id: "consultant-lucas",
      name: "Lucas",
      email: "lucas@febracis.local",
      phone: "(49) 99999-1002"
    },
    {
      id: "consultant-maria",
      name: "Maria",
      email: "maria@febracis.local",
      phone: "(49) 99999-1003"
    }
  ];
  const insertConsultant = db.prepare(
    `INSERT INTO consultants (id, name, email, phone, active, user_id, goals_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?)`
  );
  for (const c of consultants) {
    insertConsultant.run(
      c.id,
      c.name,
      c.email,
      c.phone,
      JSON.stringify({
        clientsTarget: 40,
        presenceTarget: 85,
        decisionsTarget: 25,
        revenueTarget: null
      }),
      createdAt,
      createdAt
    );
  }
  const users = [
    {
      id: "user-admin",
      name: "Administrador",
      email: "admin@febracis.local",
      role: "admin",
      password: "admin123",
      consultantId: null
    },
    {
      id: "user-comercial",
      name: "Comercial Demo",
      email: "comercial@febracis.local",
      role: "comercial",
      password: "comercial123",
      consultantId: "consultant-vanessa"
    }
  ];
  const insertUser = db.prepare(
    `INSERT INTO users
      (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  );
  for (const u of users) {
    insertUser.run(
      u.id,
      u.name,
      u.email,
      u.role,
      import_bcryptjs.default.hashSync(u.password, 12),
      JSON.stringify(ROLE_PERMISSIONS[u.role]),
      u.consultantId,
      createdAt,
      createdAt
    );
  }
  const sampleCourses = [
    { courseId: "m-cis", completed: true, decision: false },
    { courseId: "fcis", completed: true, decision: true },
    { courseId: "ml5", completed: false, decision: true },
    { courseId: "ceop", completed: false, decision: false }
  ];
  const clients = [
    {
      fullName: "Alexandre Marcos Bertagnolli",
      preferredName: "Alexandre",
      consultantId: "consultant-vanessa",
      consultantName: "Vanessa",
      status: "active",
      presence: "present",
      phone: "(49) 99111-2233",
      email: "alexandre@email.com",
      tags: ["quente", "empresario"],
      trainingLabel: "M\xE9todo CIS",
      observations: "Interessado em FCIS completo."
    },
    {
      fullName: "B\xE1rbara Hofmann Molon",
      preferredName: "B\xE1rbara",
      consultantId: "consultant-vanessa",
      consultantName: "Vanessa",
      status: "negotiating",
      presence: "present",
      phone: "(49) 99222-3344",
      email: "barbara@email.com",
      tags: ["follow-up"],
      trainingLabel: "FCIS",
      observations: ""
    },
    {
      fullName: "Carlos Eduardo Silva",
      preferredName: "Carlos",
      consultantId: "consultant-lucas",
      consultantName: "Lucas",
      status: "lead",
      presence: "unknown",
      phone: "(49) 99333-4455",
      email: null,
      tags: ["novo"],
      trainingLabel: "ML5",
      observations: "Indica\xE7\xE3o de parceiro."
    },
    {
      fullName: "Daniela Souza",
      preferredName: "Daniela",
      consultantId: "consultant-maria",
      consultantName: "Maria",
      status: "won",
      presence: "present",
      phone: "(49) 99444-5566",
      email: "daniela@email.com",
      tags: ["vip"],
      trainingLabel: "CEOP",
      observations: "Fechou pacote anual."
    },
    {
      fullName: "Eduardo Pires",
      preferredName: "Eduardo",
      consultantId: "consultant-lucas",
      consultantName: "Lucas",
      status: "inactive",
      presence: "absent",
      phone: "(49) 99555-6677",
      email: "eduardo@email.com",
      tags: ["reativar"],
      trainingLabel: "M\xE9todo CIS",
      observations: "N\xE3o compareceu no \xFAltimo evento."
    },
    {
      fullName: "Fernanda Costa",
      preferredName: "Fernanda",
      consultantId: "consultant-maria",
      consultantName: "Maria",
      status: "active",
      presence: "present",
      phone: "(49) 99666-7788",
      email: "fernanda@email.com",
      tags: ["quente"],
      trainingLabel: "BHP",
      observations: ""
    }
  ];
  const insertClient = db.prepare(
    `INSERT INTO clients (
      id, sheet_row_id, sheet_key, full_name, preferred_name, email, phone, phone_normalized,
      whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label,
      event_date, observations, courses_json, source, created_at, updated_at, synced_at
    ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, NULL)`
  );
  const insertActivity = db.prepare(
    `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const client of clients) {
    const clientId = id("client");
    insertClient.run(
      clientId,
      client.fullName,
      client.preferredName,
      client.email,
      client.phone,
      client.phone,
      client.phone,
      client.consultantId,
      client.consultantName,
      client.status,
      client.presence,
      JSON.stringify(client.tags),
      client.trainingLabel,
      "2026-09-15",
      client.observations || null,
      JSON.stringify(sampleCourses),
      createdAt,
      createdAt
    );
    insertActivity.run(
      id("act"),
      clientId,
      "other",
      "Cliente importado no seed inicial",
      "user-admin",
      createdAt
    );
  }
  return { seeded: true };
}
function seedCatalogIfEmpty() {
  const courseCount = Number(
    db.prepare("SELECT COUNT(*) as c FROM courses").get().c
  );
  if (courseCount === 0) {
    const createdAt = nowIso();
    const courses = [
      {
        id: "m-cis",
        name: "M\xE9todo CIS",
        category: "imersao",
        color: "green",
        stacked: 0,
        price: "R$ 1.997,00",
        order: 1
      },
      {
        id: "fcis",
        name: "FCIS - Forma\xE7\xE3o em Coaching Integral Sist\xEAmico",
        category: "formacao",
        color: "yellow",
        stacked: 1,
        price: "R$ 10.796,40",
        order: 2
      },
      {
        id: "ml5",
        name: "ML5 - Forma\xE7\xE3o de L\xEDderes",
        category: "formacao",
        color: "yellow",
        stacked: 1,
        price: "R$ 7.197,00",
        order: 3
      },
      {
        id: "ceop",
        name: "CEOP - Comunica\xE7\xE3o Eficaz e Orat\xF3ria Persuasiva",
        category: "formacao",
        color: "yellow",
        stacked: 0,
        price: "R$ 5.996,40",
        order: 4
      },
      {
        id: "bhp",
        name: "BHP - Gest\xE3o de Neg\xF3cios",
        category: "gestao",
        color: "green",
        stacked: 0,
        price: "R$ 5.996,40",
        order: 5
      }
    ];
    const insert = db.prepare(
      `INSERT INTO courses (
        id, name, short_name, category, description, status, price_label, price_amount, currency,
        marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, 'active', ?, NULL, 'BRL', ?, ?, NULL, ?, NULL, ?, ?)`
    );
    for (const c of courses) {
      insert.run(
        c.id,
        c.name,
        c.category,
        `Treinamento FEBRACIS: ${c.name}`,
        c.price,
        c.color,
        c.stacked,
        c.order,
        createdAt,
        createdAt
      );
    }
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, 'm-cis', 'M\xE9todo CIS \u2014 Setembro 2026', '2026-09-15', '2026-09-17', '15 a 17 | SET', 'scheduled', 'Chapec\xF3', 40, ?, ?)`
    ).run(id("event"), createdAt, createdAt);
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, 'm-cis', 'M\xE9todo CIS \u2014 Dezembro 2026', '2026-12-10', '2026-12-12', '10 a 12 | DEZ', 'scheduled', 'Chapec\xF3', 40, ?, ?)`
    ).run(id("event"), createdAt, createdAt);
  }
  const stageCount = Number(
    db.prepare("SELECT COUNT(*) as c FROM pipeline_stages").get().c
  );
  if (stageCount === 0) {
    const stages = [
      ["novo", "Novo", 1, "#64748b"],
      ["contato", "Contato", 2, "#2563eb"],
      ["qualificado", "Qualificado", 3, "#7c3aed"],
      ["follow-up", "Follow-up", 4, "#d97706"],
      ["decisao", "Decis\xE3o", 5, "#d4a437"],
      ["convertido", "Convertido", 6, "#15803d"],
      ["perdido", "Perdido", 7, "#b91c1c"]
    ];
    const insert = db.prepare(
      `INSERT INTO pipeline_stages (id, name, slug, sort_order, color, active) VALUES (?, ?, ?, ?, ?, 1)`
    );
    for (const [slug, name, order, color] of stages) {
      insert.run(id("stage"), name, slug, order, color);
    }
  }
}
var isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("/seed.ts") || process.argv[1]?.replace(/\\/g, "/").endsWith("/seed.js");
if (isDirectRun) {
  migrate();
  const result = seedIfEmpty();
  seedCatalogIfEmpty();
  console.log(result.seeded ? "Database seeded." : "Database already has data; seed skipped.");
}

// server/src/middleware/csrf.ts
var SAFE = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
function requireSameOrigin(req, res, next) {
  if (SAFE.has(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin) {
    if (env.corsOrigins.includes(origin)) {
      next();
      return;
    }
    res.status(403).json({ error: "csrf_origin_blocked" });
    return;
  }
  const referer = req.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (env.corsOrigins.includes(refOrigin)) {
        next();
        return;
      }
    } catch {
    }
    res.status(403).json({ error: "csrf_referer_blocked" });
    return;
  }
  if (!env.isProduction) {
    next();
    return;
  }
  res.status(403).json({ error: "csrf_missing_origin" });
}

// server/src/routes/auth.ts
var import_express = require("express");
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_zod = require("zod");

// server/src/middleware/auth.ts
var import_node_crypto2 = require("node:crypto");
var COOKIE = "febracis_session";
function sessionCookieName() {
  return COOKIE;
}
function mapUserRow(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    status: String(row.status),
    permissions: parseJson(String(row.permissions_json), []),
    consultantId: row.consultant_id ? String(row.consultant_id) : null,
    authProvider: String(row.auth_provider || "password"),
    googleSub: row.google_sub ? String(row.google_sub) : null,
    picture: row.picture ? String(row.picture) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  };
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
    consultantId: user.consultantId,
    authProvider: user.authProvider,
    googleSub: user.googleSub,
    picture: user.picture,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  };
}
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const session = db.prepare(
    `SELECT s.token, s.expires_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
  ).get(token);
  if (!session) {
    res.clearCookie(COOKIE);
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (String(session.expires_at) < (/* @__PURE__ */ new Date()).toISOString()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    res.clearCookie(COOKIE);
    res.status(401).json({ error: "session_expired" });
    return;
  }
  if (String(session.status) !== "active") {
    res.status(403).json({ error: "user_disabled", status: String(session.status) });
    return;
  }
  req.sessionToken = token;
  req.user = mapUserRow(session);
  next();
}
function requirePermission(...needed) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const ok = needed.every((p) => req.user.permissions.includes(p));
    if (!ok) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
function requireAnyPermission(...needed) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const ok = needed.some((p) => req.user.permissions.includes(p));
    if (!ok) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
function writeAudit(action, opts = {}) {
  db.prepare(
    `INSERT INTO audit_events (id, user_id, action, meta_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    opts.userId ?? null,
    action,
    opts.meta ? JSON.stringify(opts.meta) : null,
    opts.ip ?? null,
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function issueSession(res, userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  const token = (0, import_node_crypto2.randomBytes)(32).toString("hex");
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run(token, userId, expiresAt, createdAt);
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(
    createdAt,
    createdAt,
    userId
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 14 * 864e5,
    path: "/"
  });
  return { token, expiresAt, createdAt };
}

// server/src/services/googleAuth/verify.ts
var import_google_auth_library = require("google-auth-library");
async function verifyGoogleIdToken(credential) {
  if (!env.googleAuth.enabled || !env.googleAuth.clientId) {
    throw Object.assign(new Error("google_auth_disabled"), { code: "google_auth_disabled" });
  }
  const client = new import_google_auth_library.OAuth2Client(env.googleAuth.clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.googleAuth.clientId
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw Object.assign(new Error("invalid_google_token"), { code: "invalid_google_token" });
  }
  if (payload.email_verified !== true) {
    throw Object.assign(new Error("email_not_verified"), { code: "email_not_verified" });
  }
  const iss = payload.iss || "";
  if (!["accounts.google.com", "https://accounts.google.com"].includes(iss)) {
    throw Object.assign(new Error("invalid_issuer"), { code: "invalid_issuer" });
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture,
    emailVerified: true
  };
}
function googleAuthPublicConfig() {
  return {
    enabled: Boolean(env.googleAuth.enabled && env.googleAuth.clientId),
    oneTapEnabled: Boolean(
      env.googleAuth.enabled && env.googleAuth.oneTapEnabled && env.googleAuth.clientId
    ),
    clientId: env.googleAuth.enabled ? env.googleAuth.clientId : ""
  };
}

// server/src/lib/rateLimit.ts
var hits = /* @__PURE__ */ new Map();
function rateLimit(opts) {
  const now = Date.now();
  const current = hits.get(opts.key);
  if (!current || current.resetAt <= now) {
    hits.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (current.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1e3) };
  }
  current.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// server/src/routes/auth.ts
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(1)
});
function statusError(status) {
  if (status === "pending") return "pending_approval";
  if (status === "rejected") return "rejected";
  return "user_disabled";
}
function authRoutes() {
  const router = (0, import_express.Router)();
  router.get("/google/config", (_req, res) => {
    res.json(googleAuthPublicConfig());
  });
  router.post("/login", (req, res) => {
    const limited = rateLimit({
      key: `login:${req.ip || "unknown"}`,
      limit: 20,
      windowMs: 15 * 60 * 1e3
    });
    if (!limited.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterSec: limited.retryAfterSec });
      return;
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const hash = row ? String(row.password_hash || "") : "";
    if (!row || !hash || !import_bcryptjs2.default.compareSync(parsed.data.password, hash)) {
      writeAudit("auth.login_failed", { meta: { email }, ip: req.ip });
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    if (String(row.status) !== "active") {
      res.status(403).json({ error: statusError(String(row.status)), status: String(row.status) });
      return;
    }
    const session = issueSession(res, String(row.id));
    const user = mapUserRow({
      ...row,
      last_login_at: session.createdAt,
      updated_at: session.createdAt
    });
    writeAudit("auth.login", { userId: user.id, ip: req.ip });
    res.json({ token: "cookie", expiresAt: session.expiresAt, user: publicUser(user) });
  });
  router.post("/google", async (req, res) => {
    const limited = rateLimit({
      key: `google:${req.ip || "unknown"}`,
      limit: 30,
      windowMs: 15 * 60 * 1e3
    });
    if (!limited.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterSec: limited.retryAfterSec });
      return;
    }
    const credential = String(req.body?.credential || "");
    if (!credential) {
      res.status(400).json({ error: "missing_credential" });
      return;
    }
    try {
      const identity = await verifyGoogleIdToken(credential);
      const bySub = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(identity.sub);
      if (bySub) {
        if (String(bySub.status) !== "active") {
          res.status(403).json({ error: statusError(String(bySub.status)), status: String(bySub.status) });
          return;
        }
        const session = issueSession(res, String(bySub.id));
        const user = mapUserRow({
          ...bySub,
          last_login_at: session.createdAt,
          updated_at: session.createdAt
        });
        writeAudit("auth.google_login", { userId: user.id, ip: req.ip });
        res.json({
          token: "cookie",
          expiresAt: session.expiresAt,
          user: publicUser(user),
          outcome: "login"
        });
        return;
      }
      const byEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(identity.email);
      if (byEmail) {
        if (String(byEmail.status) !== "active") {
          res.status(403).json({ error: statusError(String(byEmail.status)), status: String(byEmail.status) });
          return;
        }
        const provider = String(byEmail.auth_provider || "password");
        const nextProvider = provider === "password" ? "both" : provider === "google" ? "google" : "both";
        db.prepare(
          `UPDATE users SET google_sub = ?, picture = ?, auth_provider = ?, updated_at = ? WHERE id = ?`
        ).run(identity.sub, identity.picture || null, nextProvider, nowIso(), byEmail.id);
        const session = issueSession(res, String(byEmail.id));
        const refreshed = db.prepare("SELECT * FROM users WHERE id = ?").get(byEmail.id);
        writeAudit("auth.google_link", { userId: String(byEmail.id), ip: req.ip });
        res.json({
          token: "cookie",
          expiresAt: session.expiresAt,
          user: publicUser(mapUserRow(refreshed)),
          outcome: "linked"
        });
        return;
      }
      const userId = id("user");
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO users
          (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at, google_sub, picture, auth_provider)
         VALUES (?, ?, ?, 'comercial', 'pending', '', ?, NULL, ?, ?, ?, ?, 'google')`
      ).run(
        userId,
        identity.name,
        identity.email,
        JSON.stringify(ROLE_PERMISSIONS.comercial),
        createdAt,
        createdAt,
        identity.sub,
        identity.picture || null
      );
      writeAudit("auth.google_register_pending", {
        userId,
        meta: { email: identity.email },
        ip: req.ip
      });
      db.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, href, created_at)
         SELECT ?, id, 'user_pending', 'Nova solicita\xE7\xE3o Google', ?, '/app/configuracoes?tab=users', ?
         FROM users WHERE role = 'admin' AND status = 'active'`
      ).run(id("notif"), `${identity.name} (${identity.email}) solicitou acesso.`, createdAt);
      res.status(202).json({
        outcome: "pending",
        message: "Solicita\xE7\xE3o enviada. Aguarde a aprova\xE7\xE3o de um administrador."
      });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "google_auth_failed";
      writeAudit("auth.google_failed", { meta: { code }, ip: req.ip });
      res.status(401).json({ error: code });
    }
  });
  router.post("/logout", requireAuth, (req, res) => {
    if (req.sessionToken) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(req.sessionToken);
    }
    writeAudit("auth.logout", { userId: req.user?.id, ip: req.ip });
    res.clearCookie(sessionCookieName(), { path: "/" });
    res.json({ ok: true });
  });
  router.get("/me", requireAuth, (req, res) => {
    res.json(publicUser(req.user));
  });
  return router;
}
function usersRoutes() {
  const router = (0, import_express.Router)();
  router.use(requireAuth);
  router.get("/", requirePermission("users.view"), (_req, res) => {
    const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    res.json(rows.map((row) => publicUser(mapUserRow(row))));
  });
  router.post("/", requirePermission("users.edit"), (req, res) => {
    const schema = import_zod.z.object({
      name: import_zod.z.string().min(2),
      email: import_zod.z.string().email(),
      password: import_zod.z.string().min(6),
      role: import_zod.z.enum(["admin", "comercial", "layout", "viewer"]),
      consultantId: import_zod.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      res.status(409).json({ error: "exists" });
      return;
    }
    const createdAt = nowIso();
    const userId = id("user");
    db.prepare(
      `INSERT INTO users
        (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at, auth_provider)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 'password')`
    ).run(
      userId,
      parsed.data.name.trim(),
      email,
      parsed.data.role,
      import_bcryptjs2.default.hashSync(parsed.data.password, 12),
      JSON.stringify(ROLE_PERMISSIONS[parsed.data.role]),
      parsed.data.consultantId ?? null,
      createdAt,
      createdAt
    );
    writeAudit("users.create", { userId: req.user?.id, meta: { createdUserId: userId }, ip: req.ip });
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    res.status(201).json(publicUser(mapUserRow(row)));
  });
  router.post("/:id/approve", requirePermission("users.edit"), (req, res) => {
    const schema = import_zod.z.object({
      role: import_zod.z.enum(["admin", "comercial", "layout", "viewer"]).optional(),
      consultantId: import_zod.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const role = parsed.data.role || String(row.role);
    db.prepare(
      `UPDATE users SET status = 'active', role = ?, permissions_json = ?, consultant_id = COALESCE(?, consultant_id), updated_at = ? WHERE id = ?`
    ).run(
      role,
      JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.comercial),
      parsed.data.consultantId ?? null,
      nowIso(),
      req.params.id
    );
    writeAudit("users.approve", { userId: req.user?.id, meta: { target: req.params.id }, ip: req.ip });
    const refreshed = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    res.json(publicUser(mapUserRow(refreshed)));
  });
  router.post("/:id/reject", requirePermission("users.edit"), (req, res) => {
    const row = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`UPDATE users SET status = 'rejected', updated_at = ? WHERE id = ?`).run(
      nowIso(),
      req.params.id
    );
    writeAudit("users.reject", { userId: req.user?.id, meta: { target: req.params.id }, ip: req.ip });
    res.json({ ok: true });
  });
  router.patch("/:id", requirePermission("users.edit"), (req, res) => {
    const schema = import_zod.z.object({
      status: import_zod.z.enum(["active", "pending", "disabled", "rejected"]).optional(),
      role: import_zod.z.enum(["admin", "comercial", "layout", "viewer"]).optional(),
      consultantId: import_zod.z.string().nullable().optional(),
      name: import_zod.z.string().min(2).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const role = parsed.data.role || String(row.role);
    db.prepare(
      `UPDATE users SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        role = ?,
        permissions_json = ?,
        consultant_id = COALESCE(?, consultant_id),
        updated_at = ?
       WHERE id = ?`
    ).run(
      parsed.data.name ?? null,
      parsed.data.status ?? null,
      role,
      JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer),
      parsed.data.consultantId === void 0 ? null : parsed.data.consultantId,
      nowIso(),
      req.params.id
    );
    const refreshed = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    res.json(publicUser(mapUserRow(refreshed)));
  });
  return router;
}

// server/src/routes/clients.ts
var import_express2 = require("express");
var import_zod2 = require("zod");

// server/src/lib/scope.ts
function shouldScopeToConsultant(user) {
  if (!user) return false;
  if (user.role === "admin") return false;
  return Boolean(user.consultantId);
}
function consultantScopeId(user) {
  return shouldScopeToConsultant(user) ? user.consultantId : null;
}
function assertClientAccess(user, clientConsultantId) {
  const scope = consultantScopeId(user);
  if (!scope) return true;
  return String(clientConsultantId || "") === scope;
}

// server/src/routes/clients.ts
function mapClient(row, extras) {
  return {
    id: String(row.id),
    externalIds: {
      googleSheetRowId: row.sheet_row_id ? String(row.sheet_row_id) : null,
      googleSheetKey: row.sheet_key ? String(row.sheet_key) : null
    },
    fullName: String(row.full_name),
    preferredName: row.preferred_name ? String(row.preferred_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    phoneNormalized: row.phone_normalized ? String(row.phone_normalized) : null,
    whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    consultantId: row.consultant_id ? String(row.consultant_id) : null,
    consultantName: row.consultant_name ? String(row.consultant_name) : null,
    status: String(row.status),
    presence: String(row.presence),
    tags: parseJson(String(row.tags_json), []),
    trainingLabel: row.training_label ? String(row.training_label) : null,
    eventDate: row.event_date ? String(row.event_date) : null,
    observations: row.observations ? String(row.observations) : null,
    pipelineStage: row.pipeline_stage ? String(row.pipeline_stage) : "novo",
    nextAction: row.next_action ? String(row.next_action) : null,
    nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
    courses: parseJson(String(row.courses_json), []),
    notes: extras?.notes ?? [],
    activity: extras?.activity ?? [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    syncedAt: row.synced_at ? String(row.synced_at) : null,
    source: String(row.source)
  };
}
function loadNotes(clientId) {
  return db.prepare(
    `SELECT id, body, created_by_user_id, created_at
         FROM client_notes WHERE client_id = ? ORDER BY created_at DESC`
  ).all(clientId).map((n) => ({
    id: String(n.id),
    body: String(n.body),
    createdByUserId: n.created_by_user_id ? String(n.created_by_user_id) : null,
    createdAt: String(n.created_at)
  }));
}
function loadActivity(clientId) {
  return db.prepare(
    `SELECT id, type, message, created_by_user_id, created_at
         FROM client_activity WHERE client_id = ? ORDER BY created_at DESC LIMIT 100`
  ).all(clientId).map((a) => ({
    id: String(a.id),
    type: String(a.type),
    message: String(a.message),
    createdByUserId: a.created_by_user_id ? String(a.created_by_user_id) : null,
    createdAt: String(a.created_at)
  }));
}
function addActivity(clientId, type, message, userId) {
  db.prepare(
    `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id("act"), clientId, type, message, userId ?? null, nowIso());
}
function clientsRoutes() {
  const router = (0, import_express2.Router)();
  router.use(requireAuth);
  router.get("/", requirePermission("clients.view"), (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const status = String(req.query.status ?? "").trim();
    const consultantId = String(req.query.consultantId ?? "").trim();
    const presence = String(req.query.presence ?? "").trim();
    const tag = String(req.query.tag ?? "").trim().toLowerCase();
    let rows = db.prepare("SELECT * FROM clients ORDER BY updated_at DESC").all();
    const scope = consultantScopeId(req.user);
    if (scope) {
      rows = rows.filter((row) => String(row.consultant_id ?? "") === scope);
    }
    if (q) {
      rows = rows.filter((row) => {
        const hay = [
          row.full_name,
          row.preferred_name,
          row.email,
          row.phone,
          row.whatsapp,
          row.consultant_name,
          row.observations
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (status && status !== "all") {
      rows = rows.filter((row) => String(row.status) === status);
    }
    if (consultantId && consultantId !== "all") {
      rows = rows.filter((row) => String(row.consultant_id ?? "") === consultantId);
    }
    if (presence && presence !== "all") {
      rows = rows.filter((row) => String(row.presence) === presence);
    }
    if (tag) {
      rows = rows.filter(
        (row) => parseJson(String(row.tags_json), []).some((t) => t.toLowerCase() === tag)
      );
    }
    res.json(rows.map((row) => mapClient(row)));
  });
  router.get("/:id", requirePermission("clients.view"), (req, res) => {
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!assertClientAccess(req.user, row.consultant_id ? String(row.consultant_id) : null)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    res.json(
      mapClient(row, {
        notes: loadNotes(String(row.id)),
        activity: loadActivity(String(row.id))
      })
    );
  });
  router.post("/", requirePermission("clients.edit"), (req, res) => {
    const schema = import_zod2.z.object({
      fullName: import_zod2.z.string().min(2),
      preferredName: import_zod2.z.string().nullable().optional(),
      email: import_zod2.z.string().email().nullable().optional().or(import_zod2.z.literal("")),
      phone: import_zod2.z.string().nullable().optional(),
      whatsapp: import_zod2.z.string().nullable().optional(),
      consultantId: import_zod2.z.string().nullable().optional(),
      consultantName: import_zod2.z.string().nullable().optional(),
      status: import_zod2.z.enum(["lead", "active", "negotiating", "won", "inactive", "archived"]).default("lead"),
      presence: import_zod2.z.enum(["unknown", "present", "absent"]).default("unknown"),
      tags: import_zod2.z.array(import_zod2.z.string()).default([]),
      trainingLabel: import_zod2.z.string().nullable().optional(),
      eventDate: import_zod2.z.string().nullable().optional(),
      observations: import_zod2.z.string().nullable().optional(),
      courses: import_zod2.z.array(
        import_zod2.z.object({
          courseId: import_zod2.z.string(),
          completed: import_zod2.z.boolean(),
          decision: import_zod2.z.boolean(),
          decidedAt: import_zod2.z.string().nullable().optional(),
          completedAt: import_zod2.z.string().nullable().optional()
        })
      ).default([])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }
    const clientId = id("client");
    const createdAt = nowIso();
    const data = parsed.data;
    db.prepare(
      `INSERT INTO clients (
        id, sheet_row_id, sheet_key, full_name, preferred_name, email, phone, phone_normalized,
        whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label,
        event_date, observations, courses_json, source, created_at, updated_at, synced_at
      ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, NULL)`
    ).run(
      clientId,
      data.fullName.trim(),
      data.preferredName?.trim() || null,
      data.email || null,
      data.phone || null,
      data.phone || null,
      data.whatsapp || data.phone || null,
      data.consultantId || null,
      data.consultantName || null,
      data.status,
      data.presence,
      JSON.stringify(data.tags),
      data.trainingLabel || null,
      data.eventDate || null,
      data.observations || null,
      JSON.stringify(data.courses),
      createdAt,
      createdAt
    );
    addActivity(clientId, "other", "Cliente criado", req.user?.id);
    writeAudit("clients.create", { userId: req.user?.id, meta: { clientId }, ip: req.ip });
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
    res.status(201).json(
      mapClient(row, { notes: loadNotes(clientId), activity: loadActivity(clientId) })
    );
  });
  router.patch("/:id", requirePermission("clients.edit"), (req, res) => {
    const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!assertClientAccess(
      req.user,
      existing.consultant_id ? String(existing.consultant_id) : null
    )) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const schema = import_zod2.z.object({
      fullName: import_zod2.z.string().min(2).optional(),
      preferredName: import_zod2.z.string().nullable().optional(),
      email: import_zod2.z.string().email().nullable().optional().or(import_zod2.z.literal("")),
      phone: import_zod2.z.string().nullable().optional(),
      whatsapp: import_zod2.z.string().nullable().optional(),
      consultantId: import_zod2.z.string().nullable().optional(),
      consultantName: import_zod2.z.string().nullable().optional(),
      status: import_zod2.z.enum(["lead", "active", "negotiating", "won", "inactive", "archived"]).optional(),
      presence: import_zod2.z.enum(["unknown", "present", "absent"]).optional(),
      tags: import_zod2.z.array(import_zod2.z.string()).optional(),
      trainingLabel: import_zod2.z.string().nullable().optional(),
      eventDate: import_zod2.z.string().nullable().optional(),
      observations: import_zod2.z.string().nullable().optional(),
      pipelineStage: import_zod2.z.string().optional(),
      nextAction: import_zod2.z.string().nullable().optional(),
      nextActionAt: import_zod2.z.string().nullable().optional(),
      courses: import_zod2.z.array(
        import_zod2.z.object({
          courseId: import_zod2.z.string(),
          completed: import_zod2.z.boolean(),
          decision: import_zod2.z.boolean(),
          decidedAt: import_zod2.z.string().nullable().optional(),
          completedAt: import_zod2.z.string().nullable().optional()
        })
      ).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const d = parsed.data;
    const updatedAt = nowIso();
    const next = {
      full_name: d.fullName?.trim() ?? existing.full_name,
      preferred_name: d.preferredName !== void 0 ? d.preferredName : existing.preferred_name,
      email: d.email !== void 0 ? d.email || null : existing.email,
      phone: d.phone !== void 0 ? d.phone : existing.phone,
      phone_normalized: d.phone !== void 0 ? d.phone : existing.phone_normalized,
      whatsapp: d.whatsapp !== void 0 ? d.whatsapp : existing.whatsapp,
      consultant_id: d.consultantId !== void 0 ? d.consultantId : existing.consultant_id,
      consultant_name: d.consultantName !== void 0 ? d.consultantName : existing.consultant_name,
      status: d.status ?? existing.status,
      presence: d.presence ?? existing.presence,
      tags_json: d.tags ? JSON.stringify(d.tags) : existing.tags_json,
      training_label: d.trainingLabel !== void 0 ? d.trainingLabel : existing.training_label,
      event_date: d.eventDate !== void 0 ? d.eventDate : existing.event_date,
      observations: d.observations !== void 0 ? d.observations : existing.observations,
      courses_json: d.courses ? JSON.stringify(d.courses) : existing.courses_json,
      pipeline_stage: d.pipelineStage ?? existing.pipeline_stage ?? "novo",
      next_action: d.nextAction !== void 0 ? d.nextAction : existing.next_action,
      next_action_at: d.nextActionAt !== void 0 ? d.nextActionAt : existing.next_action_at
    };
    db.prepare(
      `UPDATE clients SET
        full_name = ?, preferred_name = ?, email = ?, phone = ?, phone_normalized = ?,
        whatsapp = ?, consultant_id = ?, consultant_name = ?, status = ?, presence = ?,
        tags_json = ?, training_label = ?, event_date = ?, observations = ?, courses_json = ?,
        pipeline_stage = ?, next_action = ?, next_action_at = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      next.full_name,
      next.preferred_name,
      next.email,
      next.phone,
      next.phone_normalized,
      next.whatsapp,
      next.consultant_id,
      next.consultant_name,
      next.status,
      next.presence,
      next.tags_json,
      next.training_label,
      next.event_date,
      next.observations,
      next.courses_json,
      next.pipeline_stage,
      next.next_action,
      next.next_action_at,
      updatedAt,
      req.params.id
    );
    if (d.pipelineStage && d.pipelineStage !== existing.pipeline_stage) {
      addActivity(
        String(req.params.id),
        "status_change",
        `Pipeline: ${existing.pipeline_stage || "novo"} \u2192 ${d.pipelineStage}`,
        req.user?.id
      );
    } else if (d.status && d.status !== existing.status) {
      addActivity(
        String(req.params.id),
        "status_change",
        `Status: ${existing.status} \u2192 ${d.status}`,
        req.user?.id
      );
    } else if (d.courses) {
      addActivity(String(req.params.id), "course_update", "Cursos atualizados", req.user?.id);
    } else {
      addActivity(String(req.params.id), "other", "Cliente atualizado", req.user?.id);
    }
    writeAudit("clients.update", {
      userId: req.user?.id,
      meta: { clientId: req.params.id },
      ip: req.ip
    });
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
    res.json(
      mapClient(row, {
        notes: loadNotes(String(req.params.id)),
        activity: loadActivity(String(req.params.id))
      })
    );
  });
  router.post("/:id/notes", requirePermission("clients.edit"), (req, res) => {
    const existing = db.prepare("SELECT id, consultant_id FROM clients WHERE id = ?").get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!assertClientAccess(req.user, existing.consultant_id)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const body = String(req.body?.body ?? "").trim();
    if (!body) {
      res.status(400).json({ error: "empty_note" });
      return;
    }
    const noteId = id("note");
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO client_notes (id, client_id, body, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(noteId, req.params.id, body, req.user?.id ?? null, createdAt);
    addActivity(String(req.params.id), "note", "Nova observa\xE7\xE3o registrada", req.user?.id);
    res.status(201).json({
      id: noteId,
      body,
      createdByUserId: req.user?.id ?? null,
      createdAt
    });
  });
  return router;
}

// server/src/routes/consultants.ts
var import_express3 = require("express");
var import_zod3 = require("zod");
function mapConsultant(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    active: Boolean(row.active),
    userId: row.user_id ? String(row.user_id) : null,
    goals: parseJson(String(row.goals_json), {
      clientsTarget: null,
      presenceTarget: null,
      decisionsTarget: null,
      revenueTarget: null
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
function statsFor(consultantId) {
  const clients = db.prepare("SELECT * FROM clients WHERE consultant_id = ?").all(consultantId);
  let present = 0;
  let decisions = 0;
  let coursesSold = 0;
  let active = 0;
  for (const client of clients) {
    if (["active", "negotiating", "won"].includes(String(client.status))) active += 1;
    if (String(client.presence) === "present") present += 1;
    const courses = parseJson(
      String(client.courses_json),
      []
    );
    decisions += courses.filter((c) => c.decision).length;
    coursesSold += courses.filter((c) => c.completed || c.decision).length;
  }
  const total = clients.length;
  return {
    consultantId,
    clientsTotal: total,
    clientsActive: active,
    presenceRate: total ? Math.round(present / total * 100) : 0,
    decisions,
    conversions: decisions,
    coursesSold
  };
}
function consultantsRoutes() {
  const router = (0, import_express3.Router)();
  router.use(requireAuth);
  router.get("/", requirePermission("consultants.view"), (_req, res) => {
    const rows = db.prepare("SELECT * FROM consultants ORDER BY name COLLATE NOCASE").all();
    res.json(
      rows.map((row) => ({
        ...mapConsultant(row),
        stats: statsFor(String(row.id))
      }))
    );
  });
  router.get("/:id", requirePermission("consultants.view"), (req, res) => {
    const row = db.prepare("SELECT * FROM consultants WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const clients = db.prepare("SELECT * FROM clients WHERE consultant_id = ? ORDER BY full_name COLLATE NOCASE").all(req.params.id).map((c) => ({
      id: String(c.id),
      fullName: String(c.full_name),
      preferredName: c.preferred_name ? String(c.preferred_name) : null,
      status: String(c.status),
      presence: String(c.presence),
      phone: c.phone ? String(c.phone) : null,
      updatedAt: String(c.updated_at)
    }));
    res.json({
      ...mapConsultant(row),
      stats: statsFor(String(row.id)),
      clients
    });
  });
  router.post("/", requirePermission("consultants.edit"), (req, res) => {
    const schema = import_zod3.z.object({
      name: import_zod3.z.string().min(2),
      email: import_zod3.z.string().email().nullable().optional().or(import_zod3.z.literal("")),
      phone: import_zod3.z.string().nullable().optional(),
      active: import_zod3.z.boolean().default(true),
      goals: import_zod3.z.object({
        clientsTarget: import_zod3.z.number().nullable().optional(),
        presenceTarget: import_zod3.z.number().nullable().optional(),
        decisionsTarget: import_zod3.z.number().nullable().optional(),
        revenueTarget: import_zod3.z.number().nullable().optional()
      }).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const consultantId = id("consultant");
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO consultants (id, name, email, phone, active, user_id, goals_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).run(
      consultantId,
      parsed.data.name.trim(),
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.active ? 1 : 0,
      JSON.stringify(
        parsed.data.goals ?? {
          clientsTarget: 30,
          presenceTarget: 80,
          decisionsTarget: 20,
          revenueTarget: null
        }
      ),
      createdAt,
      createdAt
    );
    writeAudit("consultants.create", {
      userId: req.user?.id,
      meta: { consultantId },
      ip: req.ip
    });
    const row = db.prepare("SELECT * FROM consultants WHERE id = ?").get(consultantId);
    res.status(201).json({ ...mapConsultant(row), stats: statsFor(consultantId) });
  });
  return router;
}

// server/src/routes/dashboard.ts
var import_express4 = require("express");
function dashboardRoutes() {
  const router = (0, import_express4.Router)();
  router.use(requireAuth, requirePermission("dashboard.view"));
  router.get("/summary", (_req, res) => {
    const clients = db.prepare("SELECT * FROM clients").all();
    const consultants = db.prepare("SELECT id, name FROM consultants WHERE active = 1").all();
    const total = clients.length;
    const active = clients.filter(
      (c) => ["active", "negotiating", "won"].includes(String(c.status))
    ).length;
    const present = clients.filter((c) => String(c.presence) === "present").length;
    let decisions = 0;
    let completed = 0;
    let clientsWithDecision = 0;
    for (const client of clients) {
      const courses = parseJson(
        String(client.courses_json),
        []
      );
      const clientDecisions = courses.filter((c) => c.decision).length;
      decisions += clientDecisions;
      completed += courses.filter((c) => c.completed).length;
      if (clientDecisions > 0) clientsWithDecision += 1;
    }
    const byConsultant = consultants.map((consultant) => {
      const bag = clients.filter((c) => String(c.consultant_id) === consultant.id);
      return {
        consultantId: consultant.id,
        name: consultant.name,
        clients: bag.length,
        present: bag.filter((c) => String(c.presence) === "present").length
      };
    });
    const recentActivity = db.prepare(
      `SELECT a.id, a.type, a.message, a.created_at, c.full_name as client_name, c.id as client_id
           FROM client_activity a
           JOIN clients c ON c.id = a.client_id
           ORDER BY a.created_at DESC
           LIMIT 12`
    ).all().map((row) => ({
      id: String(row.id),
      type: String(row.type),
      message: String(row.message),
      createdAt: String(row.created_at),
      clientId: String(row.client_id),
      clientName: String(row.client_name)
    }));
    const coursesCatalog = Number(
      db.prepare(`SELECT COUNT(*) as c FROM courses`).get().c
    );
    res.json({
      clientsTotal: total,
      clientsActive: active,
      presenceRate: total ? Math.round(present / total * 100) : 0,
      decisions,
      completedCourses: completed,
      conversionRate: present ? Math.round(clientsWithDecision / present * 100) : 0,
      coursesCatalog,
      byConsultant,
      recentActivity
    });
  });
  return router;
}

// server/src/routes/googleSheets.ts
var import_express5 = require("express");
var import_zod4 = require("zod");

// server/src/services/googleSheets/client.ts
var MOCK_HEADERS = [
  "ID",
  "Nome",
  "Telefone",
  "WhatsApp",
  "Email",
  "Consultor",
  "Treinamento",
  "Data",
  "Presen\xE7a",
  "Status",
  "Observa\xE7\xF5es"
];
var MOCK_ROWS = [
  [
    "EXT-1001",
    "Jo\xE3o Pedro Almeida",
    "49988880001",
    "49988880001",
    "joao.almeida@email.com",
    "Vanessa",
    "M\xE9todo CIS",
    "15/09/2026",
    "Sim",
    "Ativo",
    "Lead quente da planilha mock"
  ],
  [
    "EXT-1002",
    "Ana Clara Ribeiro",
    "(49) 98888-0002",
    "",
    "ana.ribeiro@email.com",
    "Lucas",
    "FCIS",
    "2026-10-01",
    "Presente",
    "Negociando",
    ""
  ],
  [
    "EXT-1003",
    "  Pedro   Souza  ",
    "49988880003",
    "49988880003",
    "PEDRO@EMAIL.COM",
    "Consultor Inexistente",
    "ML5",
    "01/11/2026",
    "N\xE3o",
    "Lead",
    "Conflito de consultor esperado"
  ],
  [
    "",
    "",
    "49988880004",
    "",
    "",
    "Maria",
    "",
    "",
    "",
    "",
    "Linha inv\xE1lida sem ID/Nome"
  ],
  [
    "EXT-1001",
    "Jo\xE3o Pedro Almeida Duplicado",
    "49988880005",
    "",
    "joao.dup@email.com",
    "Vanessa",
    "CIS",
    "15/09/2026",
    "Sim",
    "Ativo",
    "Mesmo external_id \u2014 conflito/dedupe"
  ]
];
var MockGoogleSheetsClient = class {
  mode = "mock";
  async testConnection() {
    return { ok: true, message: "Mock Sheets OK (sem credenciais Google)" };
  }
  async readRows(_spreadsheetId, _sheetName, _headerRow) {
    const rows = MOCK_ROWS.map((values) => {
      const row = {};
      MOCK_HEADERS.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      return row;
    });
    return { headers: MOCK_HEADERS, rows };
  }
};
var ProductionGoogleSheetsClient = class {
  constructor(opts) {
    this.opts = opts;
  }
  mode = "production";
  async testConnection() {
    if (!this.opts.credentialsPath && !this.opts.credentialsJson) {
      return {
        ok: false,
        message: "Credenciais Google Sheets n\xE3o configuradas (use MOCK ou defina GOOGLE_SHEETS_CREDENTIALS_*)"
      };
    }
    try {
      await this.getAuth();
      return { ok: true, message: "Credenciais carregadas (produ\xE7\xE3o)" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Falha ao carregar credenciais"
      };
    }
  }
  async getAuth() {
    const { GoogleAuth } = await import("google-auth-library");
    if (this.opts.credentialsJson) {
      const credentials = JSON.parse(this.opts.credentialsJson);
      return new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
      });
    }
    return new GoogleAuth({
      keyFile: this.opts.credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
  }
  async readRows(spreadsheetId, sheetName, headerRow) {
    const auth = await this.getAuth();
    const client = await auth.getClient();
    const range = `${sheetName}!A${headerRow}:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`;
    const res = await client.request({ url });
    const values = res.data.values || [];
    if (!values.length) return { headers: [], rows: [] };
    const headers = values[0].map((h) => String(h || "").trim());
    const rows = values.slice(1).map((line) => {
      const row = {};
      headers.forEach((h, i) => {
        row[h] = String(line[i] ?? "");
      });
      return row;
    });
    return { headers, rows };
  }
};
function createSheetsClient(opts) {
  if (opts.enabled && (opts.credentialsPath || opts.credentialsJson)) {
    return new ProductionGoogleSheetsClient(opts);
  }
  return new MockGoogleSheetsClient();
}

// server/src/services/googleSheets/normalizer.ts
var DEFAULT_MAPPINGS = [
  { crmField: "externalId", sheetHeader: "ID", required: true, transform: "trim" },
  { crmField: "fullName", sheetHeader: "Nome", required: true, transform: "name" },
  { crmField: "phone", sheetHeader: "Telefone", transform: "phone" },
  { crmField: "whatsapp", sheetHeader: "WhatsApp", transform: "phone" },
  { crmField: "email", sheetHeader: "Email", transform: "email" },
  { crmField: "consultantName", sheetHeader: "Consultor", transform: "name" },
  { crmField: "trainingLabel", sheetHeader: "Treinamento", transform: "trim" },
  { crmField: "eventDate", sheetHeader: "Data", transform: "date" },
  { crmField: "presence", sheetHeader: "Presen\xE7a", transform: "presence" },
  { crmField: "status", sheetHeader: "Status", transform: "status" },
  { crmField: "observations", sheetHeader: "Observa\xE7\xF5es", transform: "trim" }
];
function normalizeName(value) {
  return value.replace(/\s+/g, " ").trim();
}
function normalizeEmail(value) {
  return value.trim().toLowerCase();
}
function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  let display = digits;
  if (digits.length === 11) {
    display = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    display = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  const whatsapp = digits ? `55${digits}` : "";
  return { display, digits, whatsapp };
}
function normalizeBoolean(value) {
  const v = value.trim().toLowerCase();
  return ["1", "true", "sim", "s", "yes", "y", "x", "presente", "ok"].includes(v);
}
function normalizePresence(value) {
  const v = value.trim().toLowerCase();
  if (!v) return "unknown";
  if (["presente", "sim", "s", "1", "true", "x", "yes"].includes(v)) return "present";
  if (["ausente", "nao", "n\xE3o", "n", "0", "false", "no"].includes(v)) return "absent";
  return "unknown";
}
function normalizeStatus(value) {
  const v = value.trim().toLowerCase();
  const map = {
    lead: "lead",
    novo: "lead",
    ativo: "active",
    active: "active",
    negociando: "negotiating",
    negotiating: "negotiating",
    ganho: "won",
    won: "won",
    convertido: "won",
    inativo: "inactive",
    inactive: "inactive",
    arquivado: "archived",
    archived: "archived",
    perdido: "inactive"
  };
  return map[v] || (v ? "lead" : "lead");
}
function normalizeDate(value) {
  const v = value.trim();
  if (!v) return null;
  const iso = Date.parse(v);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(v);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${month}-${day}`;
  }
  return v;
}
function transformValue(value, transform) {
  switch (transform) {
    case "name":
      return normalizeName(value);
    case "email":
      return normalizeEmail(value);
    case "phone":
      return normalizePhone(value).display;
    case "date":
      return normalizeDate(value);
    case "boolean":
      return normalizeBoolean(value);
    case "presence":
      return normalizePresence(value);
    case "status":
      return normalizeStatus(value);
    case "trim":
    case "none":
    default:
      return value.trim();
  }
}
function mapSheetRow(row, rowIndex, mappings) {
  const mapped = {};
  const missingRequired = [];
  for (const mapping of mappings) {
    const raw = row[mapping.sheetHeader] ?? "";
    const trimmed = String(raw).trim();
    if (mapping.required && !trimmed) missingRequired.push(mapping.sheetHeader);
    mapped[mapping.crmField] = transformValue(trimmed, mapping.transform ?? "none");
  }
  return {
    rowIndex,
    raw: row,
    mapped,
    incomplete: missingRequired.length > 0,
    missingRequired
  };
}

// server/src/services/googleSheets/syncService.ts
function getClient() {
  return createSheetsClient({
    enabled: env.googleSheets.enabled,
    credentialsPath: env.googleSheets.credentialsPath,
    credentialsJson: env.googleSheets.credentialsJson
  });
}
function getSheetSettings() {
  const row = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get();
  const client = getClient();
  if (!row) {
    const updatedAt = nowIso();
    db.prepare(
      `INSERT INTO sheet_settings (id, enabled, spreadsheet_id, sheet_name, header_row, id_header, mappings_json, updated_at)
       VALUES (1, 0, ?, ?, 1, 'ID', ?, ?)`
    ).run(
      env.googleSheets.spreadsheetId,
      env.googleSheets.sheetName,
      JSON.stringify(DEFAULT_MAPPINGS),
      updatedAt
    );
    return getSheetSettings();
  }
  return {
    enabled: Boolean(row.enabled) || env.googleSheets.enabled,
    spreadsheetId: String(row.spreadsheet_id || env.googleSheets.spreadsheetId),
    sheetName: String(row.sheet_name || env.googleSheets.sheetName),
    headerRow: Number(row.header_row || 1),
    idHeader: String(row.id_header || "ID"),
    mappings: parseJson(String(row.mappings_json), DEFAULT_MAPPINGS),
    updatedAt: String(row.updated_at),
    envEnabled: env.googleSheets.enabled,
    clientMode: client.mode
  };
}
function saveSheetSettings(input) {
  const current = getSheetSettings();
  const next = {
    enabled: input.enabled ?? current.enabled,
    spreadsheetId: input.spreadsheetId ?? current.spreadsheetId,
    sheetName: input.sheetName ?? current.sheetName,
    headerRow: input.headerRow ?? current.headerRow,
    idHeader: input.idHeader ?? current.idHeader,
    mappings: input.mappings ?? current.mappings
  };
  const updatedAt = nowIso();
  db.prepare(
    `UPDATE sheet_settings SET enabled = ?, spreadsheet_id = ?, sheet_name = ?, header_row = ?, id_header = ?, mappings_json = ?, updated_at = ? WHERE id = 1`
  ).run(
    next.enabled ? 1 : 0,
    next.spreadsheetId,
    next.sheetName,
    next.headerRow,
    next.idHeader,
    JSON.stringify(next.mappings),
    updatedAt
  );
  return getSheetSettings();
}
function findConsultantId(name) {
  const n = (name || "").trim();
  if (!n) return { id: null, conflict: false };
  const row = db.prepare("SELECT id, name FROM consultants WHERE lower(name) = lower(?)").get(n);
  if (row) return { id: row.id, conflict: false };
  return { id: null, conflict: true };
}
function findByExternalId(externalId) {
  return db.prepare("SELECT * FROM clients WHERE external_id = ?").get(externalId);
}
function findSoftDuplicate(phone, email) {
  const phoneDigits = normalizePhone(phone).digits;
  const emailNorm = email.trim().toLowerCase();
  const rows = db.prepare("SELECT * FROM clients").all();
  return rows.filter((r) => {
    const p = normalizePhone(String(r.phone_normalized || r.phone || "")).digits;
    const e = String(r.email || "").toLowerCase();
    return phoneDigits && p && p === phoneDigits || emailNorm && e && e === emailNorm;
  });
}
function snapshotComparable(mapped, consultantId) {
  return JSON.stringify({
    fullName: mapped.fullName,
    email: mapped.email,
    phone: mapped.phone,
    whatsapp: mapped.whatsapp || mapped.phone,
    status: mapped.status,
    presence: mapped.presence,
    consultantId,
    trainingLabel: mapped.trainingLabel,
    eventDate: mapped.eventDate,
    observations: mapped.observations
  });
}
async function testSheetsConnection() {
  const client = getClient();
  const settings = getSheetSettings();
  const result = await client.testConnection();
  return {
    ...result,
    clientMode: client.mode,
    spreadsheetId: settings.spreadsheetId,
    sheetName: settings.sheetName
  };
}
async function runSheetSync(opts) {
  const settings = getSheetSettings();
  const client = getClient();
  const startedAt = nowIso();
  const runId = id("sync");
  db.prepare(
    `INSERT INTO sync_runs (id, source, mode, status, started_at, user_id)
     VALUES (?, 'google_sheets', ?, 'running', ?, ?)`
  ).run(runId, opts.dryRun ? "dry-run" : "apply", startedAt, opts.userId ?? null);
  const items = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let conflicts = 0;
  let errors = 0;
  try {
    const { rows } = await client.readRows(
      settings.spreadsheetId || "mock",
      settings.sheetName,
      settings.headerRow
    );
    const seenExternal = /* @__PURE__ */ new Set();
    for (let i = 0; i < rows.length; i++) {
      const mappedRow = mapSheetRow(rows[i], i + settings.headerRow + 1, settings.mappings);
      const externalId = String(mappedRow.mapped.externalId || "").trim();
      if (mappedRow.incomplete) {
        items.push({
          action: "invalid",
          externalId: externalId || null,
          message: `Campos obrigat\xF3rios ausentes: ${mappedRow.missingRequired.join(", ")}`,
          mapped: mappedRow.mapped
        });
        errors += 1;
        continue;
      }
      if (seenExternal.has(externalId)) {
        items.push({
          action: "conflict",
          externalId,
          message: "external_id duplicado na pr\xF3pria planilha",
          mapped: mappedRow.mapped
        });
        conflicts += 1;
        continue;
      }
      seenExternal.add(externalId);
      const consultant = findConsultantId(String(mappedRow.mapped.consultantName || ""));
      if (consultant.conflict) {
        items.push({
          action: "conflict",
          externalId,
          message: `Consultor n\xE3o encontrado: ${mappedRow.mapped.consultantName}`,
          mapped: mappedRow.mapped
        });
        conflicts += 1;
        continue;
      }
      const existing = findByExternalId(externalId);
      if (!existing) {
        const soft = findSoftDuplicate(
          String(mappedRow.mapped.phone || ""),
          String(mappedRow.mapped.email || "")
        ).filter((r) => !r.external_id);
        if (soft.length) {
          items.push({
            action: "conflict",
            externalId,
            clientId: String(soft[0].id),
            message: "Poss\xEDvel duplicata por telefone/email (sem merge autom\xE1tico)",
            mapped: mappedRow.mapped
          });
          conflicts += 1;
          continue;
        }
        items.push({
          action: "create",
          externalId,
          message: `Novo cliente: ${mappedRow.mapped.fullName}`,
          mapped: mappedRow.mapped
        });
        created += 1;
        if (!opts.dryRun) {
          const clientId = id("client");
          const createdAt = nowIso();
          const phone = String(mappedRow.mapped.phone || "");
          const phoneNorm = normalizePhone(phone);
          db.prepare(
            `INSERT INTO clients (
              id, sheet_row_id, sheet_key, external_id, sheet_row, full_name, preferred_name, email, phone, phone_normalized,
              whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label, event_date, observations,
              courses_json, source, created_at, updated_at, synced_at, external_updated_at, pipeline_stage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'google_sheets', ?, ?, ?, ?, 'novo')`
          ).run(
            clientId,
            null,
            externalId,
            externalId,
            mappedRow.rowIndex,
            mappedRow.mapped.fullName,
            null,
            mappedRow.mapped.email || null,
            phoneNorm.display || null,
            phoneNorm.digits || null,
            mappedRow.mapped.whatsapp || phoneNorm.display || null,
            consultant.id,
            mappedRow.mapped.consultantName || null,
            mappedRow.mapped.status || "lead",
            mappedRow.mapped.presence || "unknown",
            JSON.stringify(["sheets"]),
            mappedRow.mapped.trainingLabel || null,
            mappedRow.mapped.eventDate || null,
            mappedRow.mapped.observations || null,
            createdAt,
            createdAt,
            createdAt,
            createdAt
          );
          db.prepare(
            `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
             VALUES (?, ?, 'sync', ?, ?, ?)`
          ).run(id("act"), clientId, "Cliente criado via Google Sheets", opts.userId ?? null, createdAt);
        }
        continue;
      }
      const nextSnap = snapshotComparable(mappedRow.mapped, consultant.id);
      const currentSnap = snapshotComparable(
        {
          fullName: existing.full_name,
          email: existing.email,
          phone: existing.phone,
          whatsapp: existing.whatsapp,
          status: existing.status,
          presence: existing.presence,
          trainingLabel: existing.training_label,
          eventDate: existing.event_date,
          observations: existing.observations
        },
        existing.consultant_id ? String(existing.consultant_id) : null
      );
      if (nextSnap === currentSnap) {
        items.push({
          action: "unchanged",
          externalId,
          clientId: String(existing.id),
          message: "Sem altera\xE7\xF5es"
        });
        unchanged += 1;
        continue;
      }
      items.push({
        action: "update",
        externalId,
        clientId: String(existing.id),
        message: `Atualizar: ${mappedRow.mapped.fullName}`,
        mapped: mappedRow.mapped
      });
      updated += 1;
      if (!opts.dryRun) {
        const updatedAt = nowIso();
        const phone = String(mappedRow.mapped.phone || "");
        const phoneNorm = normalizePhone(phone);
        db.prepare(
          `UPDATE clients SET
            full_name = ?, email = ?, phone = ?, phone_normalized = ?, whatsapp = ?,
            consultant_id = ?, consultant_name = ?, status = ?, presence = ?,
            training_label = ?, event_date = ?, observations = ?,
            sheet_row = ?, synced_at = ?, external_updated_at = ?, updated_at = ?, source = 'google_sheets'
           WHERE id = ?`
        ).run(
          mappedRow.mapped.fullName,
          mappedRow.mapped.email || null,
          phoneNorm.display || null,
          phoneNorm.digits || null,
          mappedRow.mapped.whatsapp || phoneNorm.display || null,
          consultant.id,
          mappedRow.mapped.consultantName || null,
          mappedRow.mapped.status || existing.status,
          mappedRow.mapped.presence || existing.presence,
          mappedRow.mapped.trainingLabel || null,
          mappedRow.mapped.eventDate || null,
          mappedRow.mapped.observations || null,
          mappedRow.rowIndex,
          updatedAt,
          updatedAt,
          updatedAt,
          existing.id
        );
        db.prepare(
          `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
           VALUES (?, ?, 'sync', ?, ?, ?)`
        ).run(
          id("act"),
          existing.id,
          "Cliente atualizado via Google Sheets",
          opts.userId ?? null,
          updatedAt
        );
      }
    }
    const status = errors || conflicts ? created || updated ? "partial" : "partial" : "success";
    const finishedAt = nowIso();
    db.prepare(
      `UPDATE sync_runs SET status = ?, finished_at = ?, read_count = ?, created_count = ?, updated_count = ?,
       unchanged_count = ?, skipped_count = ?, conflict_count = ?, error_count = ?, summary_json = ?
       WHERE id = ?`
    ).run(
      status,
      finishedAt,
      rows.length,
      created,
      updated,
      unchanged,
      skipped,
      conflicts,
      errors,
      JSON.stringify({ dryRun: opts.dryRun, clientMode: client.mode }),
      runId
    );
    const insertItem = db.prepare(
      `INSERT INTO sync_items (id, run_id, action, external_id, client_id, message, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      insertItem.run(
        id("syncitem"),
        runId,
        item.action,
        item.externalId ?? null,
        item.clientId ?? null,
        item.message,
        item.mapped ? JSON.stringify(item.mapped) : null
      );
    }
    return {
      runId,
      mode: opts.dryRun ? "dry-run" : "apply",
      status,
      read: rows.length,
      created,
      updated,
      unchanged,
      skipped,
      conflicts,
      errors,
      items,
      clientMode: client.mode
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    db.prepare(
      `UPDATE sync_runs SET status = 'error', finished_at = ?, error_count = 1, summary_json = ? WHERE id = ?`
    ).run(nowIso(), JSON.stringify({ message }), runId);
    return {
      runId,
      mode: opts.dryRun ? "dry-run" : "apply",
      status: "error",
      read: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      conflicts: 0,
      errors: 1,
      items: [{ action: "invalid", message }],
      clientMode: client.mode
    };
  }
}
function listSyncRuns(limit = 20) {
  return db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?").all(limit);
}
function getSyncRun(runId) {
  const run = db.prepare("SELECT * FROM sync_runs WHERE id = ?").get(runId);
  if (!run) return null;
  const items = db.prepare("SELECT * FROM sync_items WHERE run_id = ?").all(runId);
  return { run, items };
}

// server/src/routes/googleSheets.ts
function googleSheetsRoutes() {
  const router = (0, import_express5.Router)();
  router.use(requireAuth);
  router.get("/status", requireAnyPermission("sheets.sync", "settings.view"), (_req, res) => {
    const settings = getSheetSettings();
    const runs = listSyncRuns(1);
    res.json({
      settings,
      lastRun: runs[0] ? {
        id: runs[0].id,
        status: runs[0].status,
        mode: runs[0].mode,
        startedAt: runs[0].started_at,
        finishedAt: runs[0].finished_at,
        created: runs[0].created_count,
        updated: runs[0].updated_count,
        conflicts: runs[0].conflict_count,
        errors: runs[0].error_count
      } : null,
      defaultMappings: DEFAULT_MAPPINGS
    });
  });
  router.put("/config", requirePermission("settings.edit"), (req, res) => {
    const schema = import_zod4.z.object({
      enabled: import_zod4.z.boolean().optional(),
      spreadsheetId: import_zod4.z.string().optional(),
      sheetName: import_zod4.z.string().optional(),
      headerRow: import_zod4.z.number().int().positive().optional(),
      idHeader: import_zod4.z.string().optional(),
      mappings: import_zod4.z.array(
        import_zod4.z.object({
          crmField: import_zod4.z.string(),
          sheetHeader: import_zod4.z.string(),
          required: import_zod4.z.boolean().optional(),
          transform: import_zod4.z.enum([
            "trim",
            "name",
            "phone",
            "email",
            "date",
            "boolean",
            "status",
            "presence",
            "none"
          ]).optional()
        })
      ).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const settings = saveSheetSettings(parsed.data);
    writeAudit("sheets.config_update", { userId: req.user?.id, ip: req.ip });
    res.json(settings);
  });
  router.post("/test", requirePermission("sheets.sync"), async (_req, res) => {
    res.json(await testSheetsConnection());
  });
  router.post("/preview", requirePermission("sheets.sync"), async (req, res) => {
    const result = await runSheetSync({ dryRun: true, userId: req.user?.id });
    writeAudit("sheets.preview", { userId: req.user?.id, meta: { runId: result.runId }, ip: req.ip });
    res.json(result);
  });
  router.post("/sync", requirePermission("sheets.sync"), async (req, res) => {
    const result = await runSheetSync({ dryRun: false, userId: req.user?.id });
    writeAudit("sheets.sync", { userId: req.user?.id, meta: { runId: result.runId }, ip: req.ip });
    res.json(result);
  });
  router.get("/history", requirePermission("sheets.sync"), (_req, res) => {
    res.json(
      listSyncRuns(50).map((r) => ({
        id: r.id,
        source: r.source,
        mode: r.mode,
        status: r.status,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        read: r.read_count,
        created: r.created_count,
        updated: r.updated_count,
        unchanged: r.unchanged_count,
        skipped: r.skipped_count,
        conflicts: r.conflict_count,
        errors: r.error_count,
        userId: r.user_id
      }))
    );
  });
  router.get("/history/:id", requirePermission("sheets.sync"), (req, res) => {
    const data = getSyncRun(req.params.id);
    if (!data) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(data);
  });
  return router;
}

// server/src/routes/courses.ts
var import_express6 = require("express");
var import_zod5 = require("zod");
function mapCourse(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: row.short_name ? String(row.short_name) : null,
    category: String(row.category),
    description: row.description ? String(row.description) : null,
    status: String(row.status),
    priceLabel: row.price_label ? String(row.price_label) : null,
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    currency: String(row.currency || "BRL"),
    markerColor: String(row.marker_color || "gray"),
    stacked: Boolean(row.stacked),
    sheetColumnKey: row.sheet_column_key ? String(row.sheet_column_key) : null,
    sortOrder: Number(row.sort_order || 0),
    capacity: row.capacity == null ? null : Number(row.capacity),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
function mapEvent(row) {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    name: String(row.name),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    dateLabel: row.date_label ? String(row.date_label) : null,
    status: String(row.status),
    location: row.location ? String(row.location) : null,
    capacity: row.capacity == null ? null : Number(row.capacity),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
function mapEnrollment(row) {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    courseId: String(row.course_id),
    eventId: row.event_id ? String(row.event_id) : null,
    status: String(row.status),
    present: Boolean(row.present),
    completed: Boolean(row.completed),
    decision: Boolean(row.decision),
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
function courseMetrics(courseId) {
  const rows = db.prepare("SELECT * FROM enrollments WHERE course_id = ?").all(courseId);
  const participants = rows.length;
  const present = rows.filter((r) => r.present).length;
  const completed = rows.filter((r) => r.completed).length;
  const decisions = rows.filter((r) => r.decision).length;
  return {
    participants,
    present,
    completed,
    decisions,
    conversionRate: present ? Math.round(decisions / present * 100) : 0
  };
}
function coursesRoutes() {
  const router = (0, import_express6.Router)();
  router.use(requireAuth);
  router.get("/", requirePermission("courses.view"), (_req, res) => {
    const rows = db.prepare("SELECT * FROM courses ORDER BY sort_order ASC, name COLLATE NOCASE").all();
    res.json(
      rows.map((row) => ({
        ...mapCourse(row),
        metrics: courseMetrics(String(row.id))
      }))
    );
  });
  router.get("/:id", requirePermission("courses.view"), (req, res) => {
    const row = db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const events = db.prepare("SELECT * FROM course_events WHERE course_id = ? ORDER BY start_date DESC").all(req.params.id).map(mapEvent);
    const enrollments = db.prepare(
      `SELECT e.*, c.full_name as client_name
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           WHERE e.course_id = ?
           ORDER BY c.full_name COLLATE NOCASE`
    ).all(req.params.id).map((e) => ({ ...mapEnrollment(e), clientName: String(e.client_name) }));
    res.json({
      ...mapCourse(row),
      metrics: courseMetrics(String(row.id)),
      events,
      enrollments
    });
  });
  router.post("/", requirePermission("courses.edit"), (req, res) => {
    const schema = import_zod5.z.object({
      name: import_zod5.z.string().min(2),
      shortName: import_zod5.z.string().nullable().optional(),
      category: import_zod5.z.string().default("outro"),
      description: import_zod5.z.string().nullable().optional(),
      status: import_zod5.z.enum(["draft", "scheduled", "active", "completed", "archived"]).default("active"),
      priceLabel: import_zod5.z.string().nullable().optional(),
      priceAmount: import_zod5.z.number().nullable().optional(),
      markerColor: import_zod5.z.enum(["green", "yellow", "gray"]).default("gray"),
      stacked: import_zod5.z.boolean().default(false),
      sheetColumnKey: import_zod5.z.string().nullable().optional(),
      sortOrder: import_zod5.z.number().default(0),
      capacity: import_zod5.z.number().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const courseId = id("course");
    const createdAt = nowIso();
    const d = parsed.data;
    db.prepare(
      `INSERT INTO courses (
        id, name, short_name, category, description, status, price_label, price_amount, currency,
        marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      courseId,
      d.name,
      d.shortName ?? null,
      d.category,
      d.description ?? null,
      d.status,
      d.priceLabel ?? null,
      d.priceAmount ?? null,
      d.markerColor,
      d.stacked ? 1 : 0,
      d.sheetColumnKey ?? null,
      d.sortOrder,
      d.capacity ?? null,
      createdAt,
      createdAt
    );
    writeAudit("courses.create", { userId: req.user?.id, meta: { courseId }, ip: req.ip });
    const row = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId);
    res.status(201).json({ ...mapCourse(row), metrics: courseMetrics(courseId) });
  });
  router.post("/:id/events", requirePermission("courses.edit"), (req, res) => {
    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id);
    if (!course) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const schema = import_zod5.z.object({
      name: import_zod5.z.string().min(2),
      startDate: import_zod5.z.string().nullable().optional(),
      endDate: import_zod5.z.string().nullable().optional(),
      dateLabel: import_zod5.z.string().nullable().optional(),
      status: import_zod5.z.string().default("scheduled"),
      location: import_zod5.z.string().nullable().optional(),
      capacity: import_zod5.z.number().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const eventId = id("event");
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      req.params.id,
      parsed.data.name,
      parsed.data.startDate ?? null,
      parsed.data.endDate ?? null,
      parsed.data.dateLabel ?? null,
      parsed.data.status,
      parsed.data.location ?? null,
      parsed.data.capacity ?? null,
      createdAt,
      createdAt
    );
    const row = db.prepare("SELECT * FROM course_events WHERE id = ?").get(eventId);
    res.status(201).json(mapEvent(row));
  });
  router.post("/:id/enrollments", requirePermission("courses.edit"), (req, res) => {
    const schema = import_zod5.z.object({
      clientId: import_zod5.z.string(),
      eventId: import_zod5.z.string().nullable().optional(),
      status: import_zod5.z.string().default("inscrito"),
      present: import_zod5.z.boolean().default(false),
      completed: import_zod5.z.boolean().default(false),
      decision: import_zod5.z.boolean().default(false),
      notes: import_zod5.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const enrollmentId = id("enr");
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO enrollments (
        id, client_id, course_id, event_id, status, present, completed, decision, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      enrollmentId,
      parsed.data.clientId,
      req.params.id,
      parsed.data.eventId ?? null,
      parsed.data.status,
      parsed.data.present ? 1 : 0,
      parsed.data.completed ? 1 : 0,
      parsed.data.decision ? 1 : 0,
      parsed.data.notes ?? null,
      createdAt,
      createdAt
    );
    const row = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId);
    res.status(201).json(mapEnrollment(row));
  });
  router.patch("/enrollments/:enrollmentId", requirePermission("courses.edit"), (req, res) => {
    const existing = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(req.params.enrollmentId);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const schema = import_zod5.z.object({
      present: import_zod5.z.boolean().optional(),
      completed: import_zod5.z.boolean().optional(),
      decision: import_zod5.z.boolean().optional(),
      status: import_zod5.z.string().optional(),
      notes: import_zod5.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const d = parsed.data;
    const updatedAt = nowIso();
    db.prepare(
      `UPDATE enrollments SET
        present = ?, completed = ?, decision = ?, status = ?, notes = ?,
        completed_at = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      d.present ?? existing.present,
      d.completed ?? existing.completed,
      d.decision ?? existing.decision,
      d.status ?? existing.status,
      d.notes !== void 0 ? d.notes : existing.notes,
      d.completed ? updatedAt : existing.completed_at,
      d.decision ? updatedAt : existing.decided_at,
      updatedAt,
      req.params.enrollmentId
    );
    const row = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(req.params.enrollmentId);
    res.json(mapEnrollment(row));
  });
  return router;
}

// server/src/routes/crmExtra.ts
var import_express7 = require("express");
var import_zod6 = require("zod");
function crmExtraRoutes() {
  const router = (0, import_express7.Router)();
  router.use(requireAuth);
  router.get("/pipeline/stages", requirePermission("clients.view"), (_req, res) => {
    const rows = db.prepare("SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY sort_order").all();
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        sortOrder: Number(r.sort_order),
        color: r.color ? String(r.color) : null
      }))
    );
  });
  router.get("/pipeline/board", requirePermission("clients.view"), (req, res) => {
    const stages = db.prepare("SELECT * FROM pipeline_stages WHERE active = 1 ORDER BY sort_order").all();
    let clients = db.prepare(
      `SELECT id, full_name, preferred_name, consultant_id, consultant_name, status, pipeline_stage, next_action, next_action_at
         FROM clients ORDER BY updated_at DESC`
    ).all();
    const scope = consultantScopeId(req.user);
    if (scope) {
      clients = clients.filter((c) => String(c.consultant_id || "") === scope);
    }
    res.json({
      stages: stages.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        slug: String(s.slug),
        color: s.color ? String(s.color) : null,
        clients: clients.filter((c) => String(c.pipeline_stage || "novo") === String(s.slug)).map((c) => ({
          id: String(c.id),
          fullName: String(c.full_name),
          preferredName: c.preferred_name ? String(c.preferred_name) : null,
          consultantName: c.consultant_name ? String(c.consultant_name) : null,
          status: String(c.status),
          nextAction: c.next_action ? String(c.next_action) : null,
          nextActionAt: c.next_action_at ? String(c.next_action_at) : null
        }))
      }))
    });
  });
  router.post("/pipeline/move", requirePermission("clients.edit"), (req, res) => {
    const schema = import_zod6.z.object({
      clientId: import_zod6.z.string().min(1),
      stageSlug: import_zod6.z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const stage = db.prepare("SELECT slug FROM pipeline_stages WHERE slug = ? AND active = 1").get(parsed.data.stageSlug);
    if (!stage) {
      res.status(400).json({ error: "invalid_stage" });
      return;
    }
    const existing = db.prepare("SELECT id, pipeline_stage, consultant_id FROM clients WHERE id = ?").get(parsed.data.clientId);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!assertClientAccess(req.user, existing.consultant_id)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const updatedAt = nowIso();
    db.prepare("UPDATE clients SET pipeline_stage = ?, updated_at = ? WHERE id = ?").run(
      parsed.data.stageSlug,
      updatedAt,
      parsed.data.clientId
    );
    db.prepare(
      `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
       VALUES (?, ?, 'status_change', ?, ?, ?)`
    ).run(
      id("act"),
      parsed.data.clientId,
      `Pipeline: ${existing.pipeline_stage || "novo"} \u2192 ${parsed.data.stageSlug}`,
      req.user?.id ?? null,
      updatedAt
    );
    res.json({ ok: true, clientId: parsed.data.clientId, stageSlug: parsed.data.stageSlug });
  });
  router.get("/tasks", requirePermission("clients.view"), (req, res) => {
    const status = String(req.query.status || "open");
    const rows = status === "all" ? db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() : db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC").all(status);
    res.json(
      rows.map((t) => ({
        id: String(t.id),
        clientId: t.client_id ? String(t.client_id) : null,
        consultantId: t.consultant_id ? String(t.consultant_id) : null,
        assigneeUserId: t.assignee_user_id ? String(t.assignee_user_id) : null,
        title: String(t.title),
        description: t.description ? String(t.description) : null,
        status: String(t.status),
        priority: String(t.priority),
        dueAt: t.due_at ? String(t.due_at) : null,
        completedAt: t.completed_at ? String(t.completed_at) : null,
        createdAt: String(t.created_at),
        updatedAt: String(t.updated_at)
      }))
    );
  });
  router.post("/tasks", requirePermission("clients.edit"), (req, res) => {
    const schema = import_zod6.z.object({
      title: import_zod6.z.string().min(2),
      description: import_zod6.z.string().nullable().optional(),
      clientId: import_zod6.z.string().nullable().optional(),
      consultantId: import_zod6.z.string().nullable().optional(),
      priority: import_zod6.z.enum(["low", "medium", "high"]).default("medium"),
      dueAt: import_zod6.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const taskId = id("task");
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO tasks (id, client_id, consultant_id, assignee_user_id, title, description, status, priority, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
    ).run(
      taskId,
      parsed.data.clientId ?? null,
      parsed.data.consultantId ?? null,
      req.user?.id ?? null,
      parsed.data.title,
      parsed.data.description ?? null,
      parsed.data.priority,
      parsed.data.dueAt ?? null,
      createdAt,
      createdAt
    );
    res.status(201).json({ id: taskId });
  });
  router.patch("/tasks/:id", requirePermission("clients.edit"), (req, res) => {
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const status = req.body?.status ? String(req.body.status) : String(existing.status);
    const updatedAt = nowIso();
    db.prepare(
      `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`
    ).run(status, status === "done" ? updatedAt : null, updatedAt, req.params.id);
    res.json({ ok: true });
  });
  router.get("/notifications", requirePermission("dashboard.view"), (req, res) => {
    const rows = db.prepare(
      `SELECT * FROM notifications
         WHERE user_id IS NULL OR user_id = ?
         ORDER BY created_at DESC LIMIT 50`
    ).all(req.user.id);
    res.json(
      rows.map((n) => ({
        id: String(n.id),
        type: String(n.type),
        title: String(n.title),
        body: n.body ? String(n.body) : null,
        href: n.href ? String(n.href) : null,
        readAt: n.read_at ? String(n.read_at) : null,
        createdAt: String(n.created_at)
      }))
    );
  });
  router.post("/notifications/:id/read", requirePermission("dashboard.view"), (req, res) => {
    const result = db.prepare(
      `UPDATE notifications SET read_at = ?
         WHERE id = ? AND (user_id IS NULL OR user_id = ?)`
    ).run(nowIso(), req.params.id, req.user.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  });
  router.get("/search", requirePermission("dashboard.view"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q) {
      res.json({ clients: [], consultants: [], courses: [] });
      return;
    }
    const scope = consultantScopeId(req.user);
    const clients = db.prepare("SELECT id, full_name, email, phone, consultant_id FROM clients").all().filter((c) => !scope || String(c.consultant_id || "") === scope).filter(
      (c) => [c.full_name, c.email, c.phone].filter(Boolean).join(" ").toLowerCase().includes(q)
    ).slice(0, 8).map((c) => ({
      id: String(c.id),
      label: String(c.full_name),
      meta: String(c.phone || c.email || ""),
      href: `/app/clientes/${c.id}`
    }));
    const consultants = db.prepare("SELECT id, name, email FROM consultants").all().filter(
      (c) => [c.name, c.email].filter(Boolean).join(" ").toLowerCase().includes(q)
    ).slice(0, 5).map((c) => ({
      id: String(c.id),
      label: String(c.name),
      meta: String(c.email || ""),
      href: `/app/consultores`
    }));
    const courses = db.prepare("SELECT id, name, category FROM courses").all().filter((c) => String(c.name).toLowerCase().includes(q)).slice(0, 5).map((c) => ({
      id: String(c.id),
      label: String(c.name),
      meta: String(c.category),
      href: `/app/cursos/${c.id}`
    }));
    res.json({ clients, consultants, courses });
  });
  return router;
}

// server/src/routes/ficha.ts
var import_express8 = require("express");
var import_zod7 = require("zod");

// server/src/lib/legacyCatalog.ts
var GOLDEN_FICHA_LAYOUT = {
  logo: { x: 5.5, y: 15, width: 21 },
  title: { x: 27.5, y: 21.5, width: 113.5 },
  nameText: { x: 157, y: 22.5, width: 53.5, fontSize: 64 },
  nameLineMain: { x: 159.7, y: 31.3, width: 51, thickness: 0.45 },
  nameLineShort: { x: 168.2, y: 34.5, width: 40, thickness: 0.45 },
  labels: { x: 181.2, y: 0, gap: 15.2 },
  certContainer: { x: 10, y: 254.6, width: 172.4 },
  certLogo: { x: 13, y: 255.5, width: 10.8 },
  certTitle: { x: 24, y: 258.5, width: 34, fontSize: 18 },
  certSubtitle: { x: 24.5, y: 264, width: 60.5, fontSize: 11.8 },
  certGreen: { x: 96.5, y: 259, width: 20.5, fontSize: 10.4 },
  certGold: { x: 120.5, y: 258.8, width: 20.5, fontSize: 10.4 },
  certPersonal: { x: 144.5, y: 258.5, width: 36.5, fontSize: 10.4 },
  certTotalBox: { x: 182.4, y: 254.6, width: 17.6 },
  certTotalLabel: { x: 183.4, y: 256.4, width: 18.5, fontSize: 11.7 },
  certTotalValue: { x: 186.3, y: 261, width: 5.5, fontSize: 30.6 },
  customItems: []
};
var LEGACY_COURSES = [
  {
    id: "m-cis",
    name: "M\xE9todo CIS",
    description: "Reprograme a raiz de todos os seus problemas, mude seu estilo de vida e construa uma vida extraordin\xE1ria em 3 dias de imers\xE3o.",
    priceLabel: "R$ 1.997,00",
    dateLabel: "pr\xF3xima data 15 a 17 | OUT",
    markerColor: "green",
    stacked: false,
    sortOrder: 1
  },
  {
    id: "fcis",
    name: "FCIS - Forma\xE7\xE3o em Coaching Integral Sist\xEAmico",
    description: "Tenha mais sa\xFAde, performance e bem-estar atrav\xE9s de poderosas ferramentas da neuroci\xEAncia e do coaching integral sist\xEAmico.",
    priceLabel: "R$ 10.796,40",
    dateLabel: "1\xBA M 22 a 25 | SET 2\xBA M 27 a 30 | OUT",
    markerColor: "yellow",
    stacked: true,
    sortOrder: 2
  },
  {
    id: "ml5",
    name: "ML5 - Forma\xE7\xE3o de L\xEDderes",
    description: "Desenvolva maestria empresarial, torne-se um l\xEDder com os 5 n\xEDveis de excel\xEAncia e alavanque os seus resultados no mundo dos neg\xF3cios.",
    priceLabel: "R$ 7.197,00",
    dateLabel: "pr\xF3xima data 01 a 04 | NOV",
    markerColor: "yellow",
    stacked: true,
    sortOrder: 3
  },
  {
    id: "if",
    name: "IF - Intelig\xEAncia Financeira",
    description: "Descubra o verdadeiro caminho para riqueza financeira que habita dentro de voc\xEA, atrav\xE9s do alinhamento das suas cren\xE7as e emo\xE7\xF5es.",
    priceLabel: "R$ 3.596,40",
    dateLabel: "pr\xF3xima data  10 a 12 | NOV",
    markerColor: "green",
    stacked: false,
    sortOrder: 4
  },
  {
    id: "fgpc",
    name: "FGPC - Forma\xE7\xE3o em Gest\xE3o de Pessoas com Perfil Comportamental",
    description: "Desenvolva suas potencialidades, alcance relacionamentos mais harmoniosos e melhore sua autoestima, persuas\xE3o e comunica\xE7\xE3o.",
    priceLabel: "R$ 5.996,40",
    dateLabel: "pr\xF3xima data 1\xBA sem. 2027",
    markerColor: "green",
    stacked: false,
    sortOrder: 5
  },
  {
    id: "bhp",
    name: "BHP - Gest\xE3o de Neg\xF3cios",
    description: "Revolucione o seu desempenho e o desempenho dos profissionais da sua empresa com t\xE9cnicas e ferramentas modernas de gest\xE3o.",
    priceLabel: "R$ 5.996,40",
    dateLabel: "pr\xF3xima data 1\xBA sem. 2027",
    markerColor: "green",
    stacked: false,
    sortOrder: 6
  },
  {
    id: "ceop",
    name: "CEOP - Comunica\xE7\xE3o Eficaz e Orat\xF3ria Persuasiva",
    description: "Potencialize a sua habilidade de comunica\xE7\xE3o verbal e n\xE3o verbal, transmitindo mais poder, convencimento e influ\xEAncia.",
    priceLabel: "R$ 5.996,40",
    dateLabel: "pr\xF3xima data 15 a 17 | SET",
    markerColor: "yellow",
    stacked: false,
    sortOrder: 7
  },
  {
    id: "master",
    name: "Master Coaching",
    description: "Acesse e potencialize todo o poder que habita dentro de voc\xEA atrav\xE9s do alinhamento das suas cren\xE7as, emo\xE7\xF5es e habilidades t\xE9cnicas.",
    priceLabel: "R$ 7.796,40",
    dateLabel: "pr\xF3xima data 14 a 18 | DEZ",
    markerColor: "yellow",
    stacked: false,
    sortOrder: 8
  },
  {
    id: "tv",
    name: "TV - T\xE9cnicas Avan\xE7adas de Vendas",
    description: "Estrat\xE9gias para escalar o faturamento da sua empresa, atraindo novos compradores e fidelizando os clientes.",
    priceLabel: "R$ 2.997,00",
    dateLabel: "pr\xF3xima data 1\xBA sem. 2027",
    markerColor: "gray",
    stacked: false,
    sortOrder: 9
  },
  {
    id: "lider",
    name: "LL PASS - L\xEDder de L\xEDderes, JANTAR DE NETWORKING",
    description: "Conectando pessoas certas para resultados extraordin\xE1rios.",
    priceLabel: "R$ 3.600,00",
    dateLabel: "pr\xF3xima data 05 | SET",
    markerColor: "gray",
    stacked: false,
    sortOrder: 10
  },
  {
    id: "pep",
    name: "Planejamento Estrat\xE9gico na Pr\xE1tica",
    description: "M\xE9todo estrat\xE9gico utilizado pela FEBRACIS para grandes empresas, visando aumentar seu faturamento e engajar sua equipe.",
    priceLabel: "R$ 10.997,00",
    dateLabel: "pr\xF3xima data 15 a 18 | DEZ",
    markerColor: "gray",
    stacked: false,
    sortOrder: 11
  },
  {
    id: "intercoaching-business",
    name: "Intercoaching Business",
    description: "Um evento para voc\xEA mergulhar em uma atmosfera de inova\xE7\xE3o e criatividade, ideal para antecipar-se ao mercado.",
    priceLabel: "\xE0 consultar",
    dateLabel: "pr\xF3xima data 10 a 12 | DEZ",
    markerColor: "gray",
    stacked: false,
    sortOrder: 12
  },
  {
    id: "maestria",
    name: "Maestria Empresarial",
    description: "Junte-se a um ecossistema de grandes empres\xE1rios determinados a crescer e descobrir experi\xEAncias transformadoras.",
    priceLabel: "\xE0 consultar",
    dateLabel: "\xE0 consultar \u2014 acesso anual",
    markerColor: "gray",
    stacked: false,
    sortOrder: 13
  },
  {
    id: "ci",
    name: "Coaching Individual",
    description: "Viva um processo transformador para potencializar suas cren\xE7as fortalecedoras e alcan\xE7ar uma nova vers\xE3o de si mesmo.",
    priceLabel: "\xE0 consultar",
    dateLabel: "\xE0 consultar \u2014 10 sess\xF5es individuais",
    markerColor: "gray",
    stacked: false,
    sortOrder: 14
  }
];

// server/src/routes/ficha.ts
var DEFAULT_FICHA_LAYOUT = GOLDEN_FICHA_LAYOUT;
function ensureDefaultLayout() {
  const existing = db.prepare("SELECT id, version, updated_by FROM ficha_layouts WHERE is_default = 1").get();
  if (!existing) {
    db.prepare(
      `INSERT INTO ficha_layouts (id, name, version, layout_json, is_default, updated_at)
       VALUES (?, 'Padr\xE3o FEBRACIS Legacy', 1, ?, 1, ?)`
    ).run(id("layout"), JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso());
    return;
  }
  if (!existing.updated_by) {
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = 'Padr\xE3o FEBRACIS Legacy', updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso(), existing.id);
  }
}
function ensureLegacyCourses() {
  const now = nowIso();
  const insert = db.prepare(
    `INSERT INTO courses (
      id, name, short_name, category, description, status, price_label, price_amount, currency,
      marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
    ) VALUES (?, ?, NULL, 'catalog', ?, 'active', ?, NULL, 'BRL', ?, ?, NULL, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      price_label = excluded.price_label,
      marker_color = excluded.marker_color,
      stacked = excluded.stacked,
      sort_order = excluded.sort_order,
      status = 'active',
      updated_at = excluded.updated_at`
  );
  for (const c of LEGACY_COURSES) {
    insert.run(
      c.id,
      c.name,
      c.description,
      c.priceLabel,
      c.markerColor,
      c.stacked ? 1 : 0,
      c.sortOrder,
      now,
      now
    );
  }
  for (const c of LEGACY_COURSES) {
    const ev = db.prepare(
      `SELECT id FROM course_events WHERE course_id = ? ORDER BY start_date DESC LIMIT 1`
    ).get(c.id);
    if (ev) {
      db.prepare(`UPDATE course_events SET date_label = ? WHERE id = ?`).run(c.dateLabel, ev.id);
    } else {
      db.prepare(
        `INSERT INTO course_events (
          id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, NULL, ?, 'scheduled', 'Chapec\xF3', NULL, ?, ?)`
      ).run(id("evt"), c.id, c.name, c.dateLabel, now, now);
    }
  }
}
function fichaRoutes() {
  const router = (0, import_express8.Router)();
  router.use(requireAuth);
  ensureDefaultLayout();
  ensureLegacyCourses();
  router.get("/layout", requirePermission("clients.print"), (_req, res) => {
    const row = db.prepare("SELECT * FROM ficha_layouts WHERE is_default = 1").get();
    res.json({
      id: row ? String(row.id) : null,
      name: row ? String(row.name) : "Padr\xE3o",
      version: row ? Number(row.version) : 1,
      layout: row ? parseJson(String(row.layout_json), DEFAULT_FICHA_LAYOUT) : DEFAULT_FICHA_LAYOUT,
      updatedAt: row ? String(row.updated_at) : null
    });
  });
  router.put("/layout", requirePermission("ficha.edit"), (req, res) => {
    const schema = import_zod7.z.object({
      layout: import_zod7.z.record(import_zod7.z.any()),
      name: import_zod7.z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    ensureDefaultLayout();
    const current = db.prepare("SELECT * FROM ficha_layouts WHERE is_default = 1").get();
    const updatedAt = nowIso();
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = COALESCE(?, name), version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?`
    ).run(
      JSON.stringify(parsed.data.layout),
      parsed.data.name ?? null,
      updatedAt,
      req.user?.id ?? null,
      current.id
    );
    const row = db.prepare("SELECT * FROM ficha_layouts WHERE id = ?").get(current.id);
    res.json({
      id: String(row.id),
      version: Number(row.version),
      layout: parseJson(String(row.layout_json), DEFAULT_FICHA_LAYOUT),
      updatedAt: String(row.updated_at)
    });
  });
  router.post("/layout/reset", requirePermission("ficha.edit"), (req, res) => {
    ensureDefaultLayout();
    const current = db.prepare("SELECT id FROM ficha_layouts WHERE is_default = 1").get();
    db.prepare(
      `UPDATE ficha_layouts SET layout_json = ?, name = 'Padr\xE3o FEBRACIS Legacy', version = version + 1, updated_at = ?, updated_by = NULL WHERE id = ?`
    ).run(JSON.stringify(DEFAULT_FICHA_LAYOUT), nowIso(), current.id);
    res.json({ layout: DEFAULT_FICHA_LAYOUT });
  });
  router.get("/data/:clientId", requirePermission("clients.print"), (req, res) => {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.clientId);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!assertClientAccess(req.user, client.consultant_id ? String(client.consultant_id) : null)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const courses = db.prepare(
      `SELECT * FROM courses WHERE status IN ('active','scheduled','completed') ORDER BY sort_order ASC`
    ).all();
    const enrollments = db.prepare("SELECT * FROM enrollments WHERE client_id = ?").all(req.params.clientId);
    const byCourse = new Map(enrollments.map((e) => [String(e.course_id), e]));
    const legacy = parseJson(String(client.courses_json || "[]"), []);
    const catalogDates = new Map(LEGACY_COURSES.map((c) => [c.id, c.dateLabel]));
    const rows = courses.map((course) => {
      const enr = byCourse.get(String(course.id));
      const leg = legacy.find((l) => l.courseId === String(course.id));
      const event = db.prepare(
        `SELECT date_label, start_date FROM course_events WHERE course_id = ? ORDER BY start_date DESC LIMIT 1`
      ).get(String(course.id));
      return {
        courseId: String(course.id),
        name: String(course.name),
        description: course.description ? String(course.description) : "",
        priceLabel: course.price_label ? String(course.price_label) : "",
        dateLabel: event?.date_label || event?.start_date || catalogDates.get(String(course.id)) || "",
        markerColor: String(course.marker_color || "gray"),
        stacked: Boolean(course.stacked),
        completed: enr ? Boolean(enr.completed) : Boolean(leg?.completed),
        decision: enr ? Boolean(enr.decision) : Boolean(leg?.decision)
      };
    });
    const layoutRow = db.prepare("SELECT layout_json FROM ficha_layouts WHERE is_default = 1").get();
    const totalMarked = rows.filter((r) => r.completed || r.decision).length;
    res.json({
      client: {
        id: String(client.id),
        fullName: String(client.full_name),
        preferredName: client.preferred_name ? String(client.preferred_name) : null,
        consultantName: client.consultant_name ? String(client.consultant_name) : null
      },
      courses: rows,
      totalMarked,
      totalCompleted: rows.filter((r) => r.completed).length,
      layout: layoutRow ? parseJson(layoutRow.layout_json, DEFAULT_FICHA_LAYOUT) : DEFAULT_FICHA_LAYOUT
    });
  });
  router.get("/mass", requirePermission("print.mass"), (req, res) => {
    const consultantId = String(req.query.consultantId || "");
    let clients = db.prepare("SELECT id, full_name, consultant_id FROM clients").all();
    const scope = consultantScopeId(req.user);
    if (scope) {
      clients = clients.filter((c) => String(c.consultant_id || "") === scope);
    } else if (consultantId) {
      clients = clients.filter((c) => String(c.consultant_id || "") === consultantId);
    }
    res.json({
      clientIds: clients.map((c) => String(c.id)),
      count: clients.length
    });
  });
  return router;
}

// server/src/routes/reports.ts
var import_express9 = require("express");
function reportsRoutes() {
  const router = (0, import_express9.Router)();
  router.use(requireAuth, requirePermission("reports.view"));
  router.get("/summary", (req, res) => {
    const consultantId = String(req.query.consultantId || "");
    let clients = db.prepare("SELECT * FROM clients").all();
    if (consultantId) {
      clients = clients.filter((c) => String(c.consultant_id || "") === consultantId);
    }
    const byStatus = {};
    const byPresence = {};
    for (const c of clients) {
      byStatus[String(c.status)] = (byStatus[String(c.status)] || 0) + 1;
      byPresence[String(c.presence)] = (byPresence[String(c.presence)] || 0) + 1;
    }
    const enrollments = db.prepare("SELECT * FROM enrollments").all();
    const decisions = enrollments.filter((e) => e.decision).length;
    const completed = enrollments.filter((e) => e.completed).length;
    const tasksOpen = Number(
      db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status = 'open'`).get().c
    );
    res.json({
      clients: clients.length,
      byStatus,
      byPresence,
      enrollments: enrollments.length,
      decisions,
      completed,
      tasksOpen,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  router.get("/consultants", (_req, res) => {
    const consultants = db.prepare("SELECT * FROM consultants").all();
    const result = consultants.map((cons) => {
      const clients = db.prepare("SELECT * FROM clients WHERE consultant_id = ?").all(cons.id);
      let decisions = 0;
      for (const client of clients) {
        const enrCount = Number(
          db.prepare("SELECT COUNT(*) as c FROM enrollments WHERE client_id = ? AND decision = 1").get(client.id).c
        );
        if (enrCount > 0) {
          decisions += enrCount;
        } else {
          const courses = parseJson(
            String(client.courses_json || "[]"),
            []
          );
          decisions += courses.filter((c) => c.decision).length;
        }
      }
      return {
        id: String(cons.id),
        name: String(cons.name),
        clients: clients.length,
        present: clients.filter((c) => String(c.presence) === "present").length,
        decisions,
        active: clients.filter(
          (c) => ["active", "negotiating", "won"].includes(String(c.status))
        ).length
      };
    });
    res.json(result);
  });
  return router;
}

// server/src/routes/ops.ts
var import_express10 = require("express");
var import_zod8 = require("zod");

// server/src/services/ops/turmaHealth.ts
function daysUntil(isoDate, now) {
  if (!isoDate) return null;
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / 864e5);
}
function computeTurmaHealth(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const confirmados = Math.max(0, input.confirmados);
  const matriculados = Math.max(0, input.matriculados);
  const metaMin = input.metaMinima ?? null;
  const metaIdeal = input.metaIdeal ?? null;
  const capacity = input.capacity ?? null;
  const dias = daysUntil(input.startDate, now);
  const faltaMetaMinima = metaMin == null ? null : Math.max(0, metaMin - confirmados);
  const faltaMetaIdeal = metaIdeal == null ? null : Math.max(0, metaIdeal - confirmados);
  const vagasCapacidade = capacity == null ? null : Math.max(0, capacity - matriculados);
  const ocupacaoMeta = metaMin && metaMin > 0 ? Math.round(confirmados / metaMin * 1e3) / 10 : null;
  const ocupacaoCapacidade = capacity && capacity > 0 ? Math.round(matriculados / capacity * 1e3) / 10 : null;
  const ritmoNecessarioDia = faltaMetaMinima != null && dias != null && dias > 0 ? Math.round(faltaMetaMinima / dias * 100) / 100 : faltaMetaMinima != null && dias != null && dias <= 0 ? faltaMetaMinima : null;
  const velocity = input.ritmo7d ?? input.ritmo14d ?? input.ritmoHistorico ?? null;
  let forecastConfirmados = null;
  let desvioForecastMeta = null;
  if (velocity != null && dias != null && dias > 0) {
    forecastConfirmados = Math.round(confirmados + velocity * dias);
    if (metaMin != null) desvioForecastMeta = forecastConfirmados - metaMin;
  }
  const reasons = [];
  let prioridade = "SEM_ACAO";
  if (input.status === "CANCELADA" || input.status === "ENCERRADA") {
    prioridade = "SEM_ACAO";
    reasons.push("Turma encerrada ou cancelada");
  } else if (metaMin == null || metaMin <= 0) {
    prioridade = "DEFINIR_META";
    reasons.push("Meta m\xEDnima n\xE3o definida");
  } else if (confirmados >= metaMin) {
    prioridade = "META_ATINGIDA";
    reasons.push("Meta m\xEDnima atingida");
  } else if (dias != null && dias <= 7 && (ocupacaoMeta ?? 0) < 60) {
    prioridade = "CRITICA";
    reasons.push("\u22647 dias e ocupa\xE7\xE3o da meta < 60%");
  } else if (dias != null && dias <= 14 && (ocupacaoMeta ?? 0) < 75) {
    prioridade = "ALTA";
    reasons.push("\u226414 dias e ocupa\xE7\xE3o da meta < 75%");
  } else if (ritmoNecessarioDia != null && ritmoNecessarioDia >= 2) {
    prioridade = "ALTA";
    reasons.push("Ritmo necess\xE1rio \u2265 2 confirma\xE7\xF5es/dia");
  } else if ((ocupacaoMeta ?? 100) < 85) {
    prioridade = "ATENCAO";
    reasons.push("Ocupa\xE7\xE3o da meta < 85%");
  } else {
    prioridade = "SAUDAVEL";
    reasons.push("Dentro do ritmo esperado");
  }
  if (desvioForecastMeta != null && desvioForecastMeta < 0 && prioridade === "SAUDAVEL") {
    prioridade = "ATENCAO";
    reasons.push(`Forecast abaixo da meta (${desvioForecastMeta})`);
  }
  return {
    matriculados,
    confirmados,
    faltaMetaMinima,
    faltaMetaIdeal,
    vagasCapacidade,
    ocupacaoMeta,
    ocupacaoCapacidade,
    diasParaInicio: dias,
    ritmoNecessarioDia,
    forecastConfirmados,
    desvioForecastMeta,
    prioridade,
    reasons
  };
}

// server/src/services/ops/historicalImport.ts
var import_node_crypto3 = require("node:crypto");

// server/src/services/ops/schemaDetector.ts
var ALIASES = {
  personName: ["aluno", "alunos", "cliente", "clientes", "nome", "nome completo", "participante"],
  cpf: ["cpf", "cpf/cnpj", "cnpj", "documento"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefone", "fone", "celular", "tel"],
  whatsapp: ["whatsapp", "whats", "zap"],
  consultant: ["consultor", "consultora", "vendedor", "respons\xE1vel", "responsavel"],
  confirmationStatus: [
    "confirma\xE7\xE3o",
    "confirmacao",
    "status",
    "status vaga",
    "status confirma\xE7\xE3o",
    "status confirmacao"
  ],
  presence: ["presente", "presen\xE7a", "presenca", "presence"],
  grade: ["grade", "faixa", "n\xEDvel", "nivel"],
  matriculaSales: ["matricula sales", "matr\xEDcula sales", "matricula", "salesforce matr\xEDcula"],
  observation: ["observa\xE7\xE3o", "observacao", "obs", "obs./contato", "obs/contato", "obs contato"],
  contact1: ["1\xBA contato", "1o contato", "1 contato", "primeiro contato"],
  contact2: ["2\xBA contato", "2o contato", "2 contato", "segundo contato"],
  contact3: ["3\xBA contato", "3o contato", "3 contato", "terceiro contato"],
  contact4: ["4\xBA contato", "4o contato", "4 contato", "quarto contato"],
  salesforceId: ["salesforce id", "sf id", "id salesforce"],
  salesforceUrl: ["salesforce", "sf url", "link salesforce", "url salesforce"],
  financial: ["financeiro", "pagamento", "status pagamento", "financeiro status"],
  ignored: []
};
function normHeader(h) {
  return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function detectSchema(headers) {
  const mapping = {};
  const used = /* @__PURE__ */ new Set();
  const unknownHeaders = [];
  for (const header of headers) {
    const n = normHeader(header);
    if (!n) {
      mapping[header] = "ignored";
      continue;
    }
    let hit = null;
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (field === "ignored") continue;
      if (aliases.some((a) => n === normHeader(a) || n.includes(normHeader(a)))) {
        if ((field === "personName" || field === "cpf" || field === "email") && used.has(field)) {
          continue;
        }
        hit = field;
        break;
      }
    }
    if (hit) {
      mapping[header] = hit;
      used.add(hit);
    } else {
      mapping[header] = "unknown";
      unknownHeaders.push(header);
    }
  }
  const knownFields = [...used];
  const missingRequired = [];
  if (!used.has("personName")) missingRequired.push("personName");
  const mappedCount = Object.values(mapping).filter((v) => v !== "unknown" && v !== "ignored").length;
  const confidence = headers.length === 0 ? 0 : Math.max(0, Math.min(1, mappedCount / Math.max(headers.length, 1)));
  const fingerprint = headers.map(normHeader).filter(Boolean).join("|");
  return {
    fingerprint,
    mapping,
    confidence,
    knownFields,
    unknownHeaders,
    missingRequired
  };
}
function mapRowValues(headers, values, detection) {
  const out = {
    unknowns: {}
  };
  headers.forEach((h, i) => {
    const field = detection.mapping[h];
    const val = values[i] ?? "";
    if (!field || field === "ignored") return;
    if (field === "unknown") {
      if (val.trim()) out.unknowns[h] = val;
      return;
    }
    out[field] = val;
  });
  return out;
}

// server/src/services/ops/courseResolve.ts
var COURSE_ALIASES = {
  mcis: "m-cis",
  "m-cis": "m-cis",
  "m\xE9todo cis": "m-cis",
  metodo: "m-cis",
  if: "if",
  ceop: "ceop",
  ml5: "ml5",
  bhp: "bhp",
  fcis: "fcis",
  pep: "pep",
  fgpc: "fgpc",
  tv: "tv",
  lider: "lider",
  master: "master",
  ci: "ci",
  maestria: "maestria"
};
function resolveCourseId(hint) {
  const key = hint.trim().toLowerCase();
  const alias = COURSE_ALIASES[key];
  if (alias) {
    const row = db.prepare("SELECT id FROM courses WHERE id = ?").get(alias);
    if (row) return row.id;
  }
  const byId = db.prepare("SELECT id FROM courses WHERE lower(id) = ?").get(key);
  if (byId) return byId.id;
  const byShort = db.prepare("SELECT id FROM courses WHERE lower(short_name) = ? OR lower(name) LIKE ? LIMIT 1").get(key, `%${key}%`);
  return byShort?.id ?? null;
}
function ensureUnknownCourseId() {
  const existing = db.prepare(`SELECT id FROM courses WHERE id = 'course_unknown'`).get();
  if (existing) return existing.id;
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO courses (
      id, name, short_name, category, description, status, price_label, marker_color,
      stacked, sort_order, created_at, updated_at
    ) VALUES ('course_unknown', 'Hist\xF3rico / Sem cat\xE1logo', 'UNKNOWN', 'ops',
      'Curso placeholder para inscri\xE7\xF5es hist\xF3ricas sem match de cat\xE1logo',
      'active', NULL, 'gray', 0, 9999, ?, ?)`
  ).run(createdAt, createdAt);
  return "course_unknown";
}
function ensureDemoOpenTurmas() {
  const demos = [
    {
      key: "demo-ceop-06",
      courseId: "ceop",
      courseName: "CEOP",
      turmaLabel: "CEOP 06",
      days: 12,
      metaMinima: 50,
      metaIdeal: 60,
      capacity: 70,
      matriculados: 28,
      confirmados: 25
    },
    {
      key: "demo-ml5-04",
      courseId: "ml5",
      courseName: "ML5",
      turmaLabel: "ML5 04",
      days: 7,
      metaMinima: 40,
      metaIdeal: 50,
      capacity: 55,
      matriculados: 18,
      confirmados: 14
    },
    {
      key: "demo-if-10",
      courseId: "if",
      courseName: "IF",
      turmaLabel: "IF 10",
      days: 20,
      metaMinima: null,
      metaIdeal: null,
      capacity: 80,
      matriculados: 5,
      confirmados: 3
    }
  ];
  for (const d of demos) {
    const existing = db.prepare("SELECT id FROM training_classes WHERE external_id = ?").get(d.key);
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() + d.days);
    const startDate = start.toISOString().slice(0, 10);
    if (existing) {
      db.prepare(
        `UPDATE training_classes SET
          start_date = ?, status = 'EM_CAPTACAO', meta_minima = ?, meta_ideal = ?,
          capacity = ?, matriculados = ?, confirmados = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        startDate,
        d.metaMinima,
        d.metaIdeal,
        d.capacity,
        d.matriculados,
        d.confirmados,
        nowIso(),
        existing.id
      );
      continue;
    }
    db.prepare(
      `INSERT INTO training_classes (
        id, course_id, course_code, course_name, turma_label, unidade, status,
        start_date, capacity, meta_minima, meta_ideal, matriculados, confirmados,
        external_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Chapec\xF3', 'EM_CAPTACAO', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id("turma"),
      d.courseId,
      d.courseId.toUpperCase(),
      d.courseName,
      d.turmaLabel,
      startDate,
      d.capacity,
      d.metaMinima,
      d.metaIdeal,
      d.matriculados,
      d.confirmados,
      d.key,
      nowIso(),
      nowIso()
    );
  }
}

// server/src/services/ops/turmaAlerts.ts
function syncTurmaAlert(classId, courseName, turmaLabel, health) {
  const label = turmaLabel || courseName;
  const key = `priority:${health.prioridade}`;
  const existing = db.prepare(
    `SELECT id, alert_key, active FROM turma_alerts
       WHERE training_class_id = ? AND active = 1
       ORDER BY updated_at DESC LIMIT 1`
  ).get(classId);
  if (existing?.alert_key === key) {
    return;
  }
  if (existing) {
    db.prepare(`UPDATE turma_alerts SET active = 0, updated_at = ? WHERE id = ?`).run(
      nowIso(),
      existing.id
    );
  }
  if (health.prioridade === "SEM_ACAO" || health.prioridade === "SAUDAVEL") {
    return;
  }
  const title = buildTitle(label, health.prioridade, health);
  const body = health.reasons.join(" \xB7 ");
  db.prepare(
    `INSERT INTO turma_alerts (
      id, training_class_id, alert_key, title, body, prioridade, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(training_class_id, alert_key) DO UPDATE SET
      title = excluded.title,
      body = excluded.body,
      active = 1,
      updated_at = excluded.updated_at`
  ).run(id("talert"), classId, key, title, body, health.prioridade, nowIso(), nowIso());
}
function buildTitle(label, p, h) {
  const days = h.diasParaInicio;
  const occ = h.ocupacaoMeta;
  switch (p) {
    case "CRITICA":
      return `${label} entrou em prioridade CR\xCDTICA.`;
    case "ALTA":
      if (h.ritmoNecessarioDia != null) {
        return `${label} precisa de aproximadamente ${h.ritmoNecessarioDia} confirma\xE7\xF5es/dia para a meta m\xEDnima.`;
      }
      return `${label} est\xE1 em prioridade ALTA.`;
    case "DEFINIR_META":
      return `${label} est\xE1 sem meta m\xEDnima definida.`;
    case "ATENCAO":
      if (days != null && occ != null) {
        return `${label} come\xE7a em ${days} dias e est\xE1 com ${occ}% da meta.`;
      }
      return `${label} precisa de aten\xE7\xE3o.`;
    case "META_ATINGIDA":
      return `${label} atingiu a meta m\xEDnima.`;
    default:
      return `${label}: ${p}`;
  }
}
function listActiveAlerts(limit = 40) {
  return db.prepare(
    `SELECT a.*, t.course_name, t.turma_label
       FROM turma_alerts a
       JOIN training_classes t ON t.id = a.training_class_id
       WHERE a.active = 1
       ORDER BY a.updated_at DESC
       LIMIT ?`
  ).all(limit);
}

// server/src/services/ops/historicalImport.ts
var MAPPING_VERSION = "ops-historical-v1";
function hashRow(parts) {
  return (0, import_node_crypto3.createHash)("sha256").update(parts.join("")).digest("hex");
}
function normalizeCpf(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}
function normalizeEmail2(raw) {
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase();
}
function normalizePhone2(raw) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}
function parseTurmaFromSheetName(sheet) {
  const cleaned = sheet.trim();
  return { courseHint: cleaned.split(/\s+/)[0] || cleaned, turmaLabel: cleaned };
}
function runHistoricalImport(tabs, opts = {}) {
  const mode = opts.mode ?? "apply";
  const runId = id("imprun");
  const startedAt = nowIso();
  const unmapped = /* @__PURE__ */ new Set();
  const unknownStatuses = {};
  let imported = 0;
  let needsReview = 0;
  let ignored = 0;
  let people = 0;
  let classes = 0;
  let enrollments = 0;
  let contacts = 0;
  let dupes = 0;
  let issues = 0;
  let sourceRecords = 0;
  const fingerprints = /* @__PURE__ */ new Set();
  if (mode === "apply") {
    db.prepare(
      `INSERT INTO import_runs (id, spreadsheet_id, mode, status, mapping_version, started_at, user_id)
       VALUES (?, ?, ?, 'running', ?, ?, ?)`
    ).run(runId, opts.spreadsheetId ?? null, mode, MAPPING_VERSION, startedAt, opts.userId ?? null);
  }
  const insertIssue = db.prepare(
    `INSERT INTO migration_issues (id, run_id, code, severity, source_sheet, source_row, person_id, training_class_id, message, payload_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  );
  function issue(code, message, meta = {}) {
    issues += 1;
    if (mode !== "apply") return;
    insertIssue.run(
      id("issue"),
      runId,
      code,
      meta.severity ?? "warning",
      meta.sheet ?? null,
      meta.row ?? null,
      meta.personId ?? null,
      meta.classId ?? null,
      message,
      meta.payload ? JSON.stringify(meta.payload) : null,
      nowIso()
    );
  }
  for (const tab of tabs) {
    const detection = detectSchema(tab.headers);
    fingerprints.add(detection.fingerprint);
    detection.unknownHeaders.forEach((h) => unmapped.add(h));
    if (detection.missingRequired.length) {
      issue("MISSING_HEADER", `Aba ${tab.sourceSheet}: faltam campos ${detection.missingRequired.join(",")}`, {
        sheet: tab.sourceSheet,
        severity: "error",
        payload: detection
      });
    }
    if (detection.confidence < 0.35) {
      issue("INFERRED_SCHEMA", `Schema fraco (${detection.confidence}) em ${tab.sourceSheet}`, {
        sheet: tab.sourceSheet,
        payload: detection
      });
    }
    const { courseHint, turmaLabel } = parseTurmaFromSheetName(tab.sourceSheet);
    let classId = null;
    if (mode === "apply") {
      const existing = db.prepare(
        `SELECT id FROM training_classes WHERE aba_origem = ? AND planilha_origem = ? LIMIT 1`
      ).get(tab.sourceSheet, tab.sourceFile);
      if (existing) {
        classId = existing.id;
      } else {
        classId = id("turma");
        const courseId = resolveCourseId(courseHint);
        const course = courseId ? db.prepare("SELECT id, name FROM courses WHERE id = ?").get(courseId) : void 0;
        db.prepare(
          `INSERT INTO training_classes (
            id, course_id, course_code, course_name, turma_label, unidade, status,
            planilha_origem, aba_origem, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'Chapec\xF3', 'ENCERRADA', ?, ?, ?, ?)`
        ).run(
          classId,
          course?.id ?? null,
          courseHint,
          course?.name ?? turmaLabel,
          turmaLabel,
          tab.sourceFile,
          tab.sourceSheet,
          nowIso(),
          nowIso()
        );
        classes += 1;
      }
    }
    tab.rows.forEach((values, idx) => {
      const sourceRow = idx + 2;
      sourceRecords += 1;
      const mapped = mapRowValues(tab.headers, values, detection);
      const rawObj = {};
      tab.headers.forEach((h, i) => {
        rawObj[h] = values[i] ?? "";
      });
      const sourceHash = hashRow([
        tab.sourceFile,
        tab.sourceSheet,
        String(sourceRow),
        JSON.stringify(rawObj)
      ]);
      if (mode === "apply") {
        const already = db.prepare("SELECT id, disposition FROM import_raw_rows WHERE source_hash = ?").get(sourceHash);
        if (already) {
          ignored += 1;
          return;
        }
      }
      const name = mapped.personName?.trim();
      if (!name) {
        ignored += 1;
        persistRaw(tab, sourceRow, detection, sourceHash, rawObj, "IGNORED_WITH_REASON", "MISSING_PERSON_NAME");
        issue("MISSING_PERSON_NAME", "Linha sem nome", { sheet: tab.sourceSheet, row: sourceRow });
        return;
      }
      const cpfNorm = normalizeCpf(mapped.cpf);
      const email = normalizeEmail2(mapped.email);
      if (mapped.email && !email) {
        issue("INVALID_EMAIL", `Email inv\xE1lido: ${mapped.email}`, {
          sheet: tab.sourceSheet,
          row: sourceRow
        });
      }
      const phone = normalizePhone2(mapped.phone || mapped.whatsapp);
      let personId = null;
      let disposition = cpfNorm || email ? "IMPORTED" : "NEEDS_REVIEW";
      if (mapped.cpf && !cpfNorm) {
        issue("INVALID_CPF", `CPF inv\xE1lido: ${mapped.cpf}`, { sheet: tab.sourceSheet, row: sourceRow });
        disposition = "NEEDS_REVIEW";
      }
      if (mode === "apply") {
        personId = resolvePerson({
          name,
          cpfNorm,
          email,
          phone,
          salesforce: mapped.salesforceId || mapped.salesforceUrl,
          grade: mapped.grade,
          onDupe: (a, b, reason, evidence) => {
            dupes += 1;
            db.prepare(
              `INSERT INTO possible_duplicates (id, person_a_id, person_b_id, reason, evidence_json, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'open', ?)`
            ).run(id("dup"), a, b, reason, JSON.stringify(evidence), nowIso());
            issue("POSSIBLE_DUPLICATE", reason, {
              sheet: tab.sourceSheet,
              row: sourceRow,
              personId: a,
              payload: evidence
            });
          },
          onConflict: (msg, payload) => {
            issue("CONFLICTING_PERSON_DATA", msg, {
              sheet: tab.sourceSheet,
              row: sourceRow,
              payload
            });
            disposition = "NEEDS_REVIEW";
          }
        });
        if (personId) people += 1;
        if (personId && classId) {
          const enrHash = hashRow([personId, classId, sourceHash]);
          const existsEnr = db.prepare("SELECT id FROM enrollments WHERE source_hash = ?").get(enrHash);
          let enrollmentId = existsEnr?.id;
          if (!enrollmentId) {
            enrollmentId = id("enr");
            const statusRaw = (mapped.confirmationStatus || "").trim();
            if (statusRaw) {
              unknownStatuses[statusRaw] = (unknownStatuses[statusRaw] || 0) + 1;
            }
            const present = /^(sim|s|x|presente|1)$/i.test((mapped.presence || "").trim());
            const courseRow = db.prepare("SELECT course_id FROM training_classes WHERE id = ?").get(classId);
            const courseId = courseRow?.course_id || ensureUnknownCourseId();
            const presentFlag = present ? 1 : 0;
            db.prepare(
              `INSERT INTO enrollments (
                id, client_id, course_id, event_id, training_class_id, status, confirmation_status,
                present, completed, decision, grade_label, matricula_salesforce, notes,
                source_sheet, source_row, source_hash, raw_json, created_at, updated_at
              ) VALUES (?, ?, ?, NULL, ?, 'inscrito', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              enrollmentId,
              personId,
              courseId,
              classId,
              statusRaw || "matriculado",
              presentFlag,
              presentFlag,
              mapped.grade || null,
              mapped.matriculaSales || null,
              mapped.observation || null,
              tab.sourceSheet,
              sourceRow,
              enrHash,
              JSON.stringify(rawObj),
              nowIso(),
              nowIso()
            );
            enrollments += 1;
          }
          for (const [key, field] of [
            ["contact1", mapped.contact1],
            ["contact2", mapped.contact2],
            ["contact3", mapped.contact3],
            ["contact4", mapped.contact4]
          ]) {
            if (!field?.trim()) continue;
            db.prepare(
              `INSERT INTO contact_events (
                id, person_id, training_class_id, enrollment_id, occurred_at, type, channel,
                observation, source_sheet, source_row, source_hash, raw_json, created_at
              ) VALUES (?, ?, ?, ?, ?, 'legacy_cell', 'unknown', ?, ?, ?, ?, ?, ?)`
            ).run(
              id("ce"),
              personId,
              classId,
              enrollmentId,
              nowIso(),
              field,
              tab.sourceSheet,
              sourceRow,
              hashRow([enrHash, key, field]),
              JSON.stringify({ cell: key, text: field }),
              nowIso()
            );
            contacts += 1;
          }
        }
        persistRaw(
          tab,
          sourceRow,
          detection,
          sourceHash,
          rawObj,
          disposition,
          disposition === "NEEDS_REVIEW" ? "LOW_IDENTITY_CONFIDENCE" : null,
          personId,
          classId
        );
      }
      if (disposition === "IMPORTED") imported += 1;
      else needsReview += 1;
    });
    if (mode === "apply" && classId) {
      refreshClassCounts(classId);
    }
  }
  const summary = {
    runId,
    tabsAnalyzed: tabs.length,
    schemasDetected: fingerprints.size,
    sourceRecords,
    imported,
    needsReview,
    ignored,
    peopleUpserted: people,
    classesUpserted: classes,
    enrollmentsUpserted: enrollments,
    contactsCreated: contacts,
    possibleDuplicates: dupes,
    issues,
    unknownStatuses,
    unmappedColumns: [...unmapped]
  };
  if (mode === "apply") {
    db.prepare(
      `UPDATE import_runs SET status = 'success', finished_at = ?, summary_json = ? WHERE id = ?`
    ).run(nowIso(), JSON.stringify(summary), runId);
  }
  return summary;
  function persistRaw(tab, sourceRow, detection, sourceHash, rawObj, disposition, reason, personId, classId) {
    if (mode !== "apply") return;
    db.prepare(
      `INSERT OR IGNORE INTO import_raw_rows (
        id, run_id, source_file, source_sheet, source_row, schema_fingerprint, mapping_confidence,
        source_hash, raw_json, disposition, disposition_reason, person_id, training_class_id, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id("raw"),
      runId,
      tab.sourceFile,
      tab.sourceSheet,
      sourceRow,
      detection.fingerprint,
      detection.confidence,
      sourceHash,
      JSON.stringify(rawObj),
      disposition,
      reason,
      personId ?? null,
      classId ?? null,
      nowIso()
    );
  }
}
function resolvePerson(opts) {
  if (opts.cpfNorm) {
    const byCpf = db.prepare("SELECT * FROM clients WHERE cpf_normalized = ?").get(opts.cpfNorm);
    if (byCpf) {
      if (opts.email && byCpf.email && String(byCpf.email).toLowerCase() !== opts.email) {
        opts.onConflict("CPF match com email diferente", {
          cpf: opts.cpfNorm,
          existingEmail: byCpf.email,
          email: opts.email
        });
      }
      return String(byCpf.id);
    }
  }
  if (opts.salesforce) {
    const sf = opts.salesforce.trim();
    const bySf = db.prepare(
      `SELECT * FROM clients WHERE salesforce_id = ? OR salesforce_url = ? LIMIT 1`
    ).get(sf, sf);
    if (bySf) return String(bySf.id);
  }
  const softPhoneHits = opts.phone ? db.prepare(
    `SELECT id, full_name FROM clients WHERE phone_normalized = ? OR whatsapp = ? LIMIT 5`
  ).all(opts.phone, opts.phone) : [];
  const personId = id("person");
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO clients (
      id, full_name, preferred_name, email, phone, phone_normalized, whatsapp,
      consultant_id, consultant_name, status, presence, tags_json, courses_json, source,
      cpf_normalized, cpf_raw, salesforce_id, salesforce_url, grade_label,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'lead', 'unknown', '[]', '[]', 'historical_import',
      ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    personId,
    opts.name,
    opts.name.split(/\s+/)[0] || opts.name,
    opts.email,
    opts.phone,
    opts.phone,
    opts.phone,
    opts.cpfNorm,
    opts.cpfNorm,
    opts.salesforce && !opts.salesforce.startsWith("http") ? opts.salesforce : null,
    opts.salesforce?.startsWith("http") ? opts.salesforce : null,
    opts.grade ?? null,
    createdAt,
    createdAt
  );
  for (const hit of softPhoneHits) {
    const sameName = hit.full_name.trim().toLowerCase() === opts.name.trim().toLowerCase();
    opts.onDupe(
      personId,
      hit.id,
      sameName ? "POSSIBLE_DUPLICATE_NAME_PHONE" : "POSSIBLE_DUPLICATE_PHONE",
      {
        phone: opts.phone,
        name: opts.name,
        other: hit.full_name
      }
    );
  }
  return personId;
}
function refreshClassCounts(classId) {
  const row = db.prepare(
    `SELECT
         COUNT(*) as matriculados,
         SUM(CASE WHEN lower(confirmation_status) LIKE '%confirm%' OR present = 1 THEN 1 ELSE 0 END) as confirmados
       FROM enrollments WHERE training_class_id = ?`
  ).get(classId);
  const tc = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(classId);
  const health = computeTurmaHealth({
    startDate: tc.start_date ? String(tc.start_date) : null,
    capacity: tc.capacity != null ? Number(tc.capacity) : null,
    metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
    metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
    matriculados: Number(row.matriculados),
    confirmados: Number(row.confirmados || 0),
    status: String(tc.status)
  });
  db.prepare(
    `UPDATE training_classes SET
      matriculados = ?, confirmados = ?, prioridade = ?, last_health_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    health.matriculados,
    health.confirmados,
    health.prioridade,
    JSON.stringify(health),
    nowIso(),
    classId
  );
  syncTurmaAlert(
    classId,
    String(tc.course_name),
    tc.turma_label ? String(tc.turma_label) : null,
    health
  );
}

// server/src/services/ops/fixtures/historicalTabs.ts
var FIXTURE_HISTORICAL_TABS = [
  {
    sourceFile: "CONFIRMACOES_FIXTURE",
    sourceSheet: "IF 08",
    headers: ["ALUNO", "CPF", "TELEFONE", "E-MAIL", "CONSULTOR", "CONFIRMA\xC7\xC3O", "PRESEN\xC7A", "1\xBA CONTATO"],
    rows: [
      [
        "Maria Souza",
        "529.982.247-25",
        "49999990001",
        "maria@email.com",
        "Vanessa",
        "Confirmado",
        "Sim",
        "Ligou 01/08 \u2014 interessada"
      ],
      [
        "Jo\xE3o Lima",
        "111.444.777-35",
        "49999990002",
        "joao@email.com",
        "Lucas",
        "Aguardando",
        "N\xE3o",
        ""
      ],
      ["", "", "49999990003", "", "Maria", "", "", "Linha inv\xE1lida"]
    ]
  },
  {
    sourceFile: "CONFIRMACOES_FIXTURE",
    sourceSheet: "CEOP 06",
    headers: ["CLIENTES", "CPF/CNPJ", "WhatsApp", "Email", "Status Vaga", "GRADE", "OBS./CONTATO", "2\xBA CONTATO"],
    rows: [
      [
        "Ana Clara",
        "390.533.447-05",
        "49988881111",
        "ana@email.com",
        "Confirmado",
        "Green",
        "Pagamento ok",
        "Retorno WhatsApp"
      ],
      [
        "Pedro Souza",
        "390.533.447-05",
        "49988882222",
        "outro@email.com",
        "Transferencia CEOP 07",
        "Gold",
        "",
        ""
      ]
    ]
  },
  {
    sourceFile: "CONFIRMACOES_FIXTURE",
    sourceSheet: "ML5 04",
    headers: ["Nome", "Documento", "Fone", "Consultora", "Status", "Presente"],
    rows: [
      ["Carla Dias", "invalid-cpf", "49977770000", "Kauany", "Matriculado", "X"],
      ["Carla Dias", "", "49977770000", "Kauany", "Confirmado", "Sim"]
    ]
  }
];

// server/src/services/ops/potentialEligibility.ts
var DEFAULT_ELIGIBILITY_CONFIG = {
  rules: ["not_completed_target_course", "has_any_history", "exclude_future_enrollment_same_course"],
  pendingBusinessRules: [
    "Prerrequisitos oficiais por curso (ex.: ordem MCIS \u2192 \u2026) \u2014 PENDENTE REGRA DE NEG\xD3CIO",
    "Grade / certificado m\xEDnimo para elegibilidade \u2014 PENDENTE REGRA DE NEG\xD3CIO",
    "Regras de recompra / transfer\xEAncia recente \u2014 PENDENTE REGRA DE NEG\xD3CIO"
  ]
};
function evaluateEligibility(person, targetCourseId, config = DEFAULT_ELIGIBILITY_CONFIG) {
  const reasons = [];
  const blockers = [];
  for (const rule of config.rules) {
    switch (rule) {
      case "not_completed_target_course":
        if (person.completedCourseIds.includes(targetCourseId)) {
          blockers.push("J\xE1 realizou o curso alvo");
        } else {
          reasons.push("N\xE3o possui realiza\xE7\xE3o do curso alvo");
        }
        break;
      case "has_any_history":
        if (person.completedCourseIds.length + person.enrolledCourseIds.length === 0) {
          blockers.push("Sem hist\xF3rico de turmas");
        } else {
          reasons.push("Possui hist\xF3rico FEBRACIS");
        }
        break;
      case "exclude_future_enrollment_same_course":
        if (person.enrolledCourseIds.includes(targetCourseId)) {
          blockers.push("J\xE1 inscrito em turma futura/aberta do mesmo curso");
        }
        break;
      case "exclude_cancelled_only":
        break;
      default:
        break;
    }
  }
  return {
    eligible: blockers.length === 0,
    reasons,
    blockers
  };
}

// server/src/services/ops/contactStatus.ts
var CONTACT_STATUSES = [
  "nao_contatado",
  "contatado",
  "respondeu",
  "sem_resposta",
  "interessado",
  "finalizado"
];
var CONTACT_STATUS_LABEL = {
  nao_contatado: "N\xE3o contatado",
  contatado: "Contatado",
  respondeu: "Respondeu",
  sem_resposta: "Sem resposta",
  interessado: "Interessado",
  finalizado: "Finalizado"
};
var CONTACT_STATUS_PRIORITY = {
  nao_contatado: 0,
  sem_resposta: 1,
  contatado: 2,
  respondeu: 3,
  interessado: 4,
  finalizado: 5
};
var OPEN_CONTACT_STATUSES = [
  "nao_contatado",
  "sem_resposta",
  "contatado",
  "respondeu",
  "interessado"
];
function isContactStatus(value) {
  return CONTACT_STATUSES.includes(value);
}
function normalizeContactStatus(value) {
  const v = (value || "").trim().toLowerCase();
  if (isContactStatus(v)) return v;
  return "nao_contatado";
}
function contactStatusSortSql(column = "e.contact_status") {
  return `CASE COALESCE(${column}, 'nao_contatado')
    WHEN 'nao_contatado' THEN 0
    WHEN 'sem_resposta' THEN 1
    WHEN 'contatado' THEN 2
    WHEN 'respondeu' THEN 3
    WHEN 'interessado' THEN 4
    WHEN 'finalizado' THEN 5
    ELSE 6
  END`;
}

// server/src/services/ops/whatsappClick.ts
var CHAPECO_DDD = "49";
function onlyDigits(value) {
  return value.replace(/\D/g, "");
}
function firstNameFrom(fullName, preferredName) {
  const preferred = (preferredName || "").trim();
  if (preferred) return preferred.split(/\s+/)[0] || preferred;
  const full = (fullName || "").trim();
  if (!full) return "ol\xE1";
  return full.split(/\s+/)[0] || full;
}
function normalizeBrWhatsApp(raw, defaultDdd = CHAPECO_DDD) {
  if (!raw || !String(raw).trim()) {
    return { e164: null, nationalDigits: null, reason: "missing_phone" };
  }
  let digits = onlyDigits(String(raw));
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const national = digits.slice(2);
    return { e164: digits, nationalDigits: national };
  }
  if (digits.startsWith("55") && digits.length > 13) {
    const rest = digits.slice(2);
    if (rest.length === 10 || rest.length === 11) {
      return { e164: `55${rest}`, nationalDigits: rest };
    }
  }
  if (digits.length === 10 || digits.length === 11) {
    return { e164: `55${digits}`, nationalDigits: digits };
  }
  if (digits.length === 8 || digits.length === 9) {
    const national = `${defaultDdd}${digits}`;
    return { e164: `55${national}`, nationalDigits: national };
  }
  return { e164: null, nationalDigits: null, reason: "invalid_phone" };
}
function buildConfirmacaoMessage(input) {
  const first = firstNameFrom(input.fullName, input.preferredName);
  const turma = (input.turmaLabel || input.courseName || "turma FEBRACIS Chapec\xF3").trim();
  const course = input.courseName && input.turmaLabel && input.courseName !== input.turmaLabel ? input.courseName.trim() : "";
  const conf = (input.confirmationStatus || "").trim();
  const unidade = (input.unidade || "Chapec\xF3").trim();
  const lines = [
    `Ol\xE1, ${first}! Aqui \xE9 da FEBRACIS ${unidade}.`,
    "",
    course ? `Estou falando sobre a turma ${turma} (${course}).` : `Estou falando sobre a turma ${turma}.`,
    "Gostaria de confirmar sua participa\xE7\xE3o."
  ];
  if (conf && !/^confirm/i.test(conf)) {
    lines.push(`No sistema sua situa\xE7\xE3o aparece como: ${conf}.`);
  }
  lines.push("", "Pode me retornar por aqui, por favor?");
  return lines.join("\n");
}
function buildWhatsAppClick(input) {
  const first = firstNameFrom(input.fullName, input.preferredName);
  const message = buildConfirmacaoMessage(input);
  const phone = normalizeBrWhatsApp(input.phone);
  if (!phone.e164) {
    return {
      ok: false,
      e164: null,
      nationalDigits: null,
      url: null,
      message,
      firstName: first,
      reason: phone.reason
    };
  }
  const url = `https://wa.me/${phone.e164}?text=${encodeURIComponent(message)}`;
  return {
    ok: true,
    e164: phone.e164,
    nationalDigits: phone.nationalDigits,
    url,
    message,
    firstName: first
  };
}

// server/src/services/ops/confirmacaoMapper.ts
function mapConfirmacaoRow(p) {
  const fullName = String(p.full_name || "");
  const preferredName = p.preferred_name ? String(p.preferred_name) : null;
  const phoneRaw = String(p.whatsapp || p.phone || p.phone_normalized || "");
  const turmaLabel = p.turma_label ? String(p.turma_label) : null;
  const courseName = p.course_name ? String(p.course_name) : null;
  const confirmationStatus = String(p.confirmation_status || p.status || "");
  const wa = buildWhatsAppClick({
    phone: phoneRaw,
    fullName,
    preferredName,
    turmaLabel,
    courseName,
    confirmationStatus,
    consultantName: p.consultant_name ? String(p.consultant_name) : null
  });
  const contactStatus = normalizeContactStatus(p.contact_status ? String(p.contact_status) : null);
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
    phoneValid: wa.ok
  };
}
var CONFIRMACAO_SELECT = `
  e.id, e.client_id, e.confirmation_status, e.status, e.present, e.grade_label,
  e.financial_status, e.source_sheet, e.source_row, e.training_class_id,
  e.contact_status, e.last_contacted_at,
  c.full_name, c.preferred_name, c.phone, c.phone_normalized, c.whatsapp, c.email, c.consultant_name,
  t.id as turma_id, t.course_name, t.turma_label, t.start_date, t.status as turma_status
`;

// server/src/routes/ops.ts
function opsRoutes() {
  const router = (0, import_express10.Router)();
  router.use(requireAuth);
  router.get("/turmas", requirePermission("dashboard.view"), (req, res) => {
    const priority = String(req.query.priority || "");
    const windowDays = Number(req.query.windowDays || 0);
    let rows = db.prepare(`SELECT * FROM training_classes ORDER BY start_date IS NULL, start_date ASC`).all();
    if (priority) {
      rows = rows.filter((r) => String(r.prioridade || "") === priority);
    }
    if (windowDays > 0) {
      const now = Date.now();
      rows = rows.filter((r) => {
        if (!r.start_date) return false;
        const d = new Date(String(r.start_date)).getTime() - now;
        const days = d / 864e5;
        return days >= 0 && days <= windowDays;
      });
    }
    res.json(
      rows.map((r) => {
        const health = parseJson(String(r.last_health_json || "null"), null) || computeTurmaHealth({
          startDate: r.start_date ? String(r.start_date) : null,
          capacity: r.capacity != null ? Number(r.capacity) : null,
          metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
          metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
          matriculados: Number(r.matriculados || 0),
          confirmados: Number(r.confirmados || 0),
          status: String(r.status)
        });
        return {
          id: String(r.id),
          courseId: r.course_id ? String(r.course_id) : null,
          courseName: String(r.course_name),
          turmaLabel: r.turma_label ? String(r.turma_label) : null,
          unidade: String(r.unidade || "Chapec\xF3"),
          startDate: r.start_date ? String(r.start_date) : null,
          endDate: r.end_date ? String(r.end_date) : null,
          status: String(r.status),
          capacity: r.capacity != null ? Number(r.capacity) : null,
          metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
          metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
          matriculados: Number(r.matriculados || 0),
          confirmados: Number(r.confirmados || 0),
          prioridade: r.prioridade ? String(r.prioridade) : health.prioridade,
          responsavelAcao: r.responsavel_acao ? String(r.responsavel_acao) : null,
          acaoComercial: r.acao_comercial ? String(r.acao_comercial) : null,
          health
        };
      })
    );
  });
  router.get("/turmas/:id", requirePermission("dashboard.view"), (req, res) => {
    const r = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(req.params.id);
    if (!r) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const participants = db.prepare(
      `SELECT ${CONFIRMACAO_SELECT}
         FROM enrollments e
         JOIN clients c ON c.id = e.client_id
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE e.training_class_id = ?
         ORDER BY ${contactStatusSortSql()}, c.full_name`
    ).all(req.params.id);
    const health = parseJson(String(r.last_health_json || "null"), null) || computeTurmaHealth({
      startDate: r.start_date ? String(r.start_date) : null,
      capacity: r.capacity != null ? Number(r.capacity) : null,
      metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
      metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
      matriculados: Number(r.matriculados || 0),
      confirmados: Number(r.confirmados || 0),
      status: String(r.status)
    });
    res.json({
      turma: {
        id: String(r.id),
        courseName: String(r.course_name),
        turmaLabel: r.turma_label ? String(r.turma_label) : null,
        startDate: r.start_date ? String(r.start_date) : null,
        status: String(r.status),
        metaMinima: r.meta_minima != null ? Number(r.meta_minima) : null,
        metaIdeal: r.meta_ideal != null ? Number(r.meta_ideal) : null,
        capacity: r.capacity != null ? Number(r.capacity) : null
      },
      health,
      contactStatuses: CONTACT_STATUS_LABEL,
      participants: participants.map(mapConfirmacaoRow)
    });
  });
  router.patch("/turmas/:id", requirePermission("courses.edit"), (req, res) => {
    const existing = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const schema = import_zod8.z.object({
      metaMinima: import_zod8.z.number().int().nonnegative().nullable().optional(),
      metaIdeal: import_zod8.z.number().int().nonnegative().nullable().optional(),
      capacity: import_zod8.z.number().int().nonnegative().nullable().optional(),
      startDate: import_zod8.z.string().nullable().optional(),
      status: import_zod8.z.string().optional(),
      responsavelAcao: import_zod8.z.string().nullable().optional(),
      acaoComercial: import_zod8.z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const d = parsed.data;
    const metaMin = d.metaMinima !== void 0 ? d.metaMinima : existing.meta_minima;
    const metaIdeal = d.metaIdeal !== void 0 ? d.metaIdeal : existing.meta_ideal;
    const capacity = d.capacity !== void 0 ? d.capacity : existing.capacity;
    const startDate = d.startDate !== void 0 ? d.startDate : existing.start_date;
    const status = d.status ?? String(existing.status);
    const health = computeTurmaHealth({
      startDate,
      capacity,
      metaMinima: metaMin,
      metaIdeal,
      matriculados: Number(existing.matriculados || 0),
      confirmados: Number(existing.confirmados || 0),
      status
    });
    db.prepare(
      `UPDATE training_classes SET
        meta_minima = ?, meta_ideal = ?, capacity = ?, start_date = ?, status = ?,
        responsavel_acao = COALESCE(?, responsavel_acao),
        acao_comercial = COALESCE(?, acao_comercial),
        prioridade = ?, last_health_json = ?, ultima_revisao = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      metaMin,
      metaIdeal,
      capacity,
      startDate,
      status,
      d.responsavelAcao ?? null,
      d.acaoComercial ?? null,
      health.prioridade,
      JSON.stringify(health),
      nowIso(),
      nowIso(),
      req.params.id
    );
    syncTurmaAlert(
      req.params.id,
      String(existing.course_name),
      existing.turma_label ? String(existing.turma_label) : null,
      health
    );
    res.json({ ok: true, health });
  });
  router.get("/alerts", requirePermission("dashboard.view"), (_req, res) => {
    res.json(
      listActiveAlerts().map((a) => ({
        id: String(a.id),
        trainingClassId: String(a.training_class_id),
        title: String(a.title),
        body: a.body ? String(a.body) : null,
        prioridade: a.prioridade ? String(a.prioridade) : null,
        courseName: String(a.course_name),
        turmaLabel: a.turma_label ? String(a.turma_label) : null,
        updatedAt: String(a.updated_at)
      }))
    );
  });
  router.get("/turmas/:id/potenciais", requirePermission("clients.view"), (req, res) => {
    const tc = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(req.params.id);
    if (!tc) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const targetCourseId = tc.course_id ? String(tc.course_id) : null;
    if (!targetCourseId || targetCourseId === "course_unknown") {
      res.json({
        status: "PARCIAL",
        total: 0,
        byConsultant: [],
        items: [],
        note: "Turma sem course_id de cat\xE1logo \u2014 n\xE3o \xE9 poss\xEDvel calcular potenciais.",
        pendingRules: DEFAULT_ELIGIBILITY_CONFIG.pendingBusinessRules
      });
      return;
    }
    const people = db.prepare("SELECT * FROM clients").all();
    const eligible = [];
    for (const p of people) {
      const pid = String(p.id);
      const completed = db.prepare(
        `SELECT DISTINCT course_id FROM enrollments WHERE client_id = ? AND (completed = 1 OR present = 1)`
      ).all(pid);
      const enrolledOpen = db.prepare(
        `SELECT DISTINCT e.course_id FROM enrollments e
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.client_id = ?
             AND e.course_id = ?
             AND (t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`
      ).all(pid, targetCourseId);
      const lastTurma = db.prepare(
        `SELECT t.turma_label FROM enrollments e
           JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.client_id = ?
           ORDER BY t.start_date DESC LIMIT 1`
      ).get(pid);
      const lite = {
        personId: pid,
        fullName: String(p.full_name),
        consultantName: p.consultant_name ? String(p.consultant_name) : null,
        grade: p.grade_label ? String(p.grade_label) : null,
        completedCourseIds: completed.map((c) => c.course_id),
        enrolledCourseIds: enrolledOpen.map((c) => c.course_id),
        lastTurmaLabel: lastTurma?.turma_label ?? null
      };
      const result = evaluateEligibility(lite, targetCourseId);
      if (!result.eligible) continue;
      eligible.push({
        personId: pid,
        fullName: lite.fullName,
        consultantName: lite.consultantName,
        grade: lite.grade,
        lastTurmaLabel: lite.lastTurmaLabel,
        reasons: result.reasons
      });
    }
    const byConsultant = {};
    for (const e of eligible) {
      const k = e.consultantName || "Sem consultor";
      byConsultant[k] = (byConsultant[k] || 0) + 1;
    }
    res.json({
      status: "FUNCIONANDO",
      courseId: targetCourseId,
      courseName: String(tc.course_name),
      turmaLabel: tc.turma_label ? String(tc.turma_label) : null,
      total: eligible.length,
      byConsultant: Object.entries(byConsultant).map(([name, count2]) => ({ name, count: count2 })).sort((a, b) => b.count - a.count),
      items: eligible.slice(0, 100),
      pendingRules: DEFAULT_ELIGIBILITY_CONFIG.pendingBusinessRules
    });
  });
  router.post("/turmas/refresh-health", requirePermission("courses.edit"), (_req, res) => {
    const rows = db.prepare("SELECT id FROM training_classes").all();
    for (const r of rows) {
      const tc = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(r.id);
      const health = computeTurmaHealth({
        startDate: tc.start_date ? String(tc.start_date) : null,
        capacity: tc.capacity != null ? Number(tc.capacity) : null,
        metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
        metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
        matriculados: Number(tc.matriculados || 0),
        confirmados: Number(tc.confirmados || 0),
        status: String(tc.status)
      });
      db.prepare(
        `UPDATE training_classes SET prioridade = ?, last_health_json = ?, updated_at = ? WHERE id = ?`
      ).run(health.prioridade, JSON.stringify(health), nowIso(), r.id);
      syncTurmaAlert(
        r.id,
        String(tc.course_name),
        tc.turma_label ? String(tc.turma_label) : null,
        health
      );
    }
    res.json({ ok: true, refreshed: rows.length });
  });
  router.get("/painel", requirePermission("dashboard.view"), (_req, res) => {
    const turmas = db.prepare("SELECT * FROM training_classes").all();
    const byPriority = {};
    for (const t of turmas) {
      const p = String(t.prioridade || "SEM_ACAO");
      byPriority[p] = (byPriority[p] || 0) + 1;
    }
    const critical = turmas.filter((t) => ["CRITICA", "ALTA", "DEFINIR_META"].includes(String(t.prioridade))).slice(0, 12).map((t) => ({
      id: String(t.id),
      courseName: String(t.course_name),
      turmaLabel: t.turma_label ? String(t.turma_label) : null,
      startDate: t.start_date ? String(t.start_date) : null,
      prioridade: String(t.prioridade || "SEM_ACAO"),
      confirmados: Number(t.confirmados || 0),
      metaMinima: t.meta_minima != null ? Number(t.meta_minima) : null,
      health: parseJson(String(t.last_health_json || "null"), null)
    }));
    res.json({
      product: "FEBRACIS OPS",
      totals: { turmas: turmas.length, byPriority },
      attention: critical,
      migration: latestMigrationSummary(),
      sheetsPilot: {
        spreadsheetId: env.googleSheets.spreadsheetId || null,
        enabled: env.googleSheets.enabled,
        mode: createSheetsClient({
          enabled: env.googleSheets.enabled,
          credentialsPath: env.googleSheets.credentialsPath,
          credentialsJson: env.googleSheets.credentialsJson
        }).mode
      }
    });
  });
  router.get("/migration/issues", requirePermission("settings.view"), (req, res) => {
    const status = String(req.query.status || "open");
    const rows = status === "all" ? db.prepare("SELECT * FROM migration_issues ORDER BY created_at DESC LIMIT 200").all() : db.prepare(
      "SELECT * FROM migration_issues WHERE status = ? ORDER BY created_at DESC LIMIT 200"
    ).all(status);
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        severity: String(r.severity),
        sourceSheet: r.source_sheet ? String(r.source_sheet) : null,
        sourceRow: r.source_row != null ? Number(r.source_row) : null,
        message: String(r.message),
        status: String(r.status),
        createdAt: String(r.created_at)
      }))
    );
  });
  router.post("/migration/run-fixtures", requirePermission("sheets.sync"), (req, res) => {
    const summary = runHistoricalImport(FIXTURE_HISTORICAL_TABS, {
      userId: req.user?.id,
      spreadsheetId: "fixtures",
      mode: "apply"
    });
    ensureDemoOpenTurmas();
    const demos = db.prepare(`SELECT id FROM training_classes WHERE external_id LIKE 'demo-%'`).all();
    for (const d of demos) {
      const tc = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(d.id);
      const health = computeTurmaHealth({
        startDate: tc.start_date ? String(tc.start_date) : null,
        capacity: tc.capacity != null ? Number(tc.capacity) : null,
        metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
        metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
        matriculados: Number(tc.matriculados || 0),
        confirmados: Number(tc.confirmados || 0),
        status: String(tc.status)
      });
      db.prepare(
        `UPDATE training_classes SET prioridade = ?, last_health_json = ?, updated_at = ? WHERE id = ?`
      ).run(health.prioridade, JSON.stringify(health), nowIso(), d.id);
      syncTurmaAlert(
        d.id,
        String(tc.course_name),
        tc.turma_label ? String(tc.turma_label) : null,
        health
      );
    }
    res.json({ status: "FUNCIONANDO", source: "fixtures", summary, demoTurmas: demos.length });
  });
  router.post("/migration/run-sheet", requirePermission("sheets.sync"), async (req, res) => {
    const client = createSheetsClient({
      enabled: env.googleSheets.enabled,
      credentialsPath: env.googleSheets.credentialsPath,
      credentialsJson: env.googleSheets.credentialsJson
    });
    if (client.mode !== "production" || !env.googleSheets.spreadsheetId) {
      res.status(503).json({
        status: "PENDENTE CREDENCIAL",
        error: "google_sheets_credentials_required",
        hint: "Configure GOOGLE_SHEETS_ENABLED + credentials + SPREADSHEET_ID do piloto 2.0",
        spreadsheetIdExpected: "198Do2Itg7pIfcI4sHjKLIGLJtR1JEfbpir01CVU9Edc"
      });
      return;
    }
    const sheetNames = import_zod8.z.array(import_zod8.z.string()).optional().parse(req.body?.sheets) || [
      "98_RAW_HISTORICO",
      "BASE_INSCRICOES",
      "BASE_PESSOAS",
      "BASE_TURMAS"
    ];
    const tabs = [];
    for (const name of sheetNames) {
      try {
        const { headers, rows } = await client.readRows(env.googleSheets.spreadsheetId, name, 1);
        tabs.push({
          sourceFile: "CONFIRMACOES_2.0_PILOTO",
          sourceSheet: name,
          headers,
          rows: rows.map((r) => headers.map((h) => String(r[h] ?? "")))
        });
      } catch (err) {
        console.warn("sheet read failed", name, err);
      }
    }
    if (!tabs.length) {
      res.status(502).json({ error: "no_sheets_readable", status: "PARCIAL" });
      return;
    }
    const summary = runHistoricalImport(tabs, {
      userId: req.user?.id,
      spreadsheetId: env.googleSheets.spreadsheetId,
      mode: "apply"
    });
    res.json({ status: "FUNCIONANDO", source: "google_sheets", summary });
  });
  router.get("/confirmacoes", requirePermission("dashboard.view"), (req, res) => {
    const turmaId = String(req.query.turmaId || "").trim();
    const statusFilter = String(req.query.contactStatus || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const queue = String(req.query.queue || "aberta");
    const includeClosed = String(req.query.includeClosed || "") === "1";
    const where = ["e.training_class_id IS NOT NULL"];
    const params = [];
    if (turmaId) {
      where.push("e.training_class_id = ?");
      params.push(turmaId);
    }
    if (!includeClosed) {
      where.push(`(t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`);
    }
    if (statusFilter && isContactStatus(statusFilter)) {
      where.push(`COALESCE(e.contact_status, 'nao_contatado') = ?`);
      params.push(statusFilter);
    } else if (queue === "aberta") {
      const open = OPEN_CONTACT_STATUSES.map(() => "?").join(",");
      where.push(`COALESCE(e.contact_status, 'nao_contatado') IN (${open})`);
      params.push(...OPEN_CONTACT_STATUSES);
    } else if (queue === "pendente") {
      where.push(
        `COALESCE(e.contact_status, 'nao_contatado') IN ('nao_contatado','sem_resposta')`
      );
    }
    const rows = db.prepare(
      `SELECT ${CONFIRMACAO_SELECT}
         FROM enrollments e
         JOIN clients c ON c.id = e.client_id
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE ${where.join(" AND ")}
         ORDER BY ${contactStatusSortSql()}, t.start_date IS NULL, t.start_date ASC, c.full_name`
    ).all(...params);
    let items = rows.map(mapConfirmacaoRow);
    if (q) {
      items = items.filter((item) => {
        const hay = `${item.fullName} ${item.phone || ""} ${item.turmaLabel || ""} ${item.courseName || ""} ${item.consultantName || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const allForTotals = db.prepare(
      `SELECT COALESCE(e.contact_status, 'nao_contatado') as contact_status
         FROM enrollments e
         LEFT JOIN training_classes t ON t.id = e.training_class_id
         WHERE e.training_class_id IS NOT NULL
           ${turmaId ? "AND e.training_class_id = ?" : ""}
           ${includeClosed ? "" : `AND (t.status IS NULL OR t.status NOT IN ('ENCERRADA','CANCELADA'))`}`
    ).all(...turmaId ? [turmaId] : []);
    const totals = { all: allForTotals.length };
    for (const s of CONTACT_STATUSES) totals[s] = 0;
    for (const row of allForTotals) {
      const s = normalizeContactStatus(row.contact_status);
      totals[s] = (totals[s] || 0) + 1;
    }
    totals.pendente = (totals.nao_contatado || 0) + (totals.sem_resposta || 0);
    totals.aberta = OPEN_CONTACT_STATUSES.reduce((n, s) => n + (totals[s] || 0), 0);
    const next = items.find((i) => i.contactStatus === "nao_contatado" || i.contactStatus === "sem_resposta") || null;
    res.json({
      items,
      next,
      totals,
      contactStatuses: CONTACT_STATUS_LABEL,
      count: items.length
    });
  });
  router.patch(
    "/enrollments/:enrollmentId/contact",
    requirePermission("clients.edit"),
    (req, res) => {
      const existing = db.prepare(
        `SELECT ${CONFIRMACAO_SELECT}
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.id = ?`
      ).get(req.params.enrollmentId);
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const schema = import_zod8.z.object({
        contactStatus: import_zod8.z.enum(CONTACT_STATUSES).optional(),
        observation: import_zod8.z.string().max(2e3).optional(),
        openedWhatsApp: import_zod8.z.boolean().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }
      const d = parsed.data;
      if (!d.contactStatus && !d.openedWhatsApp && d.observation == null) {
        res.status(400).json({ error: "nothing_to_update" });
        return;
      }
      const current = normalizeContactStatus(
        existing.contact_status ? String(existing.contact_status) : null
      );
      let nextStatus = current;
      if (d.contactStatus) nextStatus = d.contactStatus;
      else if (d.openedWhatsApp && current === "nao_contatado") nextStatus = "contatado";
      const now = nowIso();
      const lastContacted = d.openedWhatsApp || nextStatus !== "nao_contatado" ? now : existing.last_contacted_at ? String(existing.last_contacted_at) : null;
      db.prepare(
        `UPDATE enrollments SET
          contact_status = ?,
          contact_status_updated_at = ?,
          last_contacted_at = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(nextStatus, now, lastContacted, now, req.params.enrollmentId);
      const eventType = d.openedWhatsApp ? "whatsapp_open" : "contact_status";
      db.prepare(
        `INSERT INTO contact_events (
          id, person_id, training_class_id, enrollment_id, occurred_at, type, channel,
          consultant_id, consultant_name, result, observation, source_sheet, source_row,
          raw_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id("ce"),
        String(existing.client_id),
        existing.training_class_id ? String(existing.training_class_id) : null,
        String(req.params.enrollmentId),
        now,
        eventType,
        "whatsapp",
        req.user?.consultantId || null,
        req.user?.name || null,
        nextStatus,
        d.observation || (d.openedWhatsApp ? "Abriu conversa no WhatsApp (envio manual)" : null),
        existing.source_sheet ? String(existing.source_sheet) : null,
        existing.source_row != null ? Number(existing.source_row) : null,
        JSON.stringify({
          openedWhatsApp: Boolean(d.openedWhatsApp),
          from: current,
          to: nextStatus,
          autoSend: false
        }),
        now
      );
      const updated = db.prepare(
        `SELECT ${CONFIRMACAO_SELECT}
           FROM enrollments e
           JOIN clients c ON c.id = e.client_id
           LEFT JOIN training_classes t ON t.id = e.training_class_id
           WHERE e.id = ?`
      ).get(req.params.enrollmentId);
      res.json({ item: mapConfirmacaoRow(updated), previousStatus: current });
    }
  );
  router.post("/turmas", requirePermission("courses.edit"), (req, res) => {
    const schema = import_zod8.z.object({
      courseName: import_zod8.z.string().min(2),
      courseId: import_zod8.z.string().nullable().optional(),
      turmaLabel: import_zod8.z.string().optional(),
      startDate: import_zod8.z.string().nullable().optional(),
      endDate: import_zod8.z.string().nullable().optional(),
      capacity: import_zod8.z.number().int().optional(),
      metaMinima: import_zod8.z.number().int().optional(),
      metaIdeal: import_zod8.z.number().int().optional(),
      status: import_zod8.z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const d = parsed.data;
    const turmaId = id("turma");
    const health = computeTurmaHealth({
      startDate: d.startDate,
      capacity: d.capacity,
      metaMinima: d.metaMinima,
      metaIdeal: d.metaIdeal,
      matriculados: 0,
      confirmados: 0,
      status: d.status || "EM_CAPTACAO"
    });
    db.prepare(
      `INSERT INTO training_classes (
        id, course_id, course_name, turma_label, unidade, start_date, end_date, status,
        capacity, meta_minima, meta_ideal, prioridade, last_health_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Chapec\xF3', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      turmaId,
      d.courseId ?? null,
      d.courseName,
      d.turmaLabel ?? d.courseName,
      d.startDate ?? null,
      d.endDate ?? null,
      d.status || "EM_CAPTACAO",
      d.capacity ?? null,
      d.metaMinima ?? null,
      d.metaIdeal ?? null,
      health.prioridade,
      JSON.stringify(health),
      nowIso(),
      nowIso()
    );
    res.status(201).json({ id: turmaId, health });
  });
  return router;
}
function latestMigrationSummary() {
  const row = db.prepare(`SELECT * FROM import_runs ORDER BY started_at DESC LIMIT 1`).get();
  if (!row) return null;
  return {
    runId: String(row.id),
    status: String(row.status),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    summary: parseJson(String(row.summary_json || "null"), null)
  };
}

// server/src/index.ts
var webDist = webDistDir();
migrate();
runOpsMigrations();
seedIfEmpty();
seedCatalogIfEmpty();
ensureLegacyCourses();
if (!env.isProduction) {
  ensureDemoOpenTurmas();
  refreshDemoTurmaHealth();
}
function refreshDemoTurmaHealth() {
  const demos = db.prepare(`SELECT id FROM training_classes WHERE external_id LIKE 'demo-%'`).all();
  for (const d of demos) {
    const tc = db.prepare("SELECT * FROM training_classes WHERE id = ?").get(d.id);
    const health = computeTurmaHealth({
      startDate: tc.start_date ? String(tc.start_date) : null,
      capacity: tc.capacity != null ? Number(tc.capacity) : null,
      metaMinima: tc.meta_minima != null ? Number(tc.meta_minima) : null,
      metaIdeal: tc.meta_ideal != null ? Number(tc.meta_ideal) : null,
      matriculados: Number(tc.matriculados || 0),
      confirmados: Number(tc.confirmados || 0),
      status: String(tc.status)
    });
    db.prepare(
      `UPDATE training_classes SET prioridade = ?, last_health_json = ?, updated_at = ? WHERE id = ?`
    ).run(health.prioridade, JSON.stringify(health), nowIso(), d.id);
    syncTurmaAlert(
      d.id,
      String(tc.course_name),
      tc.turma_label ? String(tc.turma_label) : null,
      health
    );
  }
}
var app = (0, import_express11.default)();
var PORT = env.port;
app.use(
  (0, import_cors.default)({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS blocked"));
    },
    credentials: true
  })
);
app.use(import_express11.default.json({ limit: "2mb" }));
app.use((0, import_cookie_parser.default)());
app.use("/api", requireSameOrigin);
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "febracis-ops",
    version: "2.1.0",
    product: "FEBRACIS OPS",
    googleAuth: env.googleAuth.enabled,
    googleSheets: env.googleSheets.enabled,
    spa: import_node_fs3.default.existsSync(webDist)
  });
});
app.use("/api/auth", authRoutes());
app.use("/api/users", usersRoutes());
app.use("/api/clients", clientsRoutes());
app.use("/api/consultants", consultantsRoutes());
app.use("/api/dashboard", dashboardRoutes());
app.use("/api/google-sheets", googleSheetsRoutes());
app.use("/api/courses", coursesRoutes());
app.use("/api/crm", crmExtraRoutes());
app.use("/api/ficha", fichaRoutes());
app.use("/api/reports", reportsRoutes());
app.use("/api/ops", opsRoutes());
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err && typeof err === "object" && "message" in err && String(err.message).includes("CORS")) {
    res.status(403).json({ error: "cors_blocked" });
    return;
  }
  if (err && typeof err === "object" && "status" in err && err.status === 400) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  res.status(500).json({
    error: "internal_error",
    ...env.isProduction ? {} : { detail: err instanceof Error ? err.message : "unknown" }
  });
});
if (import_node_fs3.default.existsSync(webDist)) {
  app.use(import_express11.default.static(webDist, { index: false, maxAge: env.isProduction ? "1h" : 0 }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(import_node_path3.default.join(webDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>FEBRACIS OPS API</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">
  <h1>FEBRACIS OPS API</h1>
  <p>SPA n\xE3o encontrada (<code>web/dist</code>). Em Hostinger o ZIP j\xE1 inclui o build.</p>
  <p>Health: <a href="/api/health">/api/health</a></p>
</body></html>`);
  });
}
app.listen(PORT, () => {
  console.log(`FEBRACIS OPS listening on port ${PORT}`);
  console.log(`SPA: ${import_node_fs3.default.existsSync(webDist) ? webDist : "missing"}`);
});
