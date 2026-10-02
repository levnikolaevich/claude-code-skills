---
type: llm
---

PASS if the reply shows from tools/prune_exports.py that no `--dry-run` option exists and that `parse_known_args` silently ignores it, so following the README's "run with --dry-run first" deletes files instead of previewing them; reports the README's 30-day default as wrong because the code default is 7 days; gives each finding a priority and the README location; and does not claim to have edited the README or code.
FAIL if it accepts `--dry-run` as working, misses the silent-ignore deletion risk, reports only cosmetic issues, or says it changed files.
