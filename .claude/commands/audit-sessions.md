---
description: "Audit agent sessions for MCP, hooks, skills, tokens, and recurring workflow problems"
allowed-tools: "Bash, Agent, Read, Glob, mcp__hex-line__read_file, mcp__hex-line__grep_search, mcp__hex-line__outline"
---

# Audit Agent Sessions

Analyze all agent sessions from the last 3 days across Claude, Codex, and Gemini. Produce actionable optimization report.

## Source

| Field | Value |
|-------|-------|
| Source | Repo-maintained operational command |
| Review Contract | `skills-catalog/ln-162-skill-reviewer/references/command_review_criteria.md` |
| Related Skill | `skills-catalog/ln-002-session-analyzer/SKILL.md` |

**Scope:** Multi-day batch analysis (3 days, all agents). Aggregate patterns across sessions.
For single-session deep analysis: `ln-002-session-analyzer`. For skill self-audit: meta-analysis protocol §7.

**Routing gate:** If the user asks for `this session`, `current session`, or a single named session, do not run the 3-day inventory below.
Route to `ln-002-session-analyzer` and analyze that session directly from conversation context or the latest matching JSONL.

**Scope:** `$ARGUMENTS` — `all` (default), `mcp`, `hooks`, `skills`, `tokens`, `problems`.

## Session Storage

| Agent | Path | Format |
|-------|------|--------|
| Claude (conversations) | `~/.claude/projects/*/*.jsonl` | JSONL with `message.usage` token data |
| Claude (active) | `~/.claude/sessions/{PID}.json` | JSON `{pid, sessionId, cwd, startedAt, kind, entrypoint}` |
| Claude (index) | `~/.claude/history.jsonl` | JSONL `{sessionId, project, timestamp, display}` |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | JSONL with `token_count` events |
| Codex (index) | `~/.codex/history.jsonl` | JSONL `{session_id, ts, text, project}` |
| Gemini | Platform-dependent; protobuf on Windows | Not grep-parseable |

## Analysis Dimensions

| Code | Dimension | Scope Filter |
|------|-----------|-------------|
| D1 | MCP Problems & Optimization | `mcp`, `all` |
| D2 | Built-in Operations to MCP-ify | `mcp`, `all` |
| D3 | Hook Correctness & Efficiency | `hooks`, `all` |
| D4 | Cross-Agent Comparison | `all` |
| D5 | General Problems & Bottlenecks | `problems`, `all` |
| D6 | Skill Extraction Opportunities | `skills`, `all` |
| D7 | Skill Usage Analysis | `skills`, `all` |
| D8 | Token Statistics (real numbers) | `tokens`, `mcp`, `all` |
| D9 | Chronology & Trends | `all`, `mcp`, `tokens` |

---

## Step 0: Active Sessions

Detect currently running agent sessions before scanning history.

```bash
echo "=== ACTIVE CLAUDE SESSIONS ==="
ACTIVE_COUNT=0
for f in "$HOME/.claude/sessions"/*.json; do
  [ -f "$f" ] || continue
  PID=$(basename "$f" .json)
  if kill -0 "$PID" 2>/dev/null; then
    ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
    echo "  ACTIVE: $(cat "$f")"
  else
    echo "  STALE: PID=$PID (process dead, file not cleaned up)"
  fi
done
echo "  Active: $ACTIVE_COUNT"

echo "=== ACTIVE CODEX PROCESSES ==="
tasklist 2>/dev/null | grep -i codex | head -5 || ps aux 2>/dev/null | grep '[c]odex' | head -5 || echo "  None detected"
```

Present active sessions summary. Note stale PID files (Claude Code should clean these).

---


## Step 1: Session Inventory

Collect session file paths into temp files for all subsequent steps. Run as single bash block.

