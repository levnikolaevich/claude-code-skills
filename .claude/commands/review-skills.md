---
description: Run skill quality review with repo-specific checks for claude-code-skills
allowed-tools: Skill, Bash, Grep, Glob, Read, AskUserQuestion, mcp__hex-graph__index_project, mcp__hex-graph__find_symbols, mcp__hex-graph__find_references, mcp__hex-graph__find_implementations, mcp__hex-graph__trace_paths, mcp__hex-graph__analyze_architecture
---

# Review Skills

Universal review (`ln-162`) plus repo-specific checks for `claude-code-skills`.

## Execution Strategy

**Step 1 FIRST** - invoke `ln-162` via Skill tool. **Step 2** - run repo-specific checks in batches, not as one monolithic shell run. Combine both outputs in Step 3.

## Step 1: Universal Review (MANDATORY Skill invocation)

> **NON-NEGOTIABLE:** Call `Skill(skill: "ln-162-skill-reviewer", args: "$ARGUMENTS")` via the Skill tool. Do not skip this or manually emulate `ln-162`.

Invoke `Skill("ln-162-skill-reviewer")` with `$ARGUMENTS` (skill dirs or empty for auto-detect).

## Step 2: Repo-Specific Checks

Run repo-specific checks in grouped passes:

1. `R1-R16` static and contract checks
2. `R17` runtime tests in batches by runtime family or coordinator/worker group
3. `R18-R22` contract-sync checks

Do not paste one giant all-repo script into a single shell session when the scope is large.

Use this script structure:

```bash
#!/usr/bin/env bash

RESULTS=()
add_result() { RESULTS+=("$1|$2|$3"); }

# === R1: Marketplace paths ===
if [ -f .claude-plugin/marketplace.json ]; then
  R1_FAILS=0
  while read -r path; do
    [ -d "$path" ] || R1_FAILS=$((R1_FAILS + 1))
  done < <(grep -oE '"\./skills-catalog/ln-[^"]+' .claude-plugin/marketplace.json | tr -d '"')
  [ "$R1_FAILS" -eq 0 ] && add_result R1 "Marketplace paths" PASS || add_result R1 "Marketplace paths" "FAIL ($R1_FAILS missing dirs)"
else
  add_result R1 "Marketplace paths" SKIP
fi

# === R2: Root docs stale skill names ===
R2_FAILS=0
for doc in README.md AGENTS.md .claude-plugin/marketplace.json; do
  [ -f "$doc" ] || continue
  while read -r skill; do
    ls -d skills-catalog/${skill}*/ >/dev/null 2>&1 || R2_FAILS=$((R2_FAILS + 1))
  done < <(grep -oE 'ln-[0-9]+-[a-z-]+' "$doc" | sort -u)
done
[ "$R2_FAILS" -eq 0 ] && add_result R2 "Root docs stale names" PASS || add_result R2 "Root docs stale names" "FAIL ($R2_FAILS stale refs)"

# === R3: Skill count accuracy ===
actual=$(ls -d skills-catalog/ln-*/SKILL.md 2>/dev/null | wc -l)
R3_FAILS=0
if [ -f README.md ]; then
  badge=$(grep -oE 'skills-[0-9]+' README.md | grep -oE '[0-9]+' || true)
  [ -n "$badge" ] && [ "$badge" != "$actual" ] && R3_FAILS=$((R3_FAILS + 1))
fi
if [ -f .claude-plugin/marketplace.json ]; then
  market=$(grep -oE '"\./skills-catalog/ln-[^"]+' .claude-plugin/marketplace.json | wc -l)
  [ "$market" != "$actual" ] && R3_FAILS=$((R3_FAILS + 1))
fi
[ "$R3_FAILS" -eq 0 ] && add_result R3 "Skill count accuracy" "PASS ($actual skills)" || add_result R3 "Skill count accuracy" "FAIL (badge/marketplace mismatch, actual=$actual)"

# === R4: Plugin completeness ===
R4_FAILS=0
for skill_dir in skills-catalog/ln-*/; do
  skill_name="./${skill_dir%/}"
  grep -q "\"$skill_name\"" .claude-plugin/marketplace.json 2>/dev/null || R4_FAILS=$((R4_FAILS + 1))
done
[ "$R4_FAILS" -eq 0 ] && add_result R4 "Plugin completeness" PASS || add_result R4 "Plugin completeness" "FAIL ($R4_FAILS orphan skills)"

# === R5: Pipeline data-flow (semi-automated) ===
R5_WARNS=0
for creator in skills-catalog/ln-11[1-5]-*/SKILL.md; do
  [ -f "$creator" ] || continue
  while read -r output_file; do
    if ! grep -rlq "$output_file" skills-catalog/ln-{2,3,4,5}*/SKILL.md 2>/dev/null; then
      R5_WARNS=$((R5_WARNS + 1))
    fi
  done < <(grep -oE '`[a-zA-Z_]+\.md`' "$creator" | tr -d '`' | grep -vE '(SKILL|README|CLAUDE|AGENTS)' | sort -u | head -5)
