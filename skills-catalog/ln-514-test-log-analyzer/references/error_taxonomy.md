# Error Taxonomy

Reference for error classification, detection patterns, severity rules, and log level correctness.

## 1. Error Categories

| Category | Base Severity | Detection Patterns |
|----------|--------------|-------------------|
| CRASH | CRITICAL | `Fatal`, `panic:`, `SIGSEGV`, `Segmentation fault`, `unhandled exception`, `uncaught error`, process exit != 0 |
| TIMEOUT | HIGH | `timeout`, `ETIMEDOUT`, `deadline exceeded`, `408`, `504`, `Gateway Timeout` |
| AUTH | HIGH | `401`, `403`, `unauthorized`, `forbidden`, `token expired`, `invalid credentials`, `access denied` |
| DB | HIGH | `deadlock`, `constraint violation`, `duplicate key`, `connection refused` (ports 5432/3306/27017), `migration failed`, `relation does not exist` |
| NETWORK | MEDIUM | `ECONNREFUSED`, `ECONNRESET`, `EHOSTUNREACH`, `DNS resolution failed`, `socket hang up` |
| VALIDATION | MEDIUM | `422`, `400`, `validation error`, `invalid input`, `schema mismatch`, `BadRequest` |
| CONFIG | MEDIUM | `missing env`, `config not found`, `undefined variable`, `ENOENT` for config files, `KeyError` for settings |
| RESOURCE | HIGH | `out of memory`, `OOM`, `disk full`, `EMFILE`, `too many open files`, `heap out of memory` |
| UNSUPPORTED_API | LOW | `unsupported`, `will be removed`, `use X instead`, `UnsupportedApiWarning` |

## 2. Language-Specific Stack Trace Patterns

### Python

```
Start:   Traceback \(most recent call last\):
Frame:   File "([^"]+)", line (\d+), in (\w+)
End:     ^(\w+Error|\w+Exception): (.+)
```

### Node.js / TypeScript

```
Frame:   at (\S+) \(([^)]+):(\d+):(\d+)\)
Alt:     at ([^)]+):(\d+):(\d+)
```

### Go

```
Start:   goroutine (\d+) \[(running|chan receive|select|sleep)\]:
Frame:   ([^\s]+)\.([^\s(]+)\(([^)]*)\)
Source:  \t([^:]+):(\d+) \+0x[0-9a-fA-F]+
```

### .NET / C#

```
Start:   (System\.\w+Exception|[A-Z]\w+Exception):
Frame:   at ([A-Za-z0-9_.]+)\(([^)]*)\) in ([^:]+):line (\d+)
Caused:  --->\s+(.+Exception): (.+)
```

### Java

```
Start:   ^([\w.]+Exception|[\w.]+Error): (.+)
Frame:   at ([\w.$]+)\(([\w.]+):(\d+)\)
Caused:  Caused by: ([\w.]+): (.+)
```

## 3. Severity Elevation Rules

| Occurrences | Action |
|-------------|--------|
| 1 | Base severity from category table |
| 3-5 | +1 level (LOW->MEDIUM->HIGH->CRITICAL) |
| 6+ | +1 level + flag as **systematic** |
| CRASH (any count) | Always CRITICAL, no elevation needed |

Severity order: LOW < MEDIUM < HIGH < CRITICAL.

## 4. Per-Level Criteria

Sources: Google Cloud LogSeverity (9 levels), OpenTelemetry Logs spec (severity 1-24), swift-log guidelines, Python logging, Logrus (Go).

### TRACE

| Criterion | Value |
|-----------|-------|
| Content | Internal state, variable values, detailed diagnostic flows, pool states |
| Volume (prod) | ZERO — must never appear in production |
| Noise threshold | Any trace in prod = misconfiguration |
| Required context | trace_id, function_name |
| Anti-patterns | Normal operations, per-line logging, anything expected to run regularly |
| Prod presence | NO — disabled by default |

### DEBUG

| Criterion | Value |
|-----------|-------|
| Content | Operation overview, connection events, major decisions, key branching points |
| Volume (prod) | LOW — enable only for troubleshooting |
| Noise threshold | Single template >50% of all DEBUG = monopolizes the channel |
| Required context | request_id, operation_name, duration |
| Anti-patterns | Per-request logging, every successful step, large object dumps, internal state (use TRACE) |
| Prod presence | MAYBE — not default, enable temporarily for diagnostics |

### INFO

| Criterion | Value |
|-----------|-------|
| Content | Recoverable failures, connection retries, fallback mechanisms, startup/shutdown, config changes |
| Volume (prod) | LOW-MEDIUM — concise and meaningful |
| Noise threshold | >30% from single template = noisy, demote to DEBUG |
| Required context | request_id, error_type, recovery_method |
| Anti-patterns | Normal success paths ("Request received", "Query executed"), per-request logging in hot paths |
| Prod presence | YES — required, minimum production level |

### WARNING

| Criterion | Value |
|-----------|-------|
| Content | One-time issues (startup only), potential problems, unsupported usage, resource exhaustion approaching |
| Volume (prod) | RARE — each WARNING must be actionable |
| Noise threshold | >1% of all logs = too many; repeated same condition = flooding |
| Required context | resource_name, threshold, recommendation |
| Anti-patterns | Repeated same condition (flooding), normal retryable failures, high-volume repeated warnings |
| Prod presence | YES — but rare, each must demand attention |

### ERROR

| Criterion | Value |
|-----------|-------|
| Content | Unrecoverable component failures, connection failures impacting operations, exceptions with stack trace |
| Volume (prod) | RARE — error/request ratio <1% in healthy state |
| Noise threshold | >0.1% of all logs = investigate root cause |
| Required context | error_code, request_id, stack_trace, retry_status, affected_operation |
| Anti-patterns | Validation failures (use WARNING), expected auth rejects (use INFO), handled business errors |
| Prod presence | YES — essential for monitoring |

### CRITICAL / FATAL

| Criterion | Value |
|-----------|-------|
| Content | System-level failures, cascading failures, data corruption, critical resource loss, process termination |
| Volume (prod) | ZERO-MINIMAL — must trigger alerts |
| Noise threshold | Any CRITICAL without alerting = misconfigured monitoring |
| Required context | service_name, user_impact, incident_id, recovery_action |
| Anti-patterns | Non-critical issues (single failed request), minor degradation, anything not requiring immediate action |
| Prod presence | YES + must trigger alerts immediately |

**Library rule (swift-log):** Libraries MUST use INFO or below. NEVER WARNING+ except one-time startup warnings.

**Configured log level** determines WHICH levels appear in logs, not which are acceptable to be noisy. Each level has its own noise threshold regardless of configuration.

## 5. 4-Category Classification Guide

| Classification | Criteria | Examples |
|---------------|----------|----------|
| Real Bug | Unexpected crash, data loss, broken pipeline, unhandled exception in business logic | NPE in payment flow, corrupted DB write, silent data truncation |
| Test Artifact | From test accounts, test scripts, deliberate error-path tests | Function name contains `invalid`/`error`/`fail`/`reject`, test user IDs, mock failures |
| Expected Behavior | Rate limiting, input validation rejects, auth on invalid tokens | 429 responses, 400 on malformed input, 401 on expired token |
| Operational Warning | Clock drift, resource pressure, temporary unavailability, startup noise | GC pause warnings, connection pool exhaustion recovery, leader election |

## 6. Message Normalization Rules

**MANDATORY READ:** Load `shared/references/output_normalization.md` for normalization rules, deduplication protocol, and error grouping categories.