```bash
CUTOFF=$(date -d '3 days ago' +%s)
> /tmp/audit_claude.txt; > /tmp/audit_codex.txt; > /tmp/audit_gemini.txt
C_COUNT=0; C_SIZE=0; X_COUNT=0; X_SIZE=0; G_COUNT=0; G_SIZE=0

echo "=== SESSION INVENTORY (since $(date -d @$CUTOFF +%Y-%m-%d)) ==="

echo "## Claude"
for proj_dir in "$HOME/.claude/projects"/*/; do
  [ -d "$proj_dir" ] || continue
  for f in "$proj_dir"*.jsonl; do
    [ -f "$f" ] || continue
    MOD=$(stat -c %Y "$f" 2>/dev/null)
    [ -z "$MOD" ] && continue
    [ "$MOD" -lt "$CUTOFF" ] && continue
    SIZE=$(wc -c < "$f" | tr -d ' ')
    LINES=$(wc -l < "$f" | tr -d ' ')
    C_SIZE=$((C_SIZE + SIZE)); C_COUNT=$((C_COUNT + 1))
    echo "$f" >> /tmp/audit_claude.txt
    echo "  $LINES lines, ${SIZE}B: $(basename "$(dirname "$f")")/$(basename "$f")"
  done
done
echo "  Total: $C_COUNT sessions, $((C_SIZE / 1024))KB"

echo "## Codex"
for f in "$HOME/.codex/sessions"/????/??/??/rollout-*.jsonl; do
  [ -f "$f" ] || continue
  MOD=$(stat -c %Y "$f" 2>/dev/null)
  [ -z "$MOD" ] && continue
  [ "$MOD" -lt "$CUTOFF" ] && continue
  SIZE=$(wc -c < "$f" | tr -d ' ')
  X_SIZE=$((X_SIZE + SIZE)); X_COUNT=$((X_COUNT + 1))
  echo "$f" >> /tmp/audit_codex.txt
  echo "  ${SIZE}B: $(basename "$f")"
done
echo "  Total: $X_COUNT sessions, $((X_SIZE / 1024))KB"

echo "## Gemini"
# Try JSON path (Linux/macOS) then protobuf path (Windows)
for f in "$HOME/.gemini/tmp"/*/chats/session-*.json "$HOME/.gemini/antigravity/implicit"/*.pb; do
  [ -f "$f" ] || continue
  MOD=$(stat -c %Y "$f" 2>/dev/null)
  [ -z "$MOD" ] && continue
  [ "$MOD" -lt "$CUTOFF" ] && continue
  SIZE=$(wc -c < "$f" | tr -d ' ')
  G_SIZE=$((G_SIZE + SIZE)); G_COUNT=$((G_COUNT + 1))
  echo "$f" >> /tmp/audit_gemini.txt
  echo "  ${SIZE}B: $(basename "$f")"
done
echo "  Total: $G_COUNT sessions, $((G_SIZE / 1024))KB"
[ "$G_COUNT" -gt 0 ] && file "$(head -1 /tmp/audit_gemini.txt)" 2>/dev/null | grep -q 'data\|Protocol' && echo "  Note: Gemini sessions are protobuf — not grep-parseable"
```

Present inventory as table. If `$ARGUMENTS` is set, note which dimensions apply.

---

## Step 2: Data Extraction

Run these bash blocks in parallel. All read from `/tmp/audit_*.txt` created in Step 1.

### 2a. Tool Usage Frequency (all agents)

```bash
echo "=== CLAUDE TOOL CALLS ==="
while IFS= read -r f; do
  grep -oE '"name"\s*:\s*"[^"]*"' "$f" 2>/dev/null
done < /tmp/audit_claude.txt | sed 's/"name"\s*:\s*"//;s/"//' | sort | uniq -c | sort -rn | head -50

echo "=== CODEX TOOL CALLS ==="
while IFS= read -r f; do
  grep -oE '"name"\s*:\s*"[^"]*"' "$f" 2>/dev/null
done < /tmp/audit_codex.txt | sed 's/"name"\s*:\s*"//;s/"//' | sort | uniq -c | sort -rn | head -50

echo "=== GEMINI TOOL CALLS ==="
while IFS= read -r f; do
  grep -oE '"name"\s*:\s*"[^"]*"' "$f" 2>/dev/null
done < /tmp/audit_gemini.txt | sed 's/"name"\s*:\s*"//;s/"//' | sort | uniq -c | sort -rn | head -50
```

### 2b. Built-in vs MCP Ratio (Claude)