done
[ "$R5_WARNS" -eq 0 ] && add_result R5 "Pipeline data-flow" PASS || add_result R5 "Pipeline data-flow" "WARN ($R5_WARNS possibly orphan outputs)"

# === R6: Deprecated Agent Teams references ===
R6_FAILS=$(rg -n "Agent Teams|TeamCreate|TeammateIdle" AGENTS.md README.md docs skills-catalog .claude/commands --glob '!**/deprecated_apis.md' --glob '!**/CHANGELOG.md' --glob '!**/deprecated/**' --glob '!skills-catalog/ln-162-skill-reviewer/**' --glob '!.claude/commands/review-skills.md' 2>/dev/null | wc -l)
[ "$R6_FAILS" -eq 0 ] && add_result R6 "Deprecated Agent Teams references" PASS || add_result R6 "Deprecated Agent Teams references" "FAIL ($R6_FAILS active refs)"

# === R7: Automated test root consistency ===
R7_FAILS=$(rg -n 'tests/(e2e|integration|unit)' AGENTS.md README.md docs skills-catalog .claude/commands --glob '!.claude/commands/review-skills.md' 2>/dev/null | wc -l)
[ "$R7_FAILS" -eq 0 ] && add_result R7 "Automated test root consistency" PASS || add_result R7 "Automated test root consistency" "FAIL ($R7_FAILS old test roots)"

# === R8: Docs extraction family alignment ===
R8_FAILS=0
for f in skills-catalog/ln-160-docs-skill-extractor/SKILL.md skills-catalog/ln-161-skill-creator/SKILL.md; do
  grep -q 'markdown_read_protocol' "$f" || R8_FAILS=$((R8_FAILS + 1))
  grep -q 'docs_quality_contract' "$f" || R8_FAILS=$((R8_FAILS + 1))
  grep -q 'procedural_extraction_rules' "$f" || R8_FAILS=$((R8_FAILS + 1))
done
grep -q '^\*\*Coordinator:\*\*' skills-catalog/ln-161-skill-creator/SKILL.md && R8_FAILS=$((R8_FAILS + 1))
grep -q '^\*\*Parent:\*\*' skills-catalog/ln-161-skill-creator/SKILL.md && R8_FAILS=$((R8_FAILS + 1))
[ "$R8_FAILS" -eq 0 ] && add_result R8 "Docs extraction family alignment" PASS || add_result R8 "Docs extraction family alignment" "FAIL ($R8_FAILS drift issues)"

