# Automated Verification Checks (SKILL Mode)

<!-- DO NOT add here: Workflow phases -> ln-162-skill-reviewer SKILL.md -->
<!-- Contract source: shared/references/skill_contract.md -->

Run ALL checks below for every SKILL.md in scope. Every FAIL is a confirmed violation -- no judgment needed, no skipping.

Execution policy:
- do not pass a whole mixed-repo scope to `run_checks.sh` in one giant invocation
- batch by `ln-NXX` family when possible
- if scope mixes coordinators and workers, run them as separate batches
- if one batch is still large, split it into 5-10 files

## Check 1: Frontmatter (D7)
```bash
for f in {scoped SKILL.md files}; do
  head -5 "$f" | grep -q "^---" || echo "FAIL: no frontmatter: $f"
  grep -q "^name:" "$f" || echo "FAIL: no name: $f"
  grep -q "^description:" "$f" || echo "FAIL: no description: $f"
done
```

## Check 2: Version/date (D7)
```bash
for f in {scoped SKILL.md files}; do
  grep -q "\*\*Version:\*\*" "$f" || echo "FAIL: no version: $f"
  grep -q "\*\*Last Updated:\*\*" "$f" || echo "FAIL: no date: $f"
  grep -q "\*\*Changes:\*\*" "$f" && echo "FAIL: has Changes section: $f"
done
```

## Check 3: Size (D8)
```bash
for f in {scoped SKILL.md files}; do
  lines=$(wc -l < "$f")
  [ "$lines" -gt 800 ] && echo "FAIL: $lines lines (>800): $f"
done
```

## Check 4: Description length (D8)
```bash
for f in {scoped SKILL.md files}; do
  desc=$(sed -n '/^description:/p' "$f" | sed 's/^description: *//' | tr -d '"')
  len=${#desc}
  [ "$len" -gt 200 ] && echo "FAIL: description $len chars (>200): $f"
done
```