```bash
echo "=== BUILT-IN vs MCP RATIO ==="
while IFS= read -r f; do
  grep -oE '"name"\s*:\s*"(Read|Edit|Write|Grep|mcp__hex-line__read_file|mcp__hex-line__edit_file|mcp__hex-line__write_file|mcp__hex-line__grep_search|mcp__sharpline__read_file|mcp__sharpline__edit_file|mcp__sharpline__write_file|mcp__sharpline__grep_search)"' "$f" 2>/dev/null
done < /tmp/audit_claude.txt | sed 's/.*"name"\s*:\s*"//;s/"//' | sort | uniq -c | sort -rn
```

### 2c. Token Statistics (Claude + Codex — real data)

```bash
echo "=== CLAUDE TOKEN STATS (real usage data) ==="
while IFS= read -r f; do
  SESSION=$(basename "$f" .jsonl | cut -c1-8)
  TOTAL_IN=$(grep -oE '"input_tokens":[0-9]+' "$f" | grep -oE '[0-9]+' | paste -sd+ | bc 2>/dev/null)
  TOTAL_OUT=$(grep -oE '"output_tokens":[0-9]+' "$f" | grep -oE '[0-9]+' | paste -sd+ | bc 2>/dev/null)
  CACHE_CREATE=$(grep -oE '"cache_creation_input_tokens":[0-9]+' "$f" | grep -oE '[0-9]+' | paste -sd+ | bc 2>/dev/null)
  CACHE_READ=$(grep -oE '"cache_read_input_tokens":[0-9]+' "$f" | grep -oE '[0-9]+' | paste -sd+ | bc 2>/dev/null)
  [ "${TOTAL_IN:-0}" -gt 0 ] 2>/dev/null && echo "$SESSION: in=${TOTAL_IN:-0} out=${TOTAL_OUT:-0} cache_create=${CACHE_CREATE:-0} cache_read=${CACHE_READ:-0}"
done < /tmp/audit_claude.txt | sort -t= -k2 -rn | head -20

echo "=== CODEX TOKEN STATS ==="
while IFS= read -r f; do
  SESSION=$(basename "$f" .jsonl | sed 's/rollout-//' | cut -c1-19)
  LAST=$(grep '"token_count"' "$f" | tail -1)
  [ -z "$LAST" ] && continue
  TOTAL_IN=$(echo "$LAST" | grep -oE '"input_tokens":[0-9]+' | head -1 | grep -oE '[0-9]+')
  TOTAL_OUT=$(echo "$LAST" | grep -oE '"output_tokens":[0-9]+' | head -1 | grep -oE '[0-9]+')
  CACHED=$(echo "$LAST" | grep -oE '"cached_input_tokens":[0-9]+' | head -1 | grep -oE '[0-9]+')
  REASONING=$(echo "$LAST" | grep -oE '"reasoning_output_tokens":[0-9]+' | head -1 | grep -oE '[0-9]+')
  echo "$SESSION: in=${TOTAL_IN:-0} out=${TOTAL_OUT:-0} cached=${CACHED:-0} reasoning=${REASONING:-0}"
done < /tmp/audit_codex.txt
```

### 2d. Errors & Hook Events

```bash
echo "=== CLAUDE ERRORS (by session) ==="
while IFS= read -r f; do
  ERRS=$(grep -cE 'NOOP_EDIT|TEXT_NOT_FOUND|FILE_NOT_FOUND|HASH_HINT|DANGEROUS|out of range|mismatch|tool_use_error' "$f" 2>/dev/null | tr -d '[:space:]')
  [ "${ERRS:-0}" -gt 0 ] 2>/dev/null && echo "$(basename "$(dirname "$f")")/$(basename "$f" .jsonl | cut -c1-8): $ERRS"
done < /tmp/audit_claude.txt | sort -t: -k2 -rn | head -20

echo "=== CLAUDE ERROR TYPES ==="
while IFS= read -r f; do
  grep -oE 'NOOP_EDIT|TEXT_NOT_FOUND|FILE_NOT_FOUND|HASH_HINT|DANGEROUS|out of range|mismatch|tool_use_error|permission denied' "$f" 2>/dev/null
done < /tmp/audit_claude.txt | sort | uniq -c | sort -rn

echo "=== CLAUDE HOOK EVENTS ==="
while IFS= read -r f; do
  grep -oE 'hook_progress|blocking error|PreToolUse|PostToolUse|hex-confirmed|Obligatory use|Use mcp__hex-line|Use mcp__sharpline' "$f" 2>/dev/null
done < /tmp/audit_claude.txt | sort | uniq -c | sort -rn

echo "=== CODEX ERROR TYPES ==="
while IFS= read -r f; do
  grep -oE 'NOOP_EDIT|TEXT_NOT_FOUND|FILE_NOT_FOUND|HASH_HINT|mismatch|out of range' "$f" 2>/dev/null
done < /tmp/audit_codex.txt | sort | uniq -c | sort -rn

echo "=== GEMINI ERROR TYPES ==="
while IFS= read -r f; do
  grep -oE 'NOOP_EDIT|TEXT_NOT_FOUND|FILE_NOT_FOUND|HASH_HINT|mismatch|out of range' "$f" 2>/dev/null
done < /tmp/audit_gemini.txt | sort | uniq -c | sort -rn
```

