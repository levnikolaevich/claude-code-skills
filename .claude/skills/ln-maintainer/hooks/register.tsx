import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput, ToolCallResult } from 'claude-code'

import type { SkillVerdict, ValidatorOutcome } from '../types'
import type { EvalCase, EvalResult } from './evals'
import { describeRow, isClaudeDocument, mergeLatest, needsAttention, parseJson, readResults, RESULTS_ROOT, SKIPPED_DIRECTORIES, summarize, toRows } from './evals'
import { inRepository, resultToken, skillOf, toRepositoryPath, VALIDATE_COMMAND, validatorDetail, vocabularyTokens, WATCHED } from './repo'

const PANE = 'ln-evals'
const COMMAND = 'ln-evals'
const STORE_KEY = 'verdicts'
const validatorState = atom({ plugin: 'ln-maintainer', key: 'validator' } as const, null)
const verdictsState = atom({ plugin: 'ln-maintainer', key: 'verdicts' } as const, [])
const rowsState = atom({ plugin: 'ln-maintainer', key: 'evals' } as const, [])

// Module state: a hot reload runs register again and starts these over, which is what a fresh load should do.
let isValidating = true
let pwsh = 'pwsh'
let currentRun: Promise<ValidatorOutcome> | undefined
let queuedRun: Promise<ValidatorOutcome> | undefined
let isUnavailable = false
let treeDigest: string | undefined
let activeSkill: string | undefined
let vocabulary: Set<string> | undefined

async function runValidator($: EngineInterface): Promise<ValidatorOutcome> {
  try {
    const run = await $.process.run([pwsh, '-NoProfile', '-NonInteractive', '-Command', VALIDATE_COMMAND], { cwd: await $.session.root(), timeoutMs: 120_000 })
    return { state: run.exitCode === 0 ? 'pass' : 'fail', detail: validatorDetail(run.exitCode, run.stdout, run.stderr) }
  } catch (error) {
    return { state: 'unavailable', detail: error instanceof Error ? error.message : String(error) }
  }
}

// One run at a time; edits made while it runs share a single follow-up run.
function validate($: EngineInterface): Promise<ValidatorOutcome> {
  if (!currentRun) {
    currentRun = runValidator($).finally(() => {
      currentRun = undefined
    })
    return currentRun
  }
  queuedRun ??= currentRun.then(() => {
    queuedRun = undefined
    return validate($)
  })
  return queuedRun
}

async function report($: EngineInterface, outcome: ValidatorOutcome) {
  await update($, validatorState, () => outcome)
  if (outcome.state === 'unavailable') {
    isUnavailable = true
    $.ui.status(undefined)
    $.ui.toast(`ln-maintainer: validator unavailable (${outcome.detail.slice(0, 80)}); set pwshPath in /config`)
    return
  }
  $.ui.status(outcome.state === 'pass' ? 'validator ✓' : `validator ✗ ${outcome.detail.slice(0, 90)}`)
}

async function treeStatus($: EngineInterface): Promise<string> {
  const status = await $.process.run(['git', 'status', '--porcelain'], { cwd: await $.session.root() })
  return status.exitCode === 0 ? status.stdout : ''
}

async function revision($: EngineInterface): Promise<string> {
  const head = await $.process.run(['git', 'rev-parse', '--short', 'HEAD'], { cwd: await $.session.root() })
  const short = head.exitCode === 0 ? head.stdout.trim() : 'no-git'
  return (await treeStatus($)).trim() === '' ? short : `${short}*`
}

async function recordVerdict($: EngineInterface, skill: string, answer: string) {
  if (!vocabulary) {
    vocabulary = await $.fs.read(inRepository(await $.session.root(), 'SKILL_TEMPLATE.md')).then(vocabularyTokens, () => new Set<string>())
  }
  const token = resultToken(answer)
  const verdict: SkillVerdict = { skill, token, isVocabulary: token !== null && vocabulary.has(token), revision: await revision($) }
  $.ui.status(`${skill} ${token ?? '?'} · ${verdict.revision}`)
  if (!verdict.isVocabulary && vocabulary.size > 0) $.ui.toast(`${skill}: the Result field does not start with a shared vocabulary verdict token`)
  const history = await update($, verdictsState, list => [...list, verdict].slice(-50))
  await $.store.set(STORE_KEY, history)
}

