---
name: ln-514-test-log-analyzer
description: "Analyzes application logs: classifies errors, checks log quality, maps stack traces to source. Use when logs need review after test runs or during development."
license: MIT
model: claude-sonnet-4-6
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Test Log Analyzer

**Type:** L3 Worker
**Category:** 5XX Quality

Two-layer analysis of application logs. Node.js script handles collection and quantitative analysis; AI handles classification, quality assessment, and fix recommendations.

## Inputs

No required inputs. Runs in current project directory, auto-detects log sources.

Optional `args` — caller instructions (natural language): time window, expected errors, test context. Example: `"review logs for last 30min, auth 401 errors expected from negative tests"`.

## Purpose & Scope
- Analyze application logs (after test runs, during development, or on demand)
- Classify errors into 4 categories: Real Bug, Test Artifact, Expected Behavior, Operational Warning
- Assess log quality: noisiness, completeness, level correctness, format, structured logging
- Map stack traces to source files; provide fix recommendations
- Report findings for quality verdict (only Real Bugs block)
- **No status changes or task creation** — report only

## When to Use
- Analyze application logs in any project (default: last 1h)
- After test runs to classify errors and assess log quality
- Can be invoked with context instructions: `Skill(skill: "ln-514-test-log-analyzer", args: "review last 30min, 401 errors expected")`

## Workflow

### Phase 0: Parse Instructions

If `args` provided — extract: time window (default: 1h), expected errors list, test context.
If no `args` — use defaults (last 1h, no expected errors).

### Phase 1: Log Source Detection and Script Execution

Read target project files if they exist: `docs/project/infrastructure.md`, `docs/project/runbook.md`

1) Check if `scripts/analyze_test_logs.mjs` exists in target project. If missing, copy from `references/analyze_test_logs.mjs`.
2) Detect log source mode (auto-detection priority: docker → file → loki):

| Mode | Detection | Source |
|------|-----------|--------|
| `docker` | `docker compose ps` returns running containers | `docker compose logs --since {window}` |
| `file` | `.log` files exist, or `tests/manual/results/` has output | File paths from infrastructure.md or `*.log` glob |
| `loki` | `LOKI_URL` env var or `environment_state.json` observability section | Loki HTTP query_range API |

3) Run script: `node scripts/analyze_test_logs.mjs --mode {detected} [options]`
4) If no log sources found → return `NO_LOG_SOURCES` status, skip to Phase 5.

**Level-based error detection (CRITICAL):**
When constructing Loki queries or grep commands to scan for errors, ALWAYS filter by the **parsed level field**, NOT by text matching the word "error" in the full log line. Logger names like `uvicorn.error` contain "error" as part of the name but log at INFO level — text matching produces false positives.

| Log format | Correct error filter | Wrong filter |
|------------|---------------------|--------------|
| Pipe-delimited (`ts \| LEVEL \| ...`) | `\| ERROR` or `\| CRITICAL` (match level field position) | `grep -i error` (matches logger names) |
| Loki structured | `{service_name="X"} \| level="ERROR"` or `\| pattern` extraction | `{service_name="X"} \|= "error"` |
| Key=value (`level=ERROR msg=...`) | `level=ERROR` or `level=FATAL` | `\|~ "(?i)error"` |
| Docker logs (local) | `grep -E '\| ERROR \| \| CRITICAL '` | `grep -iE 'error\|exception'` |

The `analyze_test_logs.mjs` script handles this correctly via structured regex parsers. These rules apply to **ad-hoc Loki/grep queries** constructed during analysis.

### Phase 2: 4-Category Error Classification

Classify each error group from script JSON output:

| Category | Action | Criteria |
|----------|--------|----------|
| **Real Bug** | Fix | Unexpected crash, data loss, broken pipeline |
| **Test Artifact** | Skip | From test scripts, deliberate error-path validation |
| **Expected Behavior** | Skip | Rate limiting, input validation, auth failures from invalid tokens |
| **Operational Warning** | Monitor | Clock drift, resource pressure, temporary unavailability |

**Test artifact detection heuristics:**
- Test name contains: `invalid`, `error`, `fail`, `reject`, `unauthorized`, `forbidden`, `not_found`, `bad_request`, `timeout`
- Test asserts non-2xx status codes (4xx, 5xx)
- Test uses `pytest.raises`, `expect(...).rejects`, `assertThrows`, `should.throw`
- Errors correlate with test execution timestamps from regression test output
- Patterns matching `tests/manual/` scripts

**Error taxonomy per** `references/error_taxonomy.md` **(9 categories: CRASH, TIMEOUT, AUTH, DB, NETWORK, VALIDATION, CONFIG, RESOURCE, DEPRECATION).**

### Phase 3: Log Quality Assessment

**MANDATORY READ:** Load `references/error_taxonomy.md` (per-level criteria table + level correctness reference)

**Step 1: Detect configured log level.** Check in order:
1. `LOG_LEVEL` / `LOGLEVEL` env var (`.env`, `docker-compose.yml`, `infrastructure.md`)
2. Framework config: Python `logging.conf` / Django `LOGGING` / Node `LOG_LEVEL`
3. Default: assume `INFO` if not detected

Configured level determines WHICH levels appear in logs, but each level has its own noise threshold regardless.

**Step 2: Assess 6 quality dimensions:**