Validate these counts against actual tool failure/result events before reporting them as findings.
The same keywords can appear inside instructions, templates, or embedded docs and inflate raw grep totals.

### 2e. Skill Usage

```bash
echo "=== SKILL INVOCATIONS ==="
while IFS= read -r f; do
  grep -oE '"skill"\s*:\s*"[^"]*"' "$f" 2>/dev/null | sed 's/"skill"\s*:\s*"//;s/"//'
done < /tmp/audit_claude.txt | sort | uniq -c | sort -rn

echo "=== /COMMAND INVOCATIONS ==="
while IFS= read -r f; do
  # Match actual user prompts: "display":"/command-name"
  grep -oE '"display":\s*"/[a-z-]+' "$f" 2>/dev/null | sed 's/"display":\s*"//'
done < /tmp/audit_claude.txt | sort | uniq -c | sort -rn
```

### 2f. Tool Loops Detection

```bash
echo "=== TOOL LOOPS (>=5 consecutive same tool) ==="
while IFS= read -r f; do
  LOOPS=$(grep -oE '"name"\s*:\s*"[^"]*"' "$f" 2>/dev/null | sed 's/"name"\s*:\s*"//;s/"//' | uniq -c | sort -rn | awk '$1 >= 5' | head -5)
  [ -n "$LOOPS" ] && echo "$(basename "$f" .jsonl | cut -c1-8):" && echo "$LOOPS"
done < /tmp/audit_claude.txt

echo "=== OUTLINE USAGE (read without outline) ==="
while IFS= read -r f; do
  READS=$(grep -cE 'mcp__hex-line__read_file|mcp__sharpline__read_file' "$f" 2>/dev/null | tr -d '[:space:]')
  OUTLINES=$(grep -cE 'mcp__hex-line__outline|mcp__sharpline__outline' "$f" 2>/dev/null | tr -d '[:space:]')
  [ "${READS:-0}" -gt 5 ] 2>/dev/null && [ "${OUTLINES:-0}" -lt 2 ] 2>/dev/null && echo "$(basename "$f" .jsonl | cut -c1-8): $READS reads, $OUTLINES outlines"
done < /tmp/audit_claude.txt

echo "=== BASH REDIRECT CANDIDATES ==="
while IFS= read -r f; do
  grep -oE '"command"\s*:\s*"(cat |head |tail |ls |find |wc |stat |diff )[^"]*"' "$f" 2>/dev/null
done < /tmp/audit_claude.txt | sed 's/"command"\s*:\s*"//;s/"//' | sort | uniq -c | sort -rn | head -20
```

### 2g. Chronology & Trends (D9)

Group tool usage by day to detect adoption trends, stale tool names fading, error rate changes.

