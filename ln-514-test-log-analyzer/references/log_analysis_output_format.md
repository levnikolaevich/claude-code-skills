# Log Analysis Output Format

Report format for ln-514-test-log-analyzer. Posted as PR comment; parsed by ln-510 via machine-readable block.

## 1. Report Header

```markdown
## Test Log Analysis

**Analyzer:** ln-514-test-log-analyzer v1.0.0
**Source:** {N} services, {M} log entries (mode: {docker|file|loki}, period: {window})
**Script:** `scripts/analyze_test_logs.mjs`
```

## 2. Signals Table

Quick snapshot for user. All values computed from sections below.

```markdown
### Signals

| Signal | Status | Detail |
|--------|--------|--------|
| Real Bugs | {count} | {top error summary} |
| Test Artifacts | {count} filtered | -- |
| Log Noise | CLEAN / NOISY | {top noisy template, ratio%} |
| Log Completeness | OK / GAPS | {missing operations list} |
| Log Format | {score}/10 | {missing criteria list} |
| Log Quality | {score}/10 | {issues summary} |
```

## 3. Real Bugs Table

```markdown
### Real Bugs (require fix)

| # | Priority | Category | Error | Source | Fix Recommendation |
|---|----------|----------|-------|--------|-------------------|
```

| Field | Values |
|-------|--------|
| Priority | CRITICAL, HIGH, MEDIUM, LOW (per `error_taxonomy.md` severity rules) |
| Category | One of 9 from `error_taxonomy.md` (CRASH, TIMEOUT, AUTH, DB, NETWORK, VALIDATION, CONFIG, RESOURCE, DEPRECATION) |
| Source | `file:line` extracted from stack trace |
| Fix | Concrete, actionable recommendation |

## 4. Filtered Table

```markdown
### Filtered (test artifacts / expected behavior)

| Category | Count | Examples |
|----------|-------|---------|
| Test Artifact | {N} | {first example} |
| Expected Behavior | {N} | {first example} |
| Operational Warning | {N} | {first example} |
```

## 5. Log Quality Issues Table

```markdown
### Log Quality Issues

| # | Dimension | Service | Issue | Recommendation |
|---|-----------|---------|-------|----------------|
```

| Dimension | What it checks |
|-----------|---------------|
| Noisiness | Repeated messages that should be deduplicated or demoted |
| Completeness & Traceability | Missing log entries for expected operations + traceability gaps |
| Level correctness | Wrong log level per `error_taxonomy.md` section 4 |
| Structured logging | Missing fields in structured format |
| Sensitivity | PII/secrets in log output |
| Context richness | Missing trace_id, request_id, or business context |

## 6. Log Format Quality Table

```markdown
### Log Format Quality: {score}/10

| # | Criterion | Status | Detail |
|---|-----------|--------|--------|
| 1 | Dual format | PASS/FAIL | {detail} |
| 2 | Timestamp | PASS/FAIL | {detail} |
| 3 | Level field | PASS/FAIL | {detail} |
| 4 | Trace/Correlation ID | PASS/FAIL | {detail} |
| 5 | Service name | PASS/FAIL | {detail} |
| 6 | Source location | PASS/FAIL | {detail} |
| 7 | Extra context | PASS/FAIL | {detail} |
| 8 | PII redaction | PASS/FAIL | {detail} |
| 9 | Noise suppression | PASS/FAIL | {detail} |
| 10 | Parseability | PASS/FAIL | {detail} |
```

Score = count of PASS criteria. Reference formats:

| Mode | Format |
|------|--------|
| Dev | `%(asctime)s \| %(levelname)-8s \| trace_id=%(trace_id)s \| %(name)s:%(lineno)d \| %(funcName)s() \| %(message)s` |
| Prod JSON | `{"timestamp": "...", "level": "INFO", "trace_id": "...", "service": "...", "name": "...", "lineno": 42, "funcName": "...", "message": "..."}` |

## 7. Traceability Gaps Table

```markdown
### Traceability Gaps

| # | Operation Type | File:Line | Current Logging | Recommendation |
|---|---------------|-----------|-----------------|----------------|
| 1 | {type} | {file}:{line} | {none/insufficient} | Add INFO: "{suggested_message}" |
```

| Operation Type | Expected INFO Log |
|---------------|------------------|
| Request handling | Request received + response status at entry/exit of route handler |
| External API call | Request sent + response status + duration before/after HTTP call |
| DB write | Operation + affected entity + count before/after ORM/query |
| Auth decision | Result (allow/deny) + reason after auth check |
| State transition | Old state → new state + trigger at transition point |
| Background job | Start + complete/fail + duration at entry/exit of job handler |
| File/resource I/O | Open/close + path + size at I/O operation |

## 8. Noise Report Table

```markdown
### Noise Report (threshold: {N}+)

| # | Count | Ratio | Service | Level | Template | Action |
|---|-------|-------|---------|-------|----------|--------|
```

| Action | When |
|--------|------|
| Demote to DEBUG | High-volume INFO/WARNING that adds no value |
| INVESTIGATE: repeated errors | ERROR/CRITICAL appearing 3+ times |
| Acceptable startup noise | One-time init messages at startup |
| Review manually | Cannot auto-classify |

## 9. Machine-Readable Block

Embedded at end of PR comment. Parsed by ln-510 for programmatic verdict.

```html
<!-- LOG-ANALYSIS-DATA
status: CLEAN | WARNINGS_ONLY | REAL_BUGS_FOUND | NO_LOG_SOURCES
real_bug_count: {N}
filtered_count: {N}
log_format_score: {N}/10
log_quality_score: {N}/10
noise_status: CLEAN | NOISY
real_bugs:
  - category: CRASH
    severity: CRITICAL
    message: "{normalized message}"
    source: "{file}:{line}"
    count: {N}
log_quality_issues:
  - dimension: "{dimension}"
    service: "{service}"
    signal: "{signal code}"
-->
```

## 10. Verdict Status Rules

| Condition | Status | ln-510 Effect |
|-----------|--------|---------------|
| Zero Real Bugs, zero quality issues | CLEAN | Non-blocking |
| Zero Real Bugs, quality issues exist | WARNINGS_ONLY | Non-blocking |
| One or more Real Bugs | REAL_BUGS_FOUND | FAIL |
| No log sources detected | NO_LOG_SOURCES | Non-blocking |

Only `REAL_BUGS_FOUND` maps to FAIL in ln-510 normalization matrix. All other statuses are non-blocking.