| Dimension | What to Check | Signal |
|-----------|---------------|--------|
| **Noisiness** | Per-level noise thresholds from `error_taxonomy.md` section 4: TRACE (zero in prod), DEBUG (>50% monopoly), INFO (>30%), WARNING (>1% of total), ERROR (>0.1% of total) | `NOISY: {level} template "{msg}" at {ratio}%` |
| **Completeness & Traceability** | Critical operations missing log entries + traceability gaps (see table below) | `MISSING: No log for {operation}` / `TRACEABILITY_GAP: {type} in {file}:{line}` |
| **Level correctness** | Per-level criteria from `error_taxonomy.md` section 4: content, anti-patterns, library rule | `WRONG_LEVEL: should be {level}` |
| **Structured logging** | Missing trace_id/request_id/user context; unstructured plaintext | `UNSTRUCTURED: lacks {field}` |
| **Sensitivity** | PII/secrets/tokens/passwords in log messages | `SENSITIVE: {type} exposure` |
| **Context richness** | Errors without actionable context (order_id, user_id, operation) | `LOW_CONTEXT: lacks context` |

**Traceability gap detection** — scan source code for operations without INFO-level logging:

| Operation Type | Expected Log | Where to Add |
|---------------|-------------|--------------|
| Incoming request handling | Request received + response status | Entry/exit of route handler |
| External API call | Request sent + response status + duration | Before/after HTTP client call |
| DB write (INSERT/UPDATE/DELETE) | Operation + affected entity + count | Before/after ORM/query call |
| Auth decision | Result (allow/deny) + reason | After auth check |
| State transition | Old state → new state + trigger | At transition point |
| Background job | Start + complete/fail + duration | Entry/exit of job handler |
| File/resource operation | Open/close + path + size | At I/O operation |

**Log Format Quality** (10-criterion checklist per `references/log_analysis_output_format.md`):

| # | Criterion | Check |
|---|-----------|-------|
| 1 | Dual format | JSON in prod, readable in dev |
| 2 | Timestamp | Consistent, timezone-aware |
| 3 | Level field | Present, uppercase |
| 4 | Trace/Correlation ID | Present in every entry, async-safe |
| 5 | Service name | Identifies source service |
| 6 | Source location | module:line + function |
| 7 | Extra context | Structured fields, not string interpolation |
| 8 | PII redaction | Passwords, API keys, emails handled |
| 9 | Noise suppression | Duplicate filters, third-party suppressed |
| 10 | Parseability | Dev: pipe-delimited; prod: valid JSON per line |

Score: passed criteria / 10.

### Phase 4: Stack Trace Mapping + Fix Recommendations

For each Real Bug:
1) Extract stack trace frames; identify origin frame (first frame in project code, not in node_modules/site-packages)
2) Map to source file:line
3) Generate fix recommendation: what to change, where, effort estimate (S/M/L)

**Prioritize using Sentry-inspired dimensions:**
- High-volume (occurrence count), Post-test regression (new errors), High-impact path (auth/payment/DB), Correlated traces (trace_id across services)

### Phase 5: Generate Report

**MANDATORY READ:** Load `references/log_analysis_output_format.md`

Output report to chat with header `## Test Log Analysis`. Include:
- Signals table (Real Bugs count, Test Artifacts filtered, Log Noise status, Log Format score, Log Quality score)
- Real Bugs table (priority, category, error, source, fix recommendation)
- Filtered table (category, count, examples)
- Log Quality Issues table (dimension, service, issue, recommendation)
- Noise Report table (count, ratio, service, level, template, action)
- Machine-readable block `<!-- LOG-ANALYSIS-DATA ... -->` for programmatic consumption

### Phase 6: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Skill type: `execution-worker`. Run after all phases complete.

## Verdict Contribution

Quality coordinator normalization matrix component:

| Status | Maps To | Penalty |
|--------|---------|---------|
| CLEAN | -- | 0 |
| WARNINGS_ONLY | -- | 0 |
| REAL_BUGS_FOUND | FAIL | -20 |
| SKIPPED / NO_LOG_SOURCES | ignored | 0 |

Log quality/format issues are INFORMATIONAL — do not affect quality verdict. Only Real Bugs block.

## Critical Rules
- No status changes or task creation; report only.
- Test Artifacts and Expected Behavior are ALWAYS filtered — never count as bugs.
- Log quality issues are advisory — inform, don't block.
- Script must handle gracefully: no Docker, no log files, no Loki → `NO_LOG_SOURCES`.
- Language preservation in comments (EN/RU).

## Runtime Summary Artifact

**MANDATORY READ:** Load `shared/references/quality_summary_contract.md`, `shared/references/quality_worker_runtime_contract.md`

Runtime profile:
- family: `quality-worker`
- worker: `ln-514`
- summary kind: `quality-worker`
- payload fields used by coordinators: `worker`, `status`, `verdict`, `issues`, `warnings`, `artifact_path`

Invocation rules:
- standalone: omit `runId` and `summaryArtifactPath`
- managed: pass both `runId` and exact `summaryArtifactPath`
- always write the validated summary before terminal outcome

## Definition of Done

- [ ] Script deployed to target project `scripts/` (or already exists)
- [ ] Log source detected and script executed (or NO_LOG_SOURCES returned)
- [ ] Errors classified into 4 categories; Real Bugs identified
- [ ] Log quality assessed (6 dimensions + 10-criterion format checklist)
- [ ] Stack traces mapped to source files for Real Bugs
- [ ] Report output to chat with signals table + machine-readable block

## Reference Files
- **Error taxonomy:** `references/error_taxonomy.md`
- **Output format:** `references/log_analysis_output_format.md`
- **Analysis script:** `references/analyze_test_logs.mjs`

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13