# === R9: Site fact-check (conditional) ===
if git diff --name-only HEAD -- site/ 2>/dev/null | grep -q .; then
  R9_FAILS=0
  for page in site/plugins/*.html; do
    [ -f "$page" ] || continue
    plugin=$(basename "$page" .html)
    site_skills=$(grep -oE 'skill-id">ln-[0-9]+' "$page" | wc -l)
    market_skills=$(node skills-catalog/ln-162-skill-reviewer/references/check_marketplace.mjs "$plugin")
    [ "$site_skills" -gt 0 ] && [ "$site_skills" != "$market_skills" ] && { echo "  R9a: $plugin site=$site_skills marketplace=$market_skills" >&2; R9_FAILS=$((R9_FAILS + 1)); }
  done
  auditor_count=$(ls -d skills-catalog/ln-6*/SKILL.md 2>/dev/null | wc -l)
  site_auditor=$(grep -oE '[0-9]+ parallel auditors' site/index.html 2>/dev/null | grep -oE '[0-9]+' || true)
  [ -n "$site_auditor" ] && [ "$site_auditor" != "$auditor_count" ] && { echo "  R9b: site says $site_auditor auditors, actual $auditor_count" >&2; R9_FAILS=$((R9_FAILS + 1)); }
  [ "$R9_FAILS" -eq 0 ] && add_result R9 "Site fact-check" PASS || add_result R9 "Site fact-check" "FAIL ($R9_FAILS mismatches)"
else
  add_result R9 "Site fact-check" "SKIP (no site/ changes)"
fi

# === R10: Volatile numbers in site/ ===
R10_WARNS=$(grep -rnE '[0-9]+ (skills|auditors|parallel auditors)' site/ 2>/dev/null | grep -vcE '(WCAG|2\.1|AA|0 API)' || true)
[ "$R10_WARNS" -eq 0 ] && add_result R10 "Volatile numbers in site" PASS || add_result R10 "Volatile numbers in site" "WARN ($R10_WARNS found)"

# === R11: Check sync (automated_checks.md <-> run_checks.sh) ===
CHECKS_DOC=$(grep -oE 'Check [0-9]+' skills-catalog/ln-162-skill-reviewer/references/automated_checks.md | grep -oE '[0-9]+' | sort -n | uniq)
CHECKS_SCRIPT=$(grep -oE 'CHECK [0-9]+' skills-catalog/ln-162-skill-reviewer/references/run_checks.sh | grep -oE '[0-9]+' | sort -n | uniq)
MISSING=$(comm -23 <(echo "$CHECKS_DOC") <(echo "$CHECKS_SCRIPT"))
[ -z "$MISSING" ] && add_result R11 "Check sync (docs<->script)" PASS || add_result R11 "Check sync (docs<->script)" "FAIL (missing in script: $(echo $MISSING | tr '\n' ','))"

# === R12: Worker invocation (full-repo D8b) ===
R12_FAILS=0
for f in skills-catalog/ln-*/SKILL.md; do
  level=$(grep '\*\*Type:\*\*' "$f" | grep -oE 'L[12]' | head -1)
  [ -z "$level" ] && continue
  # Skip L2 Workers -- only Coordinators/Orchestrators delegate
  grep '\*\*Type:\*\*' "$f" | grep -qi 'worker' && continue
  self=$(basename $(dirname "$f") | grep -oE 'ln-[0-9]+-[a-z-]+')
  # Skip skills whose Worker Invocation table declares no workers ("| None |")
  grep -qF '| None |' "$f" && continue
  worker_count=$(grep -oE 'ln-[0-9]+-[a-z-]+' "$f" | sort -u | grep -v "$self" | wc -l)
  [ "$worker_count" -eq 0 ] && continue
  skill_calls=$(grep -c 'Skill(skill:' "$f" || true)
  [ "$skill_calls" -eq 0 ] && R12_FAILS=$((R12_FAILS + 1))
  grep -q 'Worker Invocation (MANDATORY)' "$f" || R12_FAILS=$((R12_FAILS + 1))
done
[ "$R12_FAILS" -eq 0 ] && add_result R12 "Worker invocation (full-repo D8b)" PASS || add_result R12 "Worker invocation (full-repo D8b)" "FAIL ($R12_FAILS issues)"

# === R13: Worker independence (no coordinator-aware worker contracts) ===
R13_FAILS=0
for f in skills-catalog/ln-*/SKILL.md; do
  grep -q '\*\*Type:\*\*.*L3' "$f" || continue
  self_id=$(basename $(dirname "$f") | grep -oE 'ln-[0-9]+')
  # Exclude self-references (e.g. ln-813 referencing itself)
  hits=$(rg 'Called by|Invoked by ln-|Caller:|returning control to `ln-|for `ln-[0-9]+`|returned to coordinator|handing control back to `ln-' "$f" 2>/dev/null | grep -v "for \`$self_id\`" || true)
  [ -n "$hits" ] && R13_FAILS=$((R13_FAILS + 1))
