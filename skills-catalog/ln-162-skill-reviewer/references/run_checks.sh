#!/usr/bin/env bash
# Automated SKILL.md verification checks (ln-162-skill-reviewer Phase 2)
# Usage: bash run_checks.sh <batched SKILL.md files...>
# Example: bash run_checks.sh ln-010-*/SKILL.md ln-011-*/SKILL.md
#
# Exit code: 0 if all pass, 1 if any FAIL found
# Batch policy:
#   - keep one invocation within one ln-NXX family when possible
#   - split coordinators and workers into separate invocations
#   - for large families, chunk into 5-10 files instead of one giant repo-wide run
# Lessons learned (bugs fixed vs template version):
#   - grep -q returns exit code 1 on no match -> breaks && chains; use if/then
#   - grep -c returns exit code 1 when count=0 -> append || true
#   - passive ref grep needs || true to avoid false script failure
#   - MANDATORY READ paths outside skills-catalog/ (mcp/, docs/project/*) are runtime-only
#     and skipped by Check 5 (only shared/, references/, ../ln-* are verified)
#   - pipe | while read creates subshell -> FAILS counter lost; use < <(...) instead

set -uo pipefail

# Resolve repo root. Prefer the caller's working tree (git) so the script works
# even when invoked from a plugin cache against a different project tree.
# Fallback: resolve relative to the script location for offline / non-git use.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/../../.." && pwd))
SKILLS_ROOT="$REPO_ROOT/skills-catalog"
SCOPE="$@"
FAILS=0

