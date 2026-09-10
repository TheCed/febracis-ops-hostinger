export type TurmaPriority =
  | 'CRITICA'
  | 'ALTA'
  | 'ATENCAO'
  | 'SAUDAVEL'
  | 'META_ATINGIDA'
  | 'DEFINIR_META'
  | 'SEM_ACAO'

export interface TurmaHealthInput {
  startDate?: string | null
  capacity?: number | null
  metaMinima?: number | null
  metaIdeal?: number | null
  matriculados: number
  confirmados: number
  status?: string | null
  /** Optional observed confirmation velocity (per day) */
  ritmoHistorico?: number | null
  ritmo7d?: number | null
  ritmo14d?: number | null
  now?: Date
}

export interface TurmaHealth {
  matriculados: number
  confirmados: number
  faltaMetaMinima: number | null
  faltaMetaIdeal: number | null
  vagasCapacidade: number | null
  ocupacaoMeta: number | null
  ocupacaoCapacidade: number | null
  diasParaInicio: number | null
  ritmoNecessarioDia: number | null
  forecastConfirmados: number | null
  desvioForecastMeta: number | null
  prioridade: TurmaPriority
  reasons: string[]
}

function daysUntil(isoDate: string | null | undefined, now: Date): number | null {
  if (!isoDate) return null
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate)
  if (Number.isNaN(d.getTime())) return null
  const ms = d.getTime() - now.getTime()
  return Math.ceil(ms / 86400000)
}

/**
 * Configurable health engine. Labels mirror Sheet 2.0 piloto; formulas are backend-owned.
 */
export function computeTurmaHealth(input: TurmaHealthInput): TurmaHealth {
  const now = input.now ?? new Date()
  const confirmados = Math.max(0, input.confirmados)
  const matriculados = Math.max(0, input.matriculados)
  const metaMin = input.metaMinima ?? null
  const metaIdeal = input.metaIdeal ?? null
  const capacity = input.capacity ?? null
  const dias = daysUntil(input.startDate, now)

  const faltaMetaMinima = metaMin == null ? null : Math.max(0, metaMin - confirmados)
  const faltaMetaIdeal = metaIdeal == null ? null : Math.max(0, metaIdeal - confirmados)
  const vagasCapacidade = capacity == null ? null : Math.max(0, capacity - matriculados)
  const ocupacaoMeta =
    metaMin && metaMin > 0 ? Math.round((confirmados / metaMin) * 1000) / 10 : null
  const ocupacaoCapacidade =
    capacity && capacity > 0 ? Math.round((matriculados / capacity) * 1000) / 10 : null

  const ritmoNecessarioDia =
    faltaMetaMinima != null && dias != null && dias > 0
      ? Math.round((faltaMetaMinima / dias) * 100) / 100
      : faltaMetaMinima != null && dias != null && dias <= 0
        ? faltaMetaMinima
        : null

  const velocity =
    input.ritmo7d ?? input.ritmo14d ?? input.ritmoHistorico ?? null
  let forecastConfirmados: number | null = null
  let desvioForecastMeta: number | null = null
  if (velocity != null && dias != null && dias > 0) {
    forecastConfirmados = Math.round(confirmados + velocity * dias)
    if (metaMin != null) desvioForecastMeta = forecastConfirmados - metaMin
  }

  const reasons: string[] = []
  let prioridade: TurmaPriority = 'SEM_ACAO'

  if (input.status === 'CANCELADA' || input.status === 'ENCERRADA') {
    prioridade = 'SEM_ACAO'
    reasons.push('Turma encerrada ou cancelada')
  } else if (metaMin == null || metaMin <= 0) {
    prioridade = 'DEFINIR_META'
    reasons.push('Meta mínima não definida')
  } else if (confirmados >= metaMin) {
    prioridade = 'META_ATINGIDA'
    reasons.push('Meta mínima atingida')
  } else if (dias != null && dias <= 7 && (ocupacaoMeta ?? 0) < 60) {
    prioridade = 'CRITICA'
    reasons.push('≤7 dias e ocupação da meta < 60%')
  } else if (dias != null && dias <= 14 && (ocupacaoMeta ?? 0) < 75) {
    prioridade = 'ALTA'
    reasons.push('≤14 dias e ocupação da meta < 75%')
  } else if (ritmoNecessarioDia != null && ritmoNecessarioDia >= 2) {
    prioridade = 'ALTA'
    reasons.push('Ritmo necessário ≥ 2 confirmações/dia')
  } else if ((ocupacaoMeta ?? 100) < 85) {
    prioridade = 'ATENCAO'
    reasons.push('Ocupação da meta < 85%')
  } else {
    prioridade = 'SAUDAVEL'
    reasons.push('Dentro do ritmo esperado')
  }

  if (desvioForecastMeta != null && desvioForecastMeta < 0 && prioridade === 'SAUDAVEL') {
    prioridade = 'ATENCAO'
    reasons.push(`Forecast abaixo da meta (${desvioForecastMeta})`)
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
    reasons,
  }
}
