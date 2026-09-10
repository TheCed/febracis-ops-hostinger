/**
 * Potential eligibility — configurable rules.
 * Unknown FEBRACIS business rules are flagged as PENDENTE REGRA DE NEGÓCIO.
 */

export type EligibilityRuleId =
  | 'not_completed_target_course'
  | 'has_any_history'
  | 'exclude_cancelled_only'
  | 'exclude_future_enrollment_same_course'

export interface EligibilityConfig {
  rules: EligibilityRuleId[]
  /** Documented but not enforced until business confirms */
  pendingBusinessRules: string[]
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  rules: ['not_completed_target_course', 'has_any_history', 'exclude_future_enrollment_same_course'],
  pendingBusinessRules: [
    'Prerrequisitos oficiais por curso (ex.: ordem MCIS → …) — PENDENTE REGRA DE NEGÓCIO',
    'Grade / certificado mínimo para elegibilidade — PENDENTE REGRA DE NEGÓCIO',
    'Regras de recompra / transferência recente — PENDENTE REGRA DE NEGÓCIO',
  ],
}

export interface PersonHistoryLite {
  personId: string
  fullName: string
  consultantName: string | null
  grade: string | null
  completedCourseIds: string[]
  enrolledCourseIds: string[]
  lastTurmaLabel: string | null
}

export interface EligibilityResult {
  eligible: boolean
  reasons: string[]
  blockers: string[]
}

export function evaluateEligibility(
  person: PersonHistoryLite,
  targetCourseId: string,
  config: EligibilityConfig = DEFAULT_ELIGIBILITY_CONFIG,
): EligibilityResult {
  const reasons: string[] = []
  const blockers: string[] = []

  for (const rule of config.rules) {
    switch (rule) {
      case 'not_completed_target_course':
        if (person.completedCourseIds.includes(targetCourseId)) {
          blockers.push('Já realizou o curso alvo')
        } else {
          reasons.push('Não possui realização do curso alvo')
        }
        break
      case 'has_any_history':
        if (person.completedCourseIds.length + person.enrolledCourseIds.length === 0) {
          blockers.push('Sem histórico de turmas')
        } else {
          reasons.push('Possui histórico FEBRACIS')
        }
        break
      case 'exclude_future_enrollment_same_course':
        if (person.enrolledCourseIds.includes(targetCourseId)) {
          blockers.push('Já inscrito em turma futura/aberta do mesmo curso')
        }
        break
      case 'exclude_cancelled_only':
        // No-op until enrollment status feeds this path
        break
      default:
        break
    }
  }

  return {
    eligible: blockers.length === 0,
    reasons,
    blockers,
  }
}