done
[ "$R13_FAILS" -eq 0 ] && add_result R13 "Worker independence (no coordinator refs)" PASS || add_result R13 "Worker independence (no coordinator refs)" "FAIL ($R13_FAILS worker contracts)"

# === R14: Universal runtime artifacts ===
R14_FAILS=$(rg -n '\.hex-skills/(story-execution/summary|story-gate/summary|optimization/\{slug\}/8(11|12|13|14)-)' skills-catalog README.md docs site AGENTS.md 2>/dev/null | wc -l)
[ "$R14_FAILS" -eq 0 ] && add_result R14 "Universal runtime artifacts" PASS || add_result R14 "Universal runtime artifacts" "FAIL ($R14_FAILS coordinator-specific paths)"

# === R15: Standalone-first worker contract ===
R15_FAILS=0
for f in \
  skills-catalog/ln-011-agent-installer/SKILL.md \
  skills-catalog/ln-012-mcp-configurator/SKILL.md \
  skills-catalog/ln-013-config-syncer/SKILL.md \
  skills-catalog/ln-014-agent-instructions-manager/SKILL.md \
  skills-catalog/ln-221-story-creator/SKILL.md \
  skills-catalog/ln-222-story-replanner/SKILL.md \
  skills-catalog/ln-301-task-creator/SKILL.md \
  skills-catalog/ln-302-task-replanner/SKILL.md; do
  [ -f "$f" ] || continue
  grep -q 'summaryArtifactPath' "$f" || R15_FAILS=$((R15_FAILS + 1))
  grep -qi 'standalone' "$f" || R15_FAILS=$((R15_FAILS + 1))
done
[ "$R15_FAILS" -eq 0 ] && add_result R15 "Standalone-first worker contract" PASS || add_result R15 "Standalone-first worker contract" "FAIL ($R15_FAILS missing contract markers)"

# === R16: Run-scoped artifact paths ===
R16_FAILS=$(rg -n '\.hex-skills/runtime-artifacts/(?!runs/)' skills-catalog README.md docs site AGENTS.md -P --glob '!skills-catalog/ln-162-skill-reviewer/**' --glob '!.claude/commands/review-skills.md' 2>/dev/null | wc -l)
[ "$R16_FAILS" -eq 0 ] && add_result R16 "Run-scoped artifact paths" PASS || add_result R16 "Run-scoped artifact paths" "FAIL ($R16_FAILS non-run-scoped paths)"

# === R17: Runtime full test suite (batched) ===
R17_FAILS=0
R17_TOTAL=0
R17_BATCH_FAILS=0
run_r17_batch() {
  local batch_name="$1"
  shift
  local batch_fail=0
  for f in "$@"; do
    [ -f "$f" ] || continue
    basename "$f" | grep -q 'helpers' && continue
    R17_TOTAL=$((R17_TOTAL + 1))
    timeout 90s node "$f" >/dev/null 2>&1 || {
      batch_fail=$((batch_fail + 1))
      R17_FAILS=$((R17_FAILS + 1))
      echo "  R17[$batch_name]: $(basename "$f") failed or timed out" >&2
    }
  done
  [ "$batch_fail" -eq 0 ] || R17_BATCH_FAILS=$((R17_BATCH_FAILS + 1))
}

