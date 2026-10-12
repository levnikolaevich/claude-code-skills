/** Pure helpers: no engine access, so tests and the hooks module share them. */

/** Files whose edits can break a repository contract the validator owns. */
export const WATCHED = /^(plugins\/|docs\/|\.claude-plugin\/|\.agents\/|\.github\/repository-metadata\.json$|scripts\/validate-repository\.ps1$|(SKILL_TEMPLATE|AGENTS|CLAUDE|README)\.md$)/

export const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit'] as const

/** Runs the validator and prints its own message instead of PowerShell's decorated error record. */
export const VALIDATE_COMMAND = "& { try { & ./scripts/validate-repository.ps1 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 } }"

/** Repository-relative path with forward slashes, or undefined outside the repository. */
export function toRepositoryPath(root: string, path: string): string | undefined {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedPath = path.replace(/\\/g, '/')
  const isWindows = /^[A-Za-z]:\//.test(normalizedRoot)
  const isAbsolute = /^([A-Za-z]:)?\//.test(normalizedPath)
  if (!isAbsolute) return normalizedPath.replace(/^\.\//, '')
  const prefix = normalizedRoot + '/'
  const isInside = isWindows ? normalizedPath.toLowerCase().startsWith(prefix.toLowerCase()) : normalizedPath.startsWith(prefix)
  return isInside ? normalizedPath.slice(prefix.length) : undefined
}

/** The verdict tokens of SKILL_TEMPLATE.md's vocabulary, their single owner. */
export function vocabularyTokens(template: string): Set<string> {
  const section = template.match(/\n## Verdict vocabulary\n([\s\S]*?)\n## /)?.[1] ?? ''
  return new Set([...section.matchAll(/`([A-Z][A-Z_]+)[ `]/g)].map(match => match[1] as string))
}

/** The first token of a report's Result field, read the way the eval verdict graders read it. */
export function resultToken(answer: string): string | null {
  return answer.match(/Result:\**\s*[*`]*([A-Z][A-Z_]+)\b/)?.[1] ?? null
}

/** The first meaningful line of a failure, or the last line of a success. */
export function validatorDetail(exitCode: number, stdout: string, stderr: string): string {
  const isPass = exitCode === 0
  const lines = (isPass ? stdout : stderr || stdout).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return (isPass ? lines.at(-1) : lines[0]) ?? ''
}

export function skillOf(skillName: string): string | undefined {
  return skillName.match(/ln-\d{2}-[a-z0-9-]+/)?.[0]
}

/** An absolute path under the repository root: the engine resolves a relative path against the plugin's own folder. */
export function inRepository(root: string, path: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${path}`
}