async function listCases($: EngineInterface, root: string): Promise<EvalCase[]> {
  const cases: EvalCase[] = []
  for (const plugin of await $.fs.list(inRepository(root, 'plugins'))) {
    if (plugin.kind !== 'dir' || !(await $.fs.exists(inRepository(root, `plugins/${plugin.name}/evals`)))) continue
    for (const entry of await $.fs.list(inRepository(root, `plugins/${plugin.name}/evals`))) {
      if (entry.kind !== 'dir' || entry.name === 'results') continue
      const fired = await $.fs.read(inRepository(root, `plugins/${plugin.name}/evals/${entry.name}/graders/skill-fired.md`)).catch(() => '')
      cases.push({ plugin: plugin.name, name: entry.name, skill: skillOf(fired) ?? '?' })
    }
  }
  return cases.sort((a, b) => a.plugin.localeCompare(b.plugin) || a.name.localeCompare(b.name))
}

async function listJsonFiles($: EngineInterface, root: string, directory: string, depth: number): Promise<string[]> {
  if (depth < 0) return []
  const files: string[] = []
  for (const entry of await $.fs.list(inRepository(root, directory))) {
    const path = `${directory}/${entry.name}`
    if (entry.kind === 'dir' && !SKIPPED_DIRECTORIES.has(entry.name)) files.push(...(await listJsonFiles($, root, path, depth - 1)))
    if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name !== 'provenance.json') files.push(path)
  }
  return files
}

async function collectRows($: EngineInterface) {
  const root = await $.session.root()
  const cases = await listCases($, root)
  const results = new Map<string, EvalResult>()
  if (await $.fs.exists(inRepository(root, RESULTS_ROOT))) {
    for (const path of await listJsonFiles($, root, RESULTS_ROOT, 5)) {
      const document = parseJson(await $.fs.read(inRepository(root, path)))
      const provenancePath = inRepository(root, path.replace(/[^/]+$/, 'provenance.json'))
      const sibling = isClaudeDocument(document) ? parseJson(await $.fs.read(provenancePath).catch(() => '')) : undefined
      mergeLatest(results, readResults(document, sibling, path, (await $.fs.stat(inRepository(root, path))).mtimeMs))
    }
  }
  const paths: string[] = []
  for (const result of results.values()) {
    for (const path of Object.keys(result.provenance ?? {})) if (!paths.includes(path) && (await $.fs.exists(inRepository(root, path)))) paths.push(path)
  }
  const hashes = new Map<string, string>()
  if (paths.length > 0) {
    const run = await $.process.run(['git', 'hash-object', '--stdin-paths'], { cwd: root, stdin: paths.join('\n') + '\n' })
    if (run.exitCode === 0) run.stdout.trim().split(/\r?\n/).forEach((hash, index) => hashes.set(paths[index] as string, hash.trim()))
  }
  return toRows(cases, results, hashes)
}

/** After an edit to a contract-owning file, validate and tell the model when the repository no longer passes. */
async function afterEdit($: EngineInterface, e: ToolCallInput, next: (e: ToolCallInput) => Promise<ToolCallResult>): Promise<ToolCallResult> {
  const ran = await next(e)
  if (!isValidating || isUnavailable || ran.deny !== undefined || ran.isError) return ran
  const fields = e as { file_path?: unknown; notebook_path?: unknown }
  const path = typeof fields.file_path === 'string' ? fields.file_path : fields.notebook_path
  const relative = typeof path === 'string' ? toRepositoryPath(await $.session.root(), path) : undefined
  if (relative === undefined || !WATCHED.test(relative)) return ran
  const outcome = await validate($)
  await report($, outcome)
  if (outcome.state !== 'fail') return ran
  const note = `Repository validator fails after editing ${relative}: ${outcome.detail.replace(/\.$/, '')}. This is expected while a multi-file change is in progress; resolve it before finishing.`
  return { ...ran, context: [...(ran.context ?? []), note] }
}

