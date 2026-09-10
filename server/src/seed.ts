import bcrypt from 'bcryptjs'
import { db, migrate } from './lib/db.js'
import { ROLE_PERMISSIONS } from './lib/permissions.js'
import { id, nowIso } from './lib/utils.js'
import { env } from './config/env.js'

function count(table: string) {
  return Number((db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c)
}

/** Production / Hostinger: create exactly one admin when DB is empty. */
function tryBootstrapAdmin(): { created: boolean } {
  const { email, password, name } = env.bootstrapAdmin
  if (!email || !password) return { created: false }
  if (password.length < 10) {
    console.warn('[seed] BOOTSTRAP_ADMIN_PASSWORD too short (min 10). Skipped.')
    return { created: false }
  }
  const createdAt = nowIso()
  db.prepare(
    `INSERT INTO users
      (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', 'active', ?, ?, NULL, ?, ?)`,
  ).run(
    id('user'),
    name,
    email,
    bcrypt.hashSync(password, 12),
    JSON.stringify(ROLE_PERMISSIONS.admin),
    createdAt,
    createdAt,
  )
  console.log(`[seed] Bootstrap admin created: ${email}`)
  return { created: true }
}

export function seedIfEmpty() {
  if (count('users') > 0) return { seeded: false }

  const bootstrap = tryBootstrapAdmin()
  if (bootstrap.created) return { seeded: true, bootstrap: true as const }

  if (!env.allowDemoSeed) {
    console.warn(
      '[seed] Skipped demo seed (production / ALLOW_DEMO_SEED=false). Set BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD.',
    )
    return { seeded: false, skipped: true as const }
  }

  const createdAt = nowIso()

  const consultants = [
    {
      id: 'consultant-vanessa',
      name: 'Vanessa',
      email: 'vanessa@febracis.local',
      phone: '(49) 99999-1001',
    },
    {
      id: 'consultant-lucas',
      name: 'Lucas',
      email: 'lucas@febracis.local',
      phone: '(49) 99999-1002',
    },
    {
      id: 'consultant-maria',
      name: 'Maria',
      email: 'maria@febracis.local',
      phone: '(49) 99999-1003',
    },
  ]

  const insertConsultant = db.prepare(
    `INSERT INTO consultants (id, name, email, phone, active, user_id, goals_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?)`,
  )

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
        revenueTarget: null,
      }),
      createdAt,
      createdAt,
    )
  }

  const users = [
    {
      id: 'user-admin',
      name: 'Administrador',
      email: 'admin@febracis.local',
      role: 'admin' as const,
      password: 'admin123',
      consultantId: null as string | null,
    },
    {
      id: 'user-comercial',
      name: 'Comercial Demo',
      email: 'comercial@febracis.local',
      role: 'comercial' as const,
      password: 'comercial123',
      consultantId: 'consultant-vanessa',
    },
  ]

  const insertUser = db.prepare(
    `INSERT INTO users
      (id, name, email, role, status, password_hash, permissions_json, consultant_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )

  for (const u of users) {
    insertUser.run(
      u.id,
      u.name,
      u.email,
      u.role,
      bcrypt.hashSync(u.password, 12),
      JSON.stringify(ROLE_PERMISSIONS[u.role]),
      u.consultantId,
      createdAt,
      createdAt,
    )
  }

  const sampleCourses = [
    { courseId: 'm-cis', completed: true, decision: false },
    { courseId: 'fcis', completed: true, decision: true },
    { courseId: 'ml5', completed: false, decision: true },
    { courseId: 'ceop', completed: false, decision: false },
  ]

  const clients = [
    {
      fullName: 'Alexandre Marcos Bertagnolli',
      preferredName: 'Alexandre',
      consultantId: 'consultant-vanessa',
      consultantName: 'Vanessa',
      status: 'active',
      presence: 'present',
      phone: '(49) 99111-2233',
      email: 'alexandre@email.com',
      tags: ['quente', 'empresario'],
      trainingLabel: 'Método CIS',
      observations: 'Interessado em FCIS completo.',
    },
    {
      fullName: 'Bárbara Hofmann Molon',
      preferredName: 'Bárbara',
      consultantId: 'consultant-vanessa',
      consultantName: 'Vanessa',
      status: 'negotiating',
      presence: 'present',
      phone: '(49) 99222-3344',
      email: 'barbara@email.com',
      tags: ['follow-up'],
      trainingLabel: 'FCIS',
      observations: '',
    },
    {
      fullName: 'Carlos Eduardo Silva',
      preferredName: 'Carlos',
      consultantId: 'consultant-lucas',
      consultantName: 'Lucas',
      status: 'lead',
      presence: 'unknown',
      phone: '(49) 99333-4455',
      email: null,
      tags: ['novo'],
      trainingLabel: 'ML5',
      observations: 'Indicação de parceiro.',
    },
    {
      fullName: 'Daniela Souza',
      preferredName: 'Daniela',
      consultantId: 'consultant-maria',
      consultantName: 'Maria',
      status: 'won',
      presence: 'present',
      phone: '(49) 99444-5566',
      email: 'daniela@email.com',
      tags: ['vip'],
      trainingLabel: 'CEOP',
      observations: 'Fechou pacote anual.',
    },
    {
      fullName: 'Eduardo Pires',
      preferredName: 'Eduardo',
      consultantId: 'consultant-lucas',
      consultantName: 'Lucas',
      status: 'inactive',
      presence: 'absent',
      phone: '(49) 99555-6677',
      email: 'eduardo@email.com',
      tags: ['reativar'],
      trainingLabel: 'Método CIS',
      observations: 'Não compareceu no último evento.',
    },
    {
      fullName: 'Fernanda Costa',
      preferredName: 'Fernanda',
      consultantId: 'consultant-maria',
      consultantName: 'Maria',
      status: 'active',
      presence: 'present',
      phone: '(49) 99666-7788',
      email: 'fernanda@email.com',
      tags: ['quente'],
      trainingLabel: 'BHP',
      observations: '',
    },
  ]

  const insertClient = db.prepare(
    `INSERT INTO clients (
      id, sheet_row_id, sheet_key, full_name, preferred_name, email, phone, phone_normalized,
      whatsapp, consultant_id, consultant_name, status, presence, tags_json, training_label,
      event_date, observations, courses_json, source, created_at, updated_at, synced_at
    ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, NULL)`,
  )

  const insertActivity = db.prepare(
    `INSERT INTO client_activity (id, client_id, type, message, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  for (const client of clients) {
    const clientId = id('client')
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
      '2026-09-15',
      client.observations || null,
      JSON.stringify(sampleCourses),
      createdAt,
      createdAt,
    )
    insertActivity.run(
      id('act'),
      clientId,
      'other',
      'Cliente importado no seed inicial',
      'user-admin',
      createdAt,
    )
  }

  return { seeded: true }
}

