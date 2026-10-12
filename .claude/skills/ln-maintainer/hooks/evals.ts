/** Pure eval bookkeeping: parse result documents and decide each case's freshness. */
import type { EvalRow } from '../types'

export type EvalCase = { plugin: string; name: string; skill: string }
export type EvalResult = {
  score: number | null
  isFailing: boolean
  failedGraders: string[]
  provenance: Record<string, string> | undefined
  source: string
  hostModel: string
  modifiedMs: number
}
type Grader = { name?: unknown; scored?: unknown; passed?: unknown }
type Run = { error?: unknown; graders?: Grader[] }

export const RESULTS_ROOT = '.eval-results'
export const SKIPPED_DIRECTORIES = new Set(['workspace', '.git', 'node_modules', 'home'])

function failedGraders(runs: Run[]): string[] {
  const names = new Set<string>()
  for (const run of runs) {
    for (const grader of run.graders ?? []) {
      if (grader.scored !== false && grader.passed === false && typeof grader.name === 'string') names.add(grader.name)
    }
  }
  return [...names]
}

export function parseJson(text: string): any {
  try {
    return JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return undefined
  }
}

export function isResultDocument(document: any): boolean {
  return document?.schemaVersion === 1 && Array.isArray(document.cases)
}

export function isClaudeDocument(document: any): boolean {
  return isResultDocument(document) && document.cases.some((one: any) => one?.arms)
}

/**
 * Results of the Codex runner (`host: codex`, provenance per case) and of `claude plugin eval`
 * (cases with `arms`; provenance from the sibling provenance.json the CI workflow writes).
 */
export function readResults(document: any, provenanceDocument: any, source: string, modifiedMs: number): Map<string, EvalResult> {
  const results = new Map<string, EvalResult>()
  if (!isResultDocument(document)) return results
  const isClaude = isClaudeDocument(document)
  const threshold = typeof document.threshold === 'number' ? document.threshold : 1
  for (const one of document.cases) {
    if (typeof one?.name !== 'string') continue
    const runs: Run[] = isClaude ? one.arms?.with ?? [] : one.runs ?? []
    const score = typeof one.score === 'number' ? one.score : typeof one.aggregates?.score === 'number' ? one.aggregates.score : null
    results.set(one.name, {
      score,
      isFailing: score === null || score < threshold || runs.some(run => typeof run.error === 'string' && run.error !== ''),
      failedGraders: failedGraders(runs),
      provenance: (isClaude ? provenanceDocument?.cases?.[one.name]?.files : one.provenance?.files) ?? undefined,
      source,
      hostModel: `${isClaude ? 'claude' : document.host ?? '?'} ${document.model || 'default'}`,
      modifiedMs,
    })
  }
  return results
}

/** Keeps the newest result of each case. */
export function mergeLatest(into: Map<string, EvalResult>, from: Map<string, EvalResult>) {
  for (const [name, result] of from) {
    const known = into.get(name)
    if (!known || known.modifiedMs < result.modifiedMs) into.set(name, result)
  }
}

export function toRows(cases: EvalCase[], results: Map<string, EvalResult>, hashes: Map<string, string>): EvalRow[] {
  return cases.map(evalCase => {
    const result = results.get(evalCase.name)
    if (!result) return { ...evalCase, freshness: 'not-run', score: null, isFailing: false, failedGraders: [], source: '', hostModel: '' }
    const provenance = result.provenance
    const freshness = !provenance ? 'unbound' : Object.entries(provenance).every(([path, hash]) => hashes.get(path) === hash) ? 'current' : 'stale'
    return { ...evalCase, freshness, score: result.score, isFailing: result.isFailing, failedGraders: result.failedGraders, source: result.source, hostModel: result.hostModel }
  })
}

export function needsAttention(row: EvalRow): boolean {
  return row.freshness !== 'current' || row.isFailing
}

export function summarize(rows: EvalRow[]): string {
  const count = (freshness: EvalRow['freshness']) => rows.filter(row => row.freshness === freshness).length
  const passing = rows.filter(row => row.freshness === 'current' && !row.isFailing).length
  return `${rows.length} cases: ${passing} current and passing, ${count('current') - passing} current and failing, ${count('stale')} stale, ${count('unbound')} unbound, ${count('not-run')} NOT RUN`
}

const MARK: Record<EvalRow['freshness'], string> = { current: 'current', stale: 'STALE', unbound: 'unbound', 'not-run': 'NOT RUN' }

export function describeRow(row: EvalRow): string {
  const outcome = row.freshness === 'not-run' ? '    ' : row.isFailing ? 'FAIL' : 'pass'
  const score = row.score === null ? '-' : row.score.toFixed(2)
  const failed = row.failedGraders.length ? `  failed: ${row.failedGraders.join(', ')}` : ''
  return `${MARK[row.freshness].padEnd(8)} ${outcome} ${score.padStart(4)}  ${row.name}  ${row.hostModel}${failed}`
}
