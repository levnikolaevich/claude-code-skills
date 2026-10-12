export type ValidatorOutcome = {
  state: 'pass' | 'fail' | 'unavailable'
  detail: string
}

export type SkillVerdict = {
  skill: string
  token: string | null
  isVocabulary: boolean
  revision: string
}

export type EvalFreshness = 'current' | 'stale' | 'unbound' | 'not-run'

export type EvalRow = {
  plugin: string
  name: string
  skill: string
  freshness: EvalFreshness
  score: number | null
  isFailing: boolean
  failedGraders: string[]
  source: string
  hostModel: string
}

declare module 'claude-code' {
  interface PluginState {
    'ln-maintainer': {
      validator: ValidatorOutcome | null
      verdicts: SkillVerdict[]
      evals: EvalRow[]
    }
  }
}