export function seedCatalogIfEmpty() {
  const courseCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number }).c,
  )
  if (courseCount === 0) {
    const createdAt = nowIso()
    const courses = [
      {
        id: 'm-cis',
        name: 'Método CIS',
        category: 'imersao',
        color: 'green',
        stacked: 0,
        price: 'R$ 1.997,00',
        order: 1,
      },
      {
        id: 'fcis',
        name: 'FCIS - Formação em Coaching Integral Sistêmico',
        category: 'formacao',
        color: 'yellow',
        stacked: 1,
        price: 'R$ 10.796,40',
        order: 2,
      },
      {
        id: 'ml5',
        name: 'ML5 - Formação de Líderes',
        category: 'formacao',
        color: 'yellow',
        stacked: 1,
        price: 'R$ 7.197,00',
        order: 3,
      },
      {
        id: 'ceop',
        name: 'CEOP - Comunicação Eficaz e Oratória Persuasiva',
        category: 'formacao',
        color: 'yellow',
        stacked: 0,
        price: 'R$ 5.996,40',
        order: 4,
      },
      {
        id: 'bhp',
        name: 'BHP - Gestão de Negócios',
        category: 'gestao',
        color: 'green',
        stacked: 0,
        price: 'R$ 5.996,40',
        order: 5,
      },
    ]
    const insert = db.prepare(
      `INSERT INTO courses (
        id, name, short_name, category, description, status, price_label, price_amount, currency,
        marker_color, stacked, sheet_column_key, sort_order, capacity, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, 'active', ?, NULL, 'BRL', ?, ?, NULL, ?, NULL, ?, ?)`,
    )
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
        createdAt,
      )
    }
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, 'm-cis', 'Método CIS — Setembro 2026', '2026-09-15', '2026-09-17', '15 a 17 | SET', 'scheduled', 'Chapecó', 40, ?, ?)`,
    ).run(id('event'), createdAt, createdAt)
    db.prepare(
      `INSERT INTO course_events (id, course_id, name, start_date, end_date, date_label, status, location, capacity, created_at, updated_at)
       VALUES (?, 'm-cis', 'Método CIS — Dezembro 2026', '2026-12-10', '2026-12-12', '10 a 12 | DEZ', 'scheduled', 'Chapecó', 40, ?, ?)`,
    ).run(id('event'), createdAt, createdAt)
  }

  const stageCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM pipeline_stages').get() as { c: number }).c,
  )
  if (stageCount === 0) {
    const stages = [
      ['novo', 'Novo', 1, '#64748b'],
      ['contato', 'Contato', 2, '#2563eb'],
      ['qualificado', 'Qualificado', 3, '#7c3aed'],
      ['follow-up', 'Follow-up', 4, '#d97706'],
      ['decisao', 'Decisão', 5, '#d4a437'],
      ['convertido', 'Convertido', 6, '#15803d'],
      ['perdido', 'Perdido', 7, '#b91c1c'],
    ]
    const insert = db.prepare(
      `INSERT INTO pipeline_stages (id, name, slug, sort_order, color, active) VALUES (?, ?, ?, ?, ?, 1)`,
    )
    for (const [slug, name, order, color] of stages) {
      insert.run(id('stage'), name, slug, order, color)
    }
  }
}

const isDirectRun =
  process.argv[1]?.replace(/\\/g, '/').endsWith('/seed.ts') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('/seed.js')

if (isDirectRun) {
  migrate()
  const result = seedIfEmpty()
  seedCatalogIfEmpty()
  console.log(result.seeded ? 'Database seeded.' : 'Database already has data; seed skipped.')
}