## Check 5: MANDATORY READ path verification (D2)
```bash
for f in {scoped SKILL.md files}; do
  dir=$(dirname "$f")
  grep "MANDATORY READ" "$f" | tr '`' '\n' | grep -E '\.(md|json|txt|yaml|sh)$' | grep -v '{' | sort -u | while read path; do
    [ -f "$dir/$path" ] || [ -f "$path" ] || echo "FAIL: missing MANDATORY READ target: $path (from $f)"
  done
done
```

## Check 6: Orphan references (D7)
```bash
for f in {scoped SKILL.md files}; do
  dir=$(dirname "$f")
  if [ -d "$dir/references" ]; then
    find "$dir/references" -type f | while read ref; do
      base=$(basename "$ref")
      [[ "$base" == .* ]] && continue
      grep -q "$base" "$f" || echo "FAIL: orphan reference: $ref (not in $f)"
    done
  fi
done
```

## Check 7: Passive file reference (D2)
```bash
for f in {scoped SKILL.md files}; do
  # Pattern 1: See/Per/Follows prose patterns
  grep -nE '(^See |^Per |^Follows |See \[).*\.(md|txt|yaml)' "$f" | grep -v "MANDATORY READ" && echo "WARN: passive prose ref in $f"
  # Pattern 2: Markdown links to local files [text](path.md)
  grep -nE '\[[^\]]*\]\([^)]*\.(md|txt|yaml)\)' "$f" | grep -vE '(MANDATORY READ|https?://)' && echo "WARN: passive markdown link in $f"
done
```

## Check 8: Definition of Done (D7)
```bash
for f in {scoped SKILL.md files}; do
  grep -q "## Definition of Done" "$f" || echo "FAIL: no Definition of Done: $f"
  # Verify checkbox format (- [ ]) if DoD section exists
  if grep -q "## Definition of Done" "$f"; then
    count=$(sed -n '/## Definition of Done/,/^---/p' "$f" | grep -c '^\- \[ \]')
    [ "$count" -eq 0 ] && echo "FAIL: DoD has no checkbox items (- [ ]): $f"
  fi
done
```

## Check 9: Meta-Analysis L1/L2 (D7)
```bash
for f in {scoped SKILL.md files}; do
  # Detect skill level from Type line
  level=$(grep -oE 'L[12]' "$f" | head -1)
  if [ -n "$level" ]; then
    grep -q "Meta-Analysis" "$f" || echo "FAIL: L1/L2 skill missing Meta-Analysis: $f"
    grep -q "meta_analysis_protocol" "$f" || echo "FAIL: L1/L2 skill missing meta_analysis_protocol MANDATORY READ: $f"
  fi
done
```

## Check 10: Publishing skill requirements (D7)
```bash
for f in {scoped SKILL.md files}; do
  if grep -qE '(gh api graphql.*mutation|gh issue comment)' "$f"; then
    grep -qi "fact.check" "$f" || echo "FAIL: publishing skill missing Fact-Check phase: $f"
    grep -q "humanizer_checklist" "$f" || echo "FAIL: publishing skill missing humanizer_checklist MANDATORY READ: $f"
  fi
done
```

## Check 11: Description trigger quality (D8, WARN)
```bash
for f in {scoped SKILL.md files}; do
  desc=$(sed -n '/^description:/p' "$f" | sed 's/^description: *//' | tr -d '"')
  if [ -n "$desc" ]; then
    echo "$desc" | grep -qiE '(Use (this )?(skill )?(when|for|before|after)|Trigger when|Invoked when|should be used when|Not for )' \
      || echo "WARN: description lacks trigger condition (WHEN): $f"
  fi
done
```

## Check 12: Execution proximity (D2b, WARN)
```bash
for f in {scoped SKILL.md files}; do
  # Find imperative actions referencing external tools without inline command template
  grep -nE '(Launch|Run|Execute) .*(agent_runner|--agent|background task|BOTH agents)' "$f" | while read match; do
    linenum=$(echo "$match" | cut -d: -f1)
    # Check 10 lines around for inline code block with actual command
    nearby=$(sed -n "$((linenum > 5 ? linenum-5 : 1)),$((linenum+10))p" "$f")
    echo "$nearby" | grep -qE '```|`node |`bash |--prompt-file|--output-file|--agent ' \
      || echo "WARN: imperative tool action at line $linenum without inline command template: $f"
  done
done
```

## Check 13: Platform API Compatibility
```bash
for f in {scoped SKILL.md files}; do
  grep -n 'Agent(resume:' "$f" && echo "FAIL: unsupported Agent(resume:) in $f — use SendMessage({to: agentId})"
  grep -nE 'effort.*"max"|effort: max' "$f" && echo "FAIL: unsupported effort \"max\" in $f — use low/medium/high"
done
```

## Check 17: Worker invocation enforcement (D8b)
```bash
for f in {scoped SKILL.md files}; do
  level=$(grep -oE 'L[12]' "$f" | head -1)
  [ -z "$level" ] && continue
  worker_count=$(grep -oE 'ln-[0-9]+-[a-z-]+' "$f" | sort -u | while read w; do
    self=$(basename $(dirname "$f") | grep -oE 'ln-[0-9]+-[a-z-]+')
    [ "$w" != "$self" ] && echo "$w"
  done | sort -u | wc -l)
  [ "$worker_count" -eq 0 ] && continue
  skill_calls=$(grep -c 'Skill(skill:' "$f" || true)
  [ "$skill_calls" -eq 0 ] && echo "FAIL: $level skill delegates to $worker_count workers but has no Skill() invocation code blocks: $f"
  grep -q 'Worker Invocation (MANDATORY)' "$f" || echo "FAIL: $level skill missing Worker Invocation (MANDATORY) section: $f"
  grep -q 'TodoWrite format (mandatory)' "$f" || echo "WARN: $level skill missing TodoWrite format section: $f"
done
```

## Check 18: Type line presence (D7)
```bash
for f in {scoped SKILL.md files}; do
  grep -q '\*\*Type:\*\*' "$f" || echo "FAIL: no **Type:** line: $f"
done
```

Every SKILL.md must have a `**Type:**` line (e.g., `**Type:** L1 Top Orchestrator`). Without it, Check 9 (Meta-Analysis) and Check 17 (Worker Invocation) silently skip the skill.

## Check 19: Worker independence (D8)
```bash
for f in {scoped SKILL.md files}; do
  grep '\*\*Type:\*\*' "$f" | grep -qi 'worker' || continue
  grep -q '^\*\*Coordinator:\*\*' "$f" && echo "FAIL: worker declares Coordinator: $f"
  grep -q '^\*\*Parent:\*\*' "$f" && echo "FAIL: worker declares Parent: $f"
  grep -nE 'Invoked by ln-[0-9]+|called by ln-[0-9]+' "$f" && echo "FAIL: worker declares caller coupling: $f"
done
```

## Check 20: Docs-model alignment for extraction skills (D4)
```bash
for f in {scoped SKILL.md files}; do
  case "$f" in
    *ln-160-*|*ln-161-*)
      grep -q 'markdown_read_protocol' "$f" || echo "FAIL: docs extraction skill missing markdown_read_protocol: $f"
      grep -q 'docs_quality_contract' "$f" || echo "FAIL: docs extraction skill missing docs_quality_contract: $f"
      grep -q 'procedural_extraction_rules' "$f" || echo "FAIL: docs extraction skill missing procedural_extraction_rules: $f"
      ;;
  esac
done
```

## Check 21: Standalone summary workers (D8)
```bash
for f in {scoped SKILL.md files}; do
  case "$f" in
    *ln-011-*|*ln-012-*|*ln-013-*|*ln-014-*|*ln-221-*|*ln-222-*|*ln-301-*|*ln-302-*)
      grep -q 'summaryArtifactPath' "$f" || echo "FAIL: standalone summary worker missing summaryArtifactPath contract: $f"
      grep -qi 'standalone' "$f" || echo "FAIL: standalone summary worker missing standalone wording: $f"
      grep -nE 'Invoked by ln-|called by ln-|returning control to `ln-|handing control back to `ln-' "$f" && echo "FAIL: standalone summary worker has caller coupling: $f"
      ;;
  esac
done
```

## Check 22: Run-scoped runtime artifact paths (D2)
```bash
for f in {scoped SKILL.md files}; do
  grep -nP '\.hex-skills/runtime-artifacts/(?!runs/)' "$f" && echo "FAIL: non-run-scoped runtime artifact path: $f"
done
```
