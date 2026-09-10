import { db } from '../../lib/db.js'
import { id, nowIso } from '../../lib/utils.js'
import type { TurmaHealth, TurmaPriority } from './turmaHealth.js'

/**
 * Alerts fire on priority/threshold change — not on every refresh (anti-spam).
 */
export function syncTurmaAlert(
  classId: string,
  courseName: string,
  turmaLabel: string | null,
  health: TurmaHealth,
) {
  const label = turmaLabel || courseName
  const key = `priority:${health.prioridade}`
  const existing = db
    .prepare(
      `SELECT id, alert_key, active FROM turma_alerts
       WHERE training_class_id = ? AND active = 1
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(classId) as { id: string; alert_key: string; active: number } | undefined

  if (existing?.alert_key === key) {
    return // same state — no spam
  }

  if (existing) {
    db.prepare(`UPDATE turma_alerts SET active = 0, updated_at = ? WHERE id = ?`).run(
      nowIso(),
      existing.id,
    )
  }

  if (health.prioridade === 'SEM_ACAO' || health.prioridade === 'SAUDAVEL') {
    return
  }

  const title = buildTitle(label, health.prioridade, health)
  const body = health.reasons.join(' · ')
  db.prepare(
    `INSERT INTO turma_alerts (
      id, training_class_id, alert_key, title, body, prioridade, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(training_class_id, alert_key) DO UPDATE SET
      title = excluded.title,
      body = excluded.body,
      active = 1,
      updated_at = excluded.updated_at`,
  ).run(id('talert'), classId, key, title, body, health.prioridade, nowIso(), nowIso())
}

function buildTitle(label: string, p: TurmaPriority, h: TurmaHealth): string {
  const days = h.diasParaInicio
  const occ = h.ocupacaoMeta
  switch (p) {
    case 'CRITICA':
      return `${label} entrou em prioridade CRÍTICA.`
    case 'ALTA':
      if (h.ritmoNecessarioDia != null) {
        return `${label} precisa de aproximadamente ${h.ritmoNecessarioDia} confirmações/dia para a meta mínima.`
      }
      return `${label} está em prioridade ALTA.`
    case 'DEFINIR_META':
      return `${label} está sem meta mínima definida.`
    case 'ATENCAO':
      if (days != null && occ != null) {
        return `${label} começa em ${days} dias e está com ${occ}% da meta.`
      }
      return `${label} precisa de atenção.`
    case 'META_ATINGIDA':
      return `${label} atingiu a meta mínima.`
    default:
      return `${label}: ${p}`
  }
}

export function listActiveAlerts(limit = 40) {
  return db
    .prepare(
      `SELECT a.*, t.course_name, t.turma_label
       FROM turma_alerts a
       JOIN training_classes t ON t.id = a.training_class_id
       WHERE a.active = 1
       ORDER BY a.updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<Record<string, unknown>>
}
