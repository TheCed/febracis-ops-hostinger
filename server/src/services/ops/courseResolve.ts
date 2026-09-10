import { db } from '../../lib/db.js'
import { id, nowIso } from '../../lib/utils.js'

const COURSE_ALIASES: Record<string, string> = {
  mcis: 'm-cis',
  'm-cis': 'm-cis',
  'método cis': 'm-cis',
  metodo: 'm-cis',
  if: 'if',
  ceop: 'ceop',
  ml5: 'ml5',
  bhp: 'bhp',
  fcis: 'fcis',
  pep: 'pep',
  fgpc: 'fgpc',
  tv: 'tv',
  lider: 'lider',
  master: 'master',
  ci: 'ci',
  maestria: 'maestria',
}

/** Resolve catalog course id from sheet/turma label hint. */
export function resolveCourseId(hint: string): string | null {
  const key = hint.trim().toLowerCase()
  const alias = COURSE_ALIASES[key]
  if (alias) {
    const row = db.prepare('SELECT id FROM courses WHERE id = ?').get(alias) as
      | { id: string }
      | undefined
    if (row) return row.id
  }
  const byId = db.prepare('SELECT id FROM courses WHERE lower(id) = ?').get(key) as
    | { id: string }
    | undefined
  if (byId) return byId.id
  const byShort = db
    .prepare('SELECT id FROM courses WHERE lower(short_name) = ? OR lower(name) LIKE ? LIMIT 1')
    .get(key, `%${key}%`) as { id: string } | undefined
  return byShort?.id ?? null
}

/** Placeholder course when historical aba does not map to catalog. */
export function ensureUnknownCourseId(): string {
  const existing = db.prepare(`SELECT id FROM courses WHERE id = 'course_unknown'`).get() as
    | { id: string }
    | undefined
  if (existing) return existing.id
  const createdAt = nowIso()
  db.prepare(
    `INSERT INTO courses (
      id, name, short_name, category, description, status, price_label, marker_color,
      stacked, sort_order, created_at, updated_at
    ) VALUES ('course_unknown', 'Histórico / Sem catálogo', 'UNKNOWN', 'ops',
      'Curso placeholder para inscrições históricas sem match de catálogo',
      'active', NULL, 'gray', 0, 9999, ?, ?)`,
  ).run(createdAt, createdAt)
  return 'course_unknown'
}

export function ensureDemoOpenTurmas() {
  const demos = [
    {
      key: 'demo-ceop-06',
      courseId: 'ceop',
      courseName: 'CEOP',
      turmaLabel: 'CEOP 06',
      days: 12,
      metaMinima: 50,
      metaIdeal: 60,
      capacity: 70,
      matriculados: 28,
      confirmados: 25,
    },
    {
      key: 'demo-ml5-04',
      courseId: 'ml5',
      courseName: 'ML5',
      turmaLabel: 'ML5 04',
      days: 7,
      metaMinima: 40,
      metaIdeal: 50,
      capacity: 55,
      matriculados: 18,
      confirmados: 14,
    },
    {
      key: 'demo-if-10',
      courseId: 'if',
      courseName: 'IF',
      turmaLabel: 'IF 10',
      days: 20,
      metaMinima: null as number | null,
      metaIdeal: null as number | null,
      capacity: 80,
      matriculados: 5,
      confirmados: 3,
    },
  ]

  for (const d of demos) {
    const existing = db
      .prepare('SELECT id FROM training_classes WHERE external_id = ?')
      .get(d.key) as { id: string } | undefined
    const start = new Date()
    start.setDate(start.getDate() + d.days)
    const startDate = start.toISOString().slice(0, 10)
    if (existing) {
      db.prepare(
        `UPDATE training_classes SET
          start_date = ?, status = 'EM_CAPTACAO', meta_minima = ?, meta_ideal = ?,
          capacity = ?, matriculados = ?, confirmados = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        startDate,
        d.metaMinima,
        d.metaIdeal,
        d.capacity,
        d.matriculados,
        d.confirmados,
        nowIso(),
        existing.id,
      )
      continue
    }
    db.prepare(
      `INSERT INTO training_classes (
        id, course_id, course_code, course_name, turma_label, unidade, status,
        start_date, capacity, meta_minima, meta_ideal, matriculados, confirmados,
        external_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Chapecó', 'EM_CAPTACAO', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id('turma'),
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
      nowIso(),
    )
  }
}

export function ensureDemoConfirmacaoQueue() {
  const classes = db
    .prepare(
      `SELECT id, course_id, course_name FROM training_classes WHERE external_id LIKE 'demo-%' ORDER BY turma_label`,
    )
    .all() as Array<{ id: string; course_id: string | null; course_name: string }>
  if (!classes.length) return

  const people = db
    .prepare(`SELECT id, full_name FROM clients ORDER BY full_name LIMIT 12`)
    .all() as Array<{ id: string; full_name: string }>
  if (!people.length) return

  const insert = db.prepare(
    `INSERT INTO enrollments (
      id, client_id, course_id, event_id, training_class_id, status, confirmation_status,
      present, completed, decision, contact_status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, 'inscrito', ?, 0, 0, 0, 'nao_contatado', ?, ?, ?)`,
  )

  for (let i = 0; i < classes.length; i++) {
    const tc = classes[i]
    const count = Number(
      (db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE training_class_id = ?').get(tc.id) as {
        c: number
      }).c,
    )
    if (count > 0) continue
    const slice = people.slice(i * 2, i * 2 + 4)
    const courseId = tc.course_id || ensureUnknownCourseId()
    for (let p = 0; p < slice.length; p++) {
      const person = slice[p]
      const exists = db
        .prepare(
          `SELECT id FROM enrollments WHERE client_id = ? AND course_id = ? AND training_class_id = ?`,
        )
        .get(person.id, courseId, tc.id) as { id: string } | undefined
      if (exists) continue
      insert.run(
        id('enr'),
        person.id,
        courseId,
        tc.id,
        p === 0 ? 'Confirmado' : 'Aguardando',
        'Fila demo de contato WhatsApp (manual)',
        nowIso(),
        nowIso(),
      )
    }
  }
}
