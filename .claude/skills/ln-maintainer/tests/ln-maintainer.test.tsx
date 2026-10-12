import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROOT = 'D:/repo'
const SESSION = { cwd: ROOT, surface: null, isInteractive: true }
const SKILL_FILE = `${ROOT}/plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md`
const TEMPLATE = '# Template\n\n## Verdict vocabulary\n\n| Token |\n|---|\n| `DELIVERED` | x |\n| `FAIL` | x |\n\n## Change control\n'

/** The repository-relative key of a path the plugin built from the session root; other paths stay as they are. */
function inRepository(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.startsWith(`${ROOT}/`) ? normalized.slice(ROOT.length + 1) : `outside:${normalized}`
}

type Host = {
  validator?: { exitCode: number; stdout: string; stderr: string }
  tree?: string[]
  files?: Record<string, string>
  dirs?: Record<string, { name: string; kind: 'file' | 'dir' }[]>
  hashes?: Record<string, string>
}

/** Stands for the engine beneath the plugin: every host call answered from memory and recorded. */
function host(on: On, setup: Host = {}) {
  const seen = { validatorRuns: 0, statuses: [] as (string | undefined)[], toasts: [] as string[], opened: [] as string[] }
  const tree = setup.tree ?? ['']
  const files: Record<string, string> = { 'SKILL_TEMPLATE.md': TEMPLATE, ...setup.files }
  const dirs = setup.dirs ?? {}
  const done = (stdout: string, exitCode = 0, stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  mock.store(on, {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('session.root', () => ({ value: ROOT }))
  on('process.run', ($, e) => {
    const [command, verb] = e.argv
    if (command === 'git' && verb === 'status') return done(tree.length > 1 ? (tree.shift() as string) : (tree[0] as string))
    if (command === 'git' && verb === 'rev-parse') return done('abc1234\n')
    if (command === 'git' && verb === 'hash-object') {
      const paths = (e.init?.stdin ?? '').trim().split('\n')
      return done(paths.map(path => setup.hashes?.[path] ?? 'missing').join('\n') + '\n')
    }
    seen.validatorRuns += 1
    const run = setup.validator ?? { exitCode: 0, stdout: 'Validated 8 plugins', stderr: '' }
    return done(run.stdout, run.exitCode, run.stderr)
  })
  on('fs.read', ($, e) => {
    const path = inRepository(e.path)
    if (!(path in files)) throw new Error(`no such file: ${e.path}`)
    return { value: files[path] }
  })
  on('fs.exists', ($, e) => ({ value: inRepository(e.path) in files || inRepository(e.path) in dirs }))
  on('fs.list', ($, e) => ({ value: (dirs[inRepository(e.path)] ?? []).map(entry => ({ ...entry, size: 0, isLink: false })) }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.status', ($, e) => {
    seen.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('tool.call', () => ({ result: { filePath: SKILL_FILE } }))
  return seen
}

describe('validator after edits', () => {
  test('a failing contract reaches the model as context after an edit to a skill', async ($, on) => {
    const seen = host(on, { validator: { exitCode: 1, stdout: '', stderr: 'ln-41-surgical-change-implementer has no eval case.' } })
    await $.session.start(SESSION)
    const ran = await $.tool.call({ tool: 'Edit', file_path: SKILL_FILE, old_string: 'a', new_string: 'b', replace_all: false })
    expect(seen.validatorRuns).toBe(1)
    const context = (ran.context ?? []).join(' ')
    expect(context).toContain('Repository validator fails after editing plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md: ln-41-surgical-change-implementer has no eval case. This is expected')
    expect(seen.statuses.at(-1)).toContain('validator ✗')
  })

  test('a passing contract adds no context', async ($, on) => {
    const seen = host(on)
    await $.session.start(SESSION)
    const ran = await $.tool.call({ tool: 'Write', file_path: `${ROOT}/AGENTS.md`, content: 'x' })
    expect(seen.validatorRuns).toBe(1)
    expect(ran.context).toBeUndefined()
    expect(seen.statuses.at(-1)).toBe('validator ✓')
  })

  test('an edit outside the contract files runs nothing', async ($, on) => {
    const seen = host(on)
    await $.session.start(SESSION)
    await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/notes/todo.md`, old_string: 'a', new_string: 'b', replace_all: false })
    await $.tool.call({ tool: 'Edit', file_path: 'C:/elsewhere/plugins/x.md', old_string: 'a', new_string: 'b', replace_all: false })
    expect(seen.validatorRuns).toBe(0)
  })

  test('the option turns validation off', { options: { validateOnEdit: false } }, async ($, on) => {
    const seen = host(on)
    await $.session.start(SESSION)
    await $.tool.call({ tool: 'Edit', file_path: SKILL_FILE, old_string: 'a', new_string: 'b', replace_all: false })
    expect(seen.validatorRuns).toBe(0)
  })

  test('a shell edit is validated once when the main turn ends', async ($, on) => {
    const seen = host(on, { tree: ['', ' M SKILL_TEMPLATE.md\n'], validator: { exitCode: 1, stdout: '', stderr: 'common contract differs' } })
    await $.session.start(SESSION)
    await $.turn.start({ text: 'edit', turnId: 't1' })
    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
    expect(seen.validatorRuns).toBe(1)
    expect(seen.toasts.at(-1)).toContain('common contract differs')
    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't2' })
    expect(seen.validatorRuns).toBe(1)
  })
})

describe('skill verdicts', () => {
  test('the Result token of an ln skill shows with its revision', async ($, on) => {
    const seen = host(on, { tree: ['', ' M a.py\n'], files: { 'SKILL_TEMPLATE.md': TEMPLATE } })
    await $.session.start(SESSION)
    await $.turn.start({ text: 'fix', turnId: 't1' })
    await $.skill.prompt({ skill: 'implementation-suite:ln-41-surgical-change-implementer', text: '...' })
    await $.turn.complete({ reason: 'answer', answer: '**Result:** `DELIVERED` — fixed.', durationMs: 1, isAborted: false, turnId: 't1' })
    expect(seen.statuses).toContain('ln-41-surgical-change-implementer DELIVERED · abc1234*')
    expect(seen.toasts.some(toast => toast.includes('vocabulary'))).toBe(false)
  })

  test('a Result without a vocabulary token is called out', async ($, on) => {
    const seen = host(on, { files: { 'SKILL_TEMPLATE.md': TEMPLATE } })
    await $.session.start(SESSION)
    await $.turn.start({ text: 'review', turnId: 't1' })
    await $.skill.prompt({ skill: 'ln-52-delivery-reviewer', text: '...' })
    await $.turn.complete({ reason: 'answer', answer: '**Result:** Looks fine overall.', durationMs: 1, isAborted: false, turnId: 't1' })
    expect(seen.toasts.at(-1)).toContain('ln-52-delivery-reviewer: the Result field does not start with a shared vocabulary verdict token')
  })

  test('turns without an ln skill and subagent turns record nothing', async ($, on) => {
    const seen = host(on)
    await $.session.start(SESSION)
    await $.turn.start({ text: 'chat', turnId: 't1' })
    await $.turn.complete({ reason: 'answer', answer: '**Result:** `FAIL`', durationMs: 1, isAborted: false, turnId: 't1' })
    await $.skill.prompt({ skill: 'ln-52-delivery-reviewer', text: '...' })
    await $.turn.complete({ reason: 'answer', answer: '**Result:** `FAIL`', durationMs: 1, isAborted: false, turnId: 's1', agentId: 'agent-1' })
    expect(seen.statuses.filter(status => status?.includes('ln-52'))).toEqual([])
  })
})

const PANE_PROPS = { title: 'Eval freshness', isFocused: false, bodyColumns: 120, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }

describe('eval freshness', () => {
  const CASE = 'plugins/operations-suite/evals/ln-71-read-only-boundary'
  const dirs = {
    plugins: [{ name: 'operations-suite', kind: 'dir' as const }],
    'plugins/operations-suite/evals': [
      { name: 'ln-71-read-only-boundary', kind: 'dir' as const },
      { name: 'ln-72-outcome-uncertainty', kind: 'dir' as const },
      { name: 'results', kind: 'dir' as const },
    ],
    '.eval-results': [{ name: 'codex-run.json', kind: 'file' as const }],
  }
  const result = (prompt: string) =>
    JSON.stringify({
      schemaVersion: 1,
      host: 'codex',
      model: 'gpt-test',
      threshold: 1,
      cases: [{ name: 'ln-71-read-only-boundary', score: 1, provenance: { files: { [`${CASE}/prompt.md`]: prompt } }, runs: [{ error: '', graders: [] }] }],
    })
  const files = (prompt: string) => ({
    [`${CASE}/graders/skill-fired.md`]: 'input_match: ln-71-operations-investigator',
    [`${CASE}/prompt.md`]: 'p',
    'plugins/operations-suite/evals/ln-72-outcome-uncertainty/graders/skill-fired.md': 'ln-72-product-outcome-evaluator',
    '.eval-results/codex-run.json': result(prompt),
  })

  test('a result bound to unchanged files is current; a case without results is NOT RUN', async ($, on) => {
    const seen = host(on, { dirs, files: files('h1'), hashes: { [`${CASE}/prompt.md`]: 'h1' } })
    await $.session.start(SESSION)
    const answer = await $.command.run({ command: 'ln-evals' })
    expect(seen.opened).toEqual(['ln-evals'])
    expect(answer.text).toContain('2 cases: 1 current and passing, 0 current and failing, 0 stale, 0 unbound, 1 NOT RUN')
    expect(answer.text).toContain('NOT RUN')
    expect(answer.text).toContain('ln-72-outcome-uncertainty')
  })

  test('a result whose case file changed is stale', async ($, on) => {
    host(on, { dirs, files: files('h1'), hashes: { [`${CASE}/prompt.md`]: 'h2' } })
    await $.session.start(SESSION)
    const answer = await $.command.run({ command: 'ln-evals' })
    expect(answer.text).toContain('1 stale')
    expect(answer.text).toContain('STALE')
  })

  test('the pane draws the rows on terminal and desktop', async ($, on) => {
    host(on, { dirs, files: files('h1'), hashes: { [`${CASE}/prompt.md`]: 'h1' } })
    await $.session.start(SESSION)
    await $.command.run({ command: 'ln-evals' })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'ln-maintainer', surface, component: 'Pane', requestId: 'ln-evals', props: PANE_PROPS })
      expect(await ui.find({ type: 'Text', text: /^2 cases: 1 current and passing/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /NOT RUN .*ln-72-outcome-uncertainty/ })).toBeDefined()
      await ui.press({ key: 'refresh' })
      expect(await ui.find({ type: 'Text', text: /current\s+pass 1\.00\s+ln-71-read-only-boundary/ })).toBeDefined()
      await ui.unmount()
    }
  })
})