```bash
echo "=== DAILY TOOL TRENDS (Claude) ==="
while IFS= read -r f; do
  # Use file modification date as session date
  DAY=$(stat -c %Y "$f" 2>/dev/null | xargs -I{} date -d @{} +%m-%d 2>/dev/null)
  [ -z "$DAY" ] && continue
  # Count tool categories
  HEX=$(grep -cE 'mcp__hex-line__' "$f" 2>/dev/null | tr -d '[:space:]')
  SHARP=$(grep -cE 'mcp__sharpline__' "$f" 2>/dev/null | tr -d '[:space:]')
  BUILTIN=$(grep -cE '"name"\s*:\s*"(Read|Edit|Write|Grep)"' "$f" 2>/dev/null | tr -d '[:space:]')
  ERRS=$(grep -cE 'NOOP_EDIT|TEXT_NOT_FOUND|mismatch|HASH_HINT|out of range' "$f" 2>/dev/null | tr -d '[:space:]')
  echo "$DAY hex-line=${HEX:-0} sharpline=${SHARP:-0} built-in=${BUILTIN:-0} errors=${ERRS:-0}"
done < /tmp/audit_claude.txt | sort | awk '
{
  day=$1; split($2,a,"="); split($3,b,"="); split($4,c,"="); split($5,d,"=")
  hex[day]+=a[2]; sharp[day]+=b[2]; bi[day]+=c[2]; err[day]+=d[2]
}
END {
  printf "%-6s %8s %10s %9s %7s %11s\n", "Day", "hex-line", "sharpline", "built-in", "errors", "MCP-ratio"
  for (day in hex) {
    total = hex[day]+sharp[day]+bi[day]
    ratio = (total > 0) ? sprintf("%.0f%%", (hex[day]+sharp[day])*100/total) : "N/A"
    printf "%-6s %8d %10d %9d %7d %11s\n", day, hex[day], sharp[day], bi[day], err[day], ratio
  }
}' | sort

echo "=== DAILY TOOL TRENDS (Codex) ==="
while IFS= read -r f; do
  DAY=$(basename "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | tail -1 | cut -c6-)
  [ -z "$DAY" ] && continue
  HEX=$(grep -cE 'mcp__hex.line|mcp__hex_line' "$f" 2>/dev/null | tr -d '[:space:]')
  HASH=$(grep -cE 'mcp__hashline' "$f" 2>/dev/null | tr -d '[:space:]')
  SHARP=$(grep -cE 'mcp__sharpline' "$f" 2>/dev/null | tr -d '[:space:]')
  SHELL=$(grep -cE '"shell_command"' "$f" 2>/dev/null | tr -d '[:space:]')
  echo "$DAY hex-line=${HEX:-0} hashline=${HASH:-0} sharpline=${SHARP:-0} shell=${SHELL:-0}"
done < /tmp/audit_codex.txt | sort | awk '
{
  day=$1; split($2,a,"="); split($3,b,"="); split($4,c,"="); split($5,d,"=")
  hex[day]+=a[2]; hash[day]+=b[2]; sharp[day]+=c[2]; sh[day]+=d[2]
}
END {
  printf "%-6s %8s %9s %10s %6s\n", "Day", "hex-line", "hashline", "sharpline", "shell"
  for (day in hex) printf "%-6s %8d %9d %10d %6d\n", day, hex[day], hash[day], sharp[day], sh[day]
}' | sort

echo "=== TREND INDICATORS ==="
echo "Look for:"
echo "  - sharpline/hashline counts declining to 0 → rename propagating"
echo "  - hex-line growing day-over-day → adoption improving"
echo "  - MCP-ratio increasing → hooks/instructions working"
echo "  - error count declining → fixes taking effect"
```

### 2h. Communication & Decision Patterns

```bash
echo "=== COMMUNICATION PATTERNS (Claude) ==="
while IFS= read -r f; do
  # Over-explanation: assistant messages > 500 chars
  LONG=$(grep -cE '"role":\s*"assistant".*".{500,}"' "$f" 2>/dev/null | tr -d '[:space:]')
  # Unnecessary confirmations: "shall I", "should I", "let me know"
  CONFIRMS=$(grep -ciE 'shall I|should I proceed|let me know|would you like me' "$f" 2>/dev/null | tr -d '[:space:]')
  # Dead ends: tool_use_error followed by different approach
  DEADENDS=$(grep -cE 'tool_use_error' "$f" 2>/dev/null | tr -d '[:space:]')
  [ "${LONG:-0}" -gt 5 ] 2>/dev/null || [ "${CONFIRMS:-0}" -gt 3 ] 2>/dev/null || [ "${DEADENDS:-0}" -gt 3 ] 2>/dev/null && \
    echo "$(basename "$f" .jsonl | cut -c1-8): long=$LONG confirms=$CONFIRMS dead_ends=$DEADENDS"
done < /tmp/audit_claude.txt | sort -t= -k2 -rn | head -10
```