run_r17_batch "docs+audit" \
  skills-catalog/shared/scripts/audit-runtime/test/*.mjs \
  skills-catalog/shared/scripts/audit-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/docs-pipeline-runtime/test/*.mjs \
  skills-catalog/shared/scripts/docs-quality/test/*.mjs \
  skills-catalog/shared/scripts/docs-runtime/test/*.mjs \
  skills-catalog/shared/scripts/review-runtime/test/*.mjs

run_r17_batch "planning+story" \
  skills-catalog/shared/scripts/epic-planning-runtime/test/*.mjs \
  skills-catalog/shared/scripts/planning-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/scope-decomposition-runtime/test/*.mjs \
  skills-catalog/shared/scripts/story-execution-runtime/test/*.mjs \
  skills-catalog/shared/scripts/story-gate-runtime/test/*.mjs \
  skills-catalog/shared/scripts/story-planning-runtime/test/*.mjs \
  skills-catalog/shared/scripts/task-plan-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/task-planning-runtime/test/*.mjs \
  skills-catalog/shared/scripts/task-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/test-planning-runtime/test/*.mjs \
  skills-catalog/shared/scripts/test-planning-worker-runtime/test/*.mjs

run_r17_batch "env+quality+optimization" \
  skills-catalog/shared/scripts/benchmark-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/coordinator-runtime/test/*.mjs \
  skills-catalog/shared/scripts/dependency-runtime/test/*.mjs \
  skills-catalog/shared/scripts/environment-setup-runtime/test/*.mjs \
  skills-catalog/shared/scripts/environment-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/evaluation-runtime/test/*.mjs \
  skills-catalog/shared/scripts/evaluation-worker-runtime/test/*.mjs \
  skills-catalog/shared/scripts/modernization-runtime/test/*.mjs \
  skills-catalog/shared/scripts/optimization-runtime/test/*.mjs \
  skills-catalog/shared/scripts/quality-runtime/test/*.mjs \
  skills-catalog/shared/scripts/quality-worker-runtime/test/*.mjs

run_r17_batch "pipeline-orchestrator" \
  skills-catalog/ln-1000-pipeline-orchestrator/scripts/test/*.mjs

[ "$R17_FAILS" -eq 0 ] && add_result R17 "Runtime test suite ($R17_TOTAL files)" PASS || add_result R17 "Runtime test suite" "FAIL ($R17_FAILS/$R17_TOTAL failed across $R17_BATCH_FAILS batches)"

# === R18: Exit reason enum sync ===
R18_FAILS=0
CATALOG_FILE=skills-catalog/shared/references/runtime_status_catalog.md
WORKFLOW_FILE=skills-catalog/shared/references/agent_review_workflow.md
if [ -f "$CATALOG_FILE" ] && [ -f "$WORKFLOW_FILE" ]; then
  CATALOG_REASONS=$(grep -oE '`(CONVERGED|CONVERGED_LOW_IMPACT|MAX_ITER|ERROR|SKIPPED)`' "$CATALOG_FILE" | tr -d '`' | sort -u)
  SCHEMA_REASONS=$(grep 'exit_reason:' "$WORKFLOW_FILE" | tail -1 | grep -oE '[A-Z_]+' | grep -vE '^(SKIPPED)$' | sort -u)
  for reason in $SCHEMA_REASONS; do
    echo "$CATALOG_REASONS" | grep -q "$reason" || R18_FAILS=$((R18_FAILS + 1))
  done
  [ "$R18_FAILS" -eq 0 ] && add_result R18 "Exit reason enum sync" PASS || add_result R18 "Exit reason enum sync" "FAIL ($R18_FAILS reasons in schema but not in catalog)"
else
  add_result R18 "Exit reason enum sync" SKIP
fi

# === R19: Checkpoint payload completeness ===
R19_FAILS=0
CLI_FILE=skills-catalog/shared/scripts/review-runtime/cli.mjs
CONTRACT_FILE=skills-catalog/shared/references/review_runtime_contract.md
if [ -f "$CLI_FILE" ] && [ -f "$CONTRACT_FILE" ]; then
  grep -q 'refinement_iterations' "$CLI_FILE" || R19_FAILS=$((R19_FAILS + 1))
  grep -q 'refinement_exit_reason' "$CLI_FILE" || R19_FAILS=$((R19_FAILS + 1))
  grep -q 'refinement_applied' "$CLI_FILE" || R19_FAILS=$((R19_FAILS + 1))
  [ "$R19_FAILS" -eq 0 ] && add_result R19 "Checkpoint payload completeness" PASS || add_result R19 "Checkpoint payload completeness" "FAIL ($R19_FAILS missing Phase 6 fields in cli.mjs)"
else
  add_result R19 "Checkpoint payload completeness" SKIP
fi

# === R20: Guard coverage tests (guards.mjs per runtime) ===
# Skip runtimes that delegate guard logic to coordinator-runtime shared helpers
# (validateLinearWorkerTransition / validateCoordinatorTransition) — those are
# covered by coordinator-runtime/test/, adding own-test would duplicate coverage.
R20_MISSING=""
for runtime_dir in skills-catalog/shared/scripts/*-runtime; do
  [ -d "$runtime_dir/test" ] || continue
  [ -f "$runtime_dir/lib/guards.mjs" ] || continue
  runtime=$(basename "$runtime_dir")
  echo "$runtime" | grep -qE '^(coordinator|planning|story-planning|task-planning)-runtime$' && continue
  grep -q 'validateLinearWorkerTransition\|validateCoordinatorTransition' "$runtime_dir/lib/guards.mjs" && continue
  [ -f "$runtime_dir/test/guards.mjs" ] || R20_MISSING="$R20_MISSING $runtime"
done
[ -z "$R20_MISSING" ] && add_result R20 "Guard coverage tests" PASS || add_result R20 "Guard coverage tests" "FAIL (missing:$R20_MISSING)"

# === R21: resumablePhases in planning stores ===
R21_FAILS=0
for store in skills-catalog/shared/scripts/story-planning-runtime/lib/store.mjs skills-catalog/shared/scripts/task-planning-runtime/lib/store.mjs skills-catalog/shared/scripts/epic-planning-runtime/lib/store.mjs skills-catalog/shared/scripts/docs-pipeline-runtime/lib/store.mjs skills-catalog/shared/scripts/scope-decomposition-runtime/lib/store.mjs; do
  [ -f "$store" ] || continue
  grep -q 'resumablePhases' "$store" || R21_FAILS=$((R21_FAILS + 1))
done
[ "$R21_FAILS" -eq 0 ] && add_result R21 "resumablePhases in planning stores" PASS || add_result R21 "resumablePhases" "FAIL ($R21_FAILS stores missing)"

# === R22: final_result guard on DONE ===
# Runtimes that delegate to shared coordinator-runtime helpers inherit the
# final_result check from validateLinearWorkerTransition — skip literal grep.
R22_FAILS=0
for guards in skills-catalog/shared/scripts/*-runtime/lib/guards.mjs; do
  [ -f "$guards" ] || continue
  grep -q 'DONE' "$guards" || continue
  grep -q 'validateLinearWorkerTransition\|validateCoordinatorTransition' "$guards" && continue
  grep -q 'final_result' "$guards" || { R22_FAILS=$((R22_FAILS + 1)); echo "  R22: missing in $(dirname $(dirname $guards))" >&2; }
done
[ "$R22_FAILS" -eq 0 ] && add_result R22 "final_result guard on DONE" PASS || add_result R22 "final_result guard on DONE" "FAIL ($R22_FAILS missing)"
echo ""
echo "## Repo-Specific Review -- claude-code-skills"
echo ""
echo "| # | Check | Result |"
echo "|---|-------|--------|"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r num check result <<< "$r"
  echo "| $num | $check | $result |"
done

total_fails=$(printf '%s\n' "${RESULTS[@]}" | grep -c 'FAIL' || true)
total_warns=$(printf '%s\n' "${RESULTS[@]}" | grep -c 'WARN' || true)
echo ""
if [ "$total_fails" -gt 0 ]; then
  echo "Repo verdict: FAIL ($total_fails failures, $total_warns warnings)"
elif [ "$total_warns" -gt 0 ]; then
  echo "Repo verdict: PASS with WARNINGS ($total_warns)"
else
  echo "Repo verdict: PASS"
fi
```

## Step 3: Combined Report

Merge results into:

```text
| Source | Verdict | Details |
|--------|---------|---------|
| ln-162 (universal) | {PASS|FAIL} | {N findings, M fixed} |
| Repo-specific | {PASS|FAIL} | {N failures, M warnings} |
| Combined | {worst of both} | |
```

Then list all FAIL and WARN items grouped by severity, with file paths and fix descriptions.

## Step 2b: Graph-Powered Runtime Checks (hex-graph)

Requires `shared/scripts/` JavaScript runtimes. Run `mcp__hex-graph__index_project` once, then:

### RG1: Cross-Runtime API Drift

Detect exported functions with the same name but different signatures across runtimes.

For each shared function name (e.g. `validateTransition`, `computeResumeAction`, `validateSchema`):

```
mcp__hex-graph__find_symbols(query: "{function_name}", path: "d:/Development/LevNikolaevich/claude-code-skills")
```

If found in 2+ runtimes, compare signatures via `inspect_symbol` on each. Report divergent parameter lists.

**Discovery step:** use `grep_search` to find all `export function` declarations, then group by name.

```
mcp__hex-line__grep_search(pattern: "export function", path: "skills-catalog/shared/scripts", glob: "*/lib/*.mjs")
```

| Verdict | Condition |
|---------|-----------|
| PASS | All shared function names have identical signatures |
| WARN | Same name, compatible but different param order or defaults |
| FAIL | Same name, incompatible signatures (different param count/types) |
### RG2: Dead Exports in Runtime Libraries

Find exported functions/constants in `lib/*.mjs` that no other module imports.

```
mcp__hex-graph__find_references(symbol: "{export_name}", path: "skills-catalog/shared/scripts")
```

For each `export` in `lib/*.mjs`: if `find_references` returns 0 external consumers (excluding the defining file and its co-located test), mark as dead export.

| Verdict | Condition |
|---------|-----------|
| PASS | All exports have at least 1 consumer |
| WARN | 1-3 dead exports (may be intentional public API) |
| FAIL | >3 dead exports per runtime |

### RG3: Guards-Store Field Alignment

Verify that `guards.mjs` field checks reference fields that exist in the runtime's store/phases.

For each runtime with `guards.mjs`:

```
mcp__hex-graph__inspect_symbol(name: "guards", file: "skills-catalog/shared/scripts/{runtime}/lib/guards.mjs", path: "...")
```

`inspect_symbol` returns the full outgoing dependency chain (imports from `phases.mjs`, `store.mjs`, `runtime-constants.mjs`). Verify each imported constant actually exists in the source module via `find_symbols`.

Also cross-check with `grep_search`:

```
mcp__hex-line__grep_search(pattern: "state\\.", path: "skills-catalog/shared/scripts/{runtime}/lib/guards.mjs")
```

Compare accessed `state.{field}` names against fields defined in `store.mjs` initialState.

| Verdict | Condition |
|---------|-----------|
| PASS | All guard-referenced fields exist in store |
| FAIL | Guard checks a field not in store schema |

### RG4: Circular Dependencies

Detect import cycles across runtime modules.

```
mcp__hex-graph__analyze_architecture(path: "skills-catalog/shared/scripts")
```

Report any circular dependency chains. Cycles between `lib/` modules within the same runtime are FAIL.

| Verdict | Condition |
|---------|-----------|
| PASS | No circular imports |
| FAIL | Any cycle detected within a runtime |

### RG5: CLI Entrypoint Completeness

Verify each runtime `cli.mjs` exposes all phases declared in its `phases.mjs`.

```
mcp__hex-graph__find_symbols(query: "PHASES", path: "d:/Development/LevNikolaevich/claude-code-skills")
```

For each `PHASES` constant found, `inspect_symbol` to get the phase enum values. Then check `cli.mjs` in same runtime:

```
mcp__hex-line__grep_search(pattern: "case |subcommand|command", path: "skills-catalog/shared/scripts/{runtime}/cli.mjs")
```

Compare phase names against CLI dispatch branches. Report phases with no handler.

| Verdict | Condition |
|---------|-----------|
| PASS | Every phase in PHASES has a CLI handler |
| WARN | Phase exists but CLI delegates to generic handler |
| FAIL | Phase in PHASES with no CLI path at all |
---

## Step 4: Meta-Analysis

**MANDATORY READ:** Load `skills-catalog/shared/references/meta_analysis_protocol.md`

Analyze the session per protocol section 7. Output using the protocol format.