/**
 * Maintainer tooling for this repository only, never distributed with the skill plugins.
 * It observes and reports: it spawns no agents, submits no prompts, calls no models and registers no tools.
 */
export const register: Register = (on, options) => {
  isValidating = options.validateOnEdit !== false
  pwsh = typeof options.pwshPath === 'string' && options.pwshPath !== '' ? options.pwshPath : 'pwsh'
  currentRun = queuedRun = treeDigest = activeSkill = vocabulary = undefined
  isUnavailable = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: COMMAND, description: 'Show every eval case with its latest result and whether it still binds to the current skill' })
    const stored = await $.store.get(STORE_KEY)
    if (Array.isArray(stored)) await update($, verdictsState, () => stored as SkillVerdict[])
    if (isValidating) treeDigest = await treeStatus($)
    return result
  })

  on('turn.start', ($, e, next) => {
    activeSkill = undefined
    return next(e)
  })

  on('skill.prompt', ($, e, next) => {
    activeSkill = skillOf(e.skill) ?? activeSkill
    return next(e)
  })

  on('tool.call', { tool: 'Edit' }, afterEdit)
  on('tool.call', { tool: 'Write' }, afterEdit)
  on('tool.call', { tool: 'NotebookEdit' }, afterEdit)

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.isAborted) return result
    const skill = activeSkill
    activeSkill = undefined
    if (skill) await recordVerdict($, skill, e.answer)
    // Shell edits (sed, scripts) reach no Edit hook: validate the final tree once per main-loop turn.
    if (isValidating && !isUnavailable) {
      const now = await treeStatus($)
      if (now !== treeDigest) {
        treeDigest = now
        const outcome = await validate($)
        await report($, outcome)
        if (outcome.state === 'fail') $.ui.toast(`Repository validator fails: ${outcome.detail.slice(0, 120)}`)
      }
    }
    return result
  })

  on('command.run', { command: COMMAND }, async $ => {
    const rows = await collectRows($)
    await update($, rowsState, () => rows)
    await $.ui.open({ id: PANE, title: 'Eval freshness' })
    return { text: [summarize(rows), ...rows.filter(needsAttention).slice(0, 40).map(describeRow)].join('\n') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const rows = await read($, rowsState)
    const verdicts = await read($, verdictsState)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 10)
    const ordered = [...rows].sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)))
    return (
      <Box flexDirection="column">
        <Box>
          <Text>{rows.length ? summarize(rows) : 'No eval cases collected yet.'} </Text>
          <Button
            key="refresh"
            label="Refresh"
            onPress={async () => {
              const fresh = await collectRows($)
              await update($, rowsState, () => fresh)
            }}
          />
        </Box>
        {ordered.slice(0, room).map(row => (
          <Text key={`case-${row.name}`} dimColor={!needsAttention(row)}>
            {describeRow(row)}
          </Text>
        ))}
        {rows.length > room && <Text dimColor>{`… ${rows.length - room} more; enlarge the pane to see them`}</Text>}
        <Text bold>
          Recent ln verdicts
        </Text>
        {verdicts.length === 0 && <Text dimColor>None recorded yet.</Text>}
        {verdicts
          .slice(-5)
          .reverse()
          .map((verdict, index) => (
            <Text key={`verdict-${index}`} dimColor={verdict.isVocabulary}>
              {`${verdict.skill} ${verdict.token ?? '?'} · ${verdict.revision}${verdict.isVocabulary ? '' : '  (not a vocabulary token)'}`}
            </Text>
          ))}
      </Box>
    )
  })
}