if [ $# -eq 0 ]; then
  echo "Usage: bash run_checks.sh <SKILL.md files...>"
  echo "Example: bash run_checks.sh ln-*/SKILL.md"
  exit 2
fi

if [ $# -gt 12 ]; then
  echo "WARN: large scope ($# files). Split run_checks.sh into smaller batches by ln-NXX family or coordinator/worker group." >&2
fi

fail() { echo "FAIL: $1"; FAILS=$((FAILS + 1)); }
warn() { echo "WARN: $1"; }

# ── CHECK 1: Frontmatter (D7) ──────────────────────────────────────
echo "=== CHECK 1: Frontmatter (D7) ==="
for f in $SCOPE; do
  head -5 "$f" | grep -q "^---" || fail "no frontmatter: $f"
  grep -q "^name:" "$f" || fail "no name: $f"
  grep -q "^description:" "$f" || fail "no description: $f"
done
echo "DONE"
echo ""

# ── CHECK 2: Version/Date (D7) ─────────────────────────────────────
echo "=== CHECK 2: Version/Date (D7) ==="
for f in $SCOPE; do
  grep -q '\*\*Version:\*\*' "$f" || fail "no version: $f"
  grep -q '\*\*Last Updated:\*\*' "$f" || fail "no date: $f"
  if grep -q '\*\*Changes:\*\*' "$f"; then fail "has Changes section: $f"; fi
done
echo "DONE"
echo ""

# ── CHECK 3: Size <=800 (D8) ───────────────────────────────────────
echo "=== CHECK 3: Size <=800 (D8) ==="
for f in $SCOPE; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 800 ]; then fail "$lines lines (>800): $f"; fi
done
echo "DONE"
echo ""

# ── CHECK 4: Description <=200 chars (D8) ──────────────────────────
echo "=== CHECK 4: Description <=200 chars (D8) ==="
for f in $SCOPE; do
  desc=$(sed -n '/^description:/p' "$f" | sed 's/^description: *//' | tr -d '"')
  len=${#desc}
  if [ "$len" -gt 200 ]; then fail "description $len chars (>200): $f"; fi
done
echo "DONE"
echo ""

# ── CHECK 5: MANDATORY READ paths (D2) ─────────────────────────────
echo "=== CHECK 5: MANDATORY READ paths (D2) ==="
for f in $SCOPE; do
  dir=$(dirname "$f")
  while read -r path; do
    # Only verify paths resolvable within skills-catalog/ (shared/, references/, ../ln-*)
    # Paths outside skills tree (mcp/, docs/project/) are runtime — skip
    if ! echo "$path" | grep -qE '^(shared/|references/|\.\./ln-)'; then continue; fi
    if [ ! -f "$dir/$path" ] && [ ! -f "$path" ] && [ ! -f "$SKILLS_ROOT/$path" ]; then
      fail "missing MANDATORY READ target: $path (from $f)"
    fi
  done < <(grep "MANDATORY READ" "$f" | tr '`' '\n' | grep -E '\.(md|json|txt|yaml|sh)$' | grep -v '{' | sort -u)
done
echo "DONE"
echo ""

# ── CHECK 6: Orphan references (D7) ────────────────────────────────
echo "=== CHECK 6: Orphan references (D7) ==="
for f in $SCOPE; do
  dir=$(dirname "$f")
  if [ -d "$dir/references" ]; then
    while read -r ref; do
      base=$(basename "$ref")
      [[ "$base" == .* ]] && continue
      grep -q "$base" "$f" || fail "orphan reference: $ref (not in $f)"
    done < <(find "$dir/references" -type f)
  fi
done
echo "DONE"
echo ""

# ── CHECK 7: Passive file refs (D2) ────────────────────────────────
echo "=== CHECK 7: Passive file refs (D2) ==="
for f in $SCOPE; do
  result1=$(grep -nE '(^See |^Per |^Follows |See \[).*\.(md|txt|yaml)' "$f" | grep -v "MANDATORY READ" || true)
  result2=$(grep -nE '\[[^\]]*\]\([^)]*\.(md|txt|yaml)\)' "$f" | grep -vE '(MANDATORY READ|https?://)' || true)
  if [ -n "$result1" ]; then warn "passive prose ref in $f:"; echo "$result1"; fi
  if [ -n "$result2" ]; then warn "passive markdown link in $f:"; echo "$result2"; fi
done
echo "DONE"
echo ""

# ── CHECK 8: DoD with checkboxes (D7) ──────────────────────────────
echo "=== CHECK 8: DoD with checkboxes (D7) ==="
for f in $SCOPE; do
  grep -q "## Definition of Done" "$f" || fail "no Definition of Done: $f"
  if grep -q "## Definition of Done" "$f"; then
    count=$(sed -n '/## Definition of Done/,/^---/p' "$f" | grep -c '^\- \[ \]' || true)
    if [ "$count" -eq 0 ]; then fail "DoD has no checkbox items (- [ ]): $f"; fi
  fi
done
echo "DONE"
echo ""

# ── CHECK 9: Meta-Analysis L1/L2 (D7) ──────────────────────────────
echo "=== CHECK 9: Meta-Analysis L1/L2 (D7) ==="
for f in $SCOPE; do
  level=$(grep '\*\*Type:\*\*' "$f" | grep -oE 'L[012]' | head -1 || true)
  # Meta-Analysis: orchestrators and coordinators only (not Workers)
  if [ -n "$level" ] && ! grep '\*\*Type:\*\*' "$f" | grep -qi 'worker'; then
    grep -q "Meta-Analysis" "$f" || fail "L1/L2 skill missing Meta-Analysis: $f"
    grep -q "meta_analysis_protocol" "$f" || fail "L1/L2 skill missing meta_analysis_protocol ref: $f"
  fi
done
echo "DONE"
echo ""

# ── CHECK 10: Publishing skills (D7) ───────────────────────────────
echo "=== CHECK 10: Publishing skills (D7) ==="
for f in $SCOPE; do
  if grep -qE '(gh api graphql.*mutation|gh issue comment)' "$f"; then
    grep -qi "fact.check" "$f" || fail "publishing skill missing Fact-Check: $f"
    grep -q "humanizer_checklist" "$f" || fail "publishing skill missing humanizer_checklist ref: $f"
  fi
done
echo "DONE"
echo ""

# ── CHECK 11: Description trigger quality (D8, WARN) ─────────────
echo "=== CHECK 11: Description trigger quality (D8, WARN) ==="

WARNS=0
for f in $SCOPE; do
  desc=$(sed -n '/^description:/p' "$f" | head -1 | sed 's/^description: *//' | tr -d '"')
  if [ -n "$desc" ]; then
    if ! echo "$desc" | grep -qiE '(Use (this )?(skill )?(when|for|before|after)|Trigger when|Invoked when|should be used when|Not for )'; then
      warn "description lacks trigger condition (WHEN): $f"
      WARNS=$((WARNS + 1))
    fi
  fi
done
echo "DONE ($WARNS warnings)"
echo ""

# ── CHECK 12: Execution proximity (D2b, WARN) ──────────────────────
echo "=== CHECK 12: Execution proximity (D2b, WARN) ==="
WARNS=0
for f in $SCOPE; do
  while IFS= read -r match; do
    linenum=$(echo "$match" | cut -d: -f1)
    start=$((linenum > 5 ? linenum - 5 : 1))
    endline=$((linenum + 10))
    nearby=$(sed -n "${start},${endline}p" "$f")
    if ! echo "$nearby" | grep -qE -- '--prompt-file|--output-file'; then
      warn "imperative tool action at line $linenum without inline command template: $f"
      WARNS=$((WARNS + 1))
    fi
  done < <(grep -nE '(Launch|Run|Execute) .*(agent_runner|--agent|background task|BOTH agents)' "$f" | grep -v 'health-check' || true)
done
echo "DONE ($WARNS warnings)"
echo ""

# ── CHECK 13: Platform API compatibility ────────────────────────────
echo "=== CHECK 13: Platform API compatibility ==="
for f in $SCOPE; do
  grep -n 'Agent(resume:' "$f" && fail "deprecated Agent(resume:) in $f — use SendMessage({to: agentId})"
  grep -nE 'effort.*"max"|effort: max' "$f" && fail "deprecated effort \"max\" in $f — use low/medium/high"
done
echo "DONE"
echo ""

# ── CHECK 17: Worker invocation enforcement (D8b) ───────────────
echo "=== CHECK 17: Worker invocation enforcement (D8b) ==="
for f in $SCOPE; do
  level=$(grep '\*\*Type:\*\*' "$f" | grep -oE 'L[12]' | head -1 || true)
  [ -z "$level" ] && continue
  # Worker invocation: orchestrators and coordinators only (not Workers)
  grep '\*\*Type:\*\*' "$f" | grep -qi 'worker' && continue
  self=$(basename $(dirname "$f") | grep -oE 'ln-[0-9]+-[a-z-]+')
  worker_count=$(grep -oE 'ln-[0-9]+-[a-z-]+' "$f" | sort -u | while read w; do
    [ "$w" != "$self" ] && echo "$w"
  done | sort -u | wc -l)
  [ "$worker_count" -eq 0 ] && continue
  grep -qF '| None |' "$f" && continue
  skill_calls=$(grep -c 'Skill(skill:' "$f" || true)
  [ "$skill_calls" -eq 0 ] && fail "$level skill delegates to $worker_count workers but has no Skill() invocation code blocks: $f"
  grep -q 'Worker Invocation (MANDATORY)' "$f" || fail "$level skill missing Worker Invocation (MANDATORY) section: $f"
  grep -q 'TodoWrite format (mandatory)' "$f" || warn "$level skill missing TodoWrite format section: $f"
done
echo "DONE"
echo ""

# ── CHECK 18: Type line presence (D7) ──────────────────────────────
echo "=== CHECK 18: Type line presence (D7) ==="
for f in $SCOPE; do
  grep -q '\*\*Type:\*\*' "$f" || fail "no **Type:** line: $f"
done
echo "DONE"
echo ""

# CHECK 19: Worker independence (D8)
echo "=== CHECK 19: Worker independence (D8) ==="
for f in $SCOPE; do
  grep '\*\*Type:\*\*' "$f" | grep -qi 'worker' || continue
  if grep -q '^\*\*Coordinator:\*\*' "$f"; then fail "worker declares Coordinator: $f"; fi
  if grep -q '^\*\*Parent:\*\*' "$f"; then fail "worker declares Parent: $f"; fi
  if grep -nE 'Invoked by ln-[0-9]+|called by ln-[0-9]+' "$f" >/dev/null; then fail "worker declares caller coupling: $f"; fi
done
echo "DONE"
echo ""

# CHECK 20: Docs-model alignment for extraction skills (D4)
echo "=== CHECK 20: Docs-model alignment for extraction skills (D4) ==="
for f in $SCOPE; do
  case "$f" in
    *ln-160-*|*ln-161-*)
      grep -q 'markdown_read_protocol' "$f" || fail "docs extraction skill missing markdown_read_protocol: $f"
      grep -q 'docs_quality_contract' "$f" || fail "docs extraction skill missing docs_quality_contract: $f"
      grep -q 'procedural_extraction_rules' "$f" || fail "docs extraction skill missing procedural_extraction_rules: $f"
      ;;
  esac
done
echo "DONE"
echo ""

# CHECK 21: Standalone summary workers (D8)
echo "=== CHECK 21: Standalone summary workers (D8) ==="
for f in $SCOPE; do
  case "$f" in
    *ln-011-*|*ln-012-*|*ln-013-*|*ln-014-*|*ln-221-*|*ln-222-*|*ln-301-*|*ln-302-*)
      grep -q 'summaryArtifactPath' "$f" || fail "standalone summary worker missing summaryArtifactPath contract: $f"
      grep -qi 'standalone' "$f" || fail "standalone summary worker missing standalone wording: $f"
      grep -nE 'Invoked by ln-|called by ln-|returning control to `ln-|handing control back to `ln-' "$f" >/dev/null && fail "standalone summary worker has caller coupling: $f"
      ;;
  esac
done
echo "DONE"
echo ""

# CHECK 22: Run-scoped runtime artifact paths (D2)
echo "=== CHECK 22: Run-scoped runtime artifact paths (D2) ==="
for f in $SCOPE; do
  grep -nP '\.hex-skills/runtime-artifacts/(?!runs/)' "$f" >/dev/null && fail "non-run-scoped runtime artifact path: $f"
done
echo "DONE"
echo ""

# ── SUMMARY ─────────────────────────────────────────────────────────
echo "================================"
if [ "$FAILS" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "TOTAL FAILURES: $FAILS"
  exit 1
fi