---

## Step 3: Parallel Agent Analysis

Launch up to 3 agents based on scope. Pass ALL extracted data from Step 2 as text in agent prompt.

### Agent A: MCP & Hooks & Tokens (D1 + D2 + D3 + D8 + D9)

**Scope triggers:** `all`, `mcp`, `hooks`, `tokens`

Prompt with: tool frequency, built-in vs MCP ratio, token stats, errors, hook events, trend data. Analyze:

- **D1:** Tool errors by type, full-file reads without outline, retry loops, edit mismatches
- **D2:** Built-in calls that should use hex-line, Bash commands that match redirect patterns
- **D3:** Hook blocks (correct? false positives?), hex-confirmed bypasses (justified?), redirect hints (understood?)
- **D8:** Per-tool token cost estimates, cache hit ratio, highest-consumption sessions
- **D9:** MCP adoption trend (day-over-day), stale name decline, error trend

Output tables:
```
### D8: Token Statistics
| Metric | Claude | Codex | Gemini |

### D1: MCP Problems
| # | Problem | Agent | Sessions | Occurrences | Impact | Fix |

### D2: MCP-ify Candidates
| # | Built-in Pattern | Occurrences | hex-line Equivalent | Token Savings Est. |

### D3: Hook Issues
| # | Event | Expected | Actual | Fix |

### D9: Trends
| Day | MCP Ratio | Stale Names | Error Rate | Notable |
```

### Agent B: Cross-Agent & Problems (D4 + D5)

**Scope triggers:** `all`, `problems`

Prompt with: per-agent tool frequencies, error counts, session sizes. Analyze:

- **D4:** MCP name mapping differences, error rate per agent, tool preference differences
- **D5:** Permission denials, timeouts, context pressure, tool loops (>=5 consecutive), failed approaches

Output tables:
```
### D4: Cross-Agent Comparison
| Metric | Claude | Codex | Gemini |

### D5: Problems & Bottlenecks
| # | Problem Type | Agent | Sessions | Occurrences | Impact | Fix |
```

### Agent C: Skills & Patterns (D6 + D7)

**Scope triggers:** `all`, `skills`

Prompt with: skill usage data, /command references, tool call sequences. Analyze:

- **D6:** Recurring multi-step sequences, frequent bash scripts, operations that could become /commands
- **D7:** Skill invocations (direct + referenced), deviations from instructions, confusion patterns, agent confusion signals (same tool 5+ times on same target), communication issues (over-explanation, missing status, unnecessary confirmations)

Output tables:
```
### D6: Skill Extraction Opportunities
| # | Pattern | Sessions | Steps | Candidate Skill/Command |

### D7: Skill Usage Issues
| # | Skill | Issue | Sessions | Fix |
```

---

## Step 4: Merged Report

Combine agent outputs into single report. Present in chat:

```markdown
# Session Audit Report — {start_date} to {end_date}

## Inventory
| Agent | Sessions | Errors | MCP Calls | Built-in Calls | Total Tokens |
|-------|----------|--------|-----------|----------------|-------------|

## D8: Token Statistics
{Agent A D8 output}

## D9: Trends
{Agent A D9 output}

## D1: MCP Problems
{Agent A D1 output}

## D2: Built-in to MCP-ify
{Agent A D2 output}

## D3: Hook Issues
{Agent A D3 output}

## D4: Cross-Agent Comparison
{Agent B D4 output}

## D5: Problems & Bottlenecks
{Agent B D5 output}

## D6: Skill Extraction
{Agent C D6 output}

## D7: Skill Usage
{Agent C D7 output}

## Priority Actions
| # | Dim | Finding | Target | Fix |
|---|---------|--------|-----|

Top 5-10 actionable items sorted by impact. Each with specific file/config to change.
For deeper single-session analysis, use `ln-002-session-analyzer`.
```


---

## Step 5: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Analyze this session per protocol §7. Output per protocol format.

---
**Last Updated:** 2026-04-12
