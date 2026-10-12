---
name: ln-57-persistence-auditor
description: "Audits queries, transactions, consistency and persistence resource lifetimes; read-only."
---

# Persistence Auditor

**Goal:** Perform a read-only audit of persistence and data-heavy runtime paths. Connect static candidates to real query, transaction, resource, or consistency mechanisms and avoid claiming performance impact without evidence.

**Execution contract:** Track every checklist item as `PENDING`, `PROVEN` with observed outcome evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap. Reading, delegation, tool failure, zero exit status, and self-reported success are not proof. Reconcile after each section; before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, mode, and existing authorization. Complete authorized work before required external approval; ask only consequential unresolved choices. If nobody can answer, report the exact question and apply the skill's gap verdict without waiting or guessing. Cite any blocking instruction and unresolved boundary; never invent approval gates. Scale depth to material risk; preserve mandatory checks, dependencies, and safety order while choosing verification methods.
Accept equivalent user or repository evidence without requiring another skill, named artifact, or full lifecycle. Preserve source requirement and decision IDs. Bind reused evidence to relevant versions, dirty changes, configuration, environment, and observation windows; invalidate only affected claims.
Choose the primary workflow by outcome and explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting audits. Split distinct deliverables by scope, not mandatory skill invocation. Broad independent assessments use audit workflows; focused domain reviews remain read-only.
On continuation, reconcile task, authorization, state, and gaps. Return a compact continuation record for long work or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Before retrieval, define the evidence question; read selectively without skipping applicable instructions. Use tools for mechanical processing; summarize bounded results, errors, coverage, and source paths, keeping full output outside context.
Before technical decisions, establish applicability and actual versions; verify version-dependent assumptions against official documentation or specifications. Search and read primary pages for current external recommendations; snippets are not evidence. Version-matched bundled documentation or valid prior evidence suffices. Record decision, version, source, and limitations. Mark unavailable evidence UNVERIFIED; block only essential dependent work. Prefer native mechanisms, justify added tools or abstractions with evidence, and reuse the existing rule owner.


## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Data-layer map | Native file search over manifests, models, mappings, repositories, migrations, queries, cache, queue, and pool configuration | Establishing stores, frameworks, ownership, and scope | Trace from known request, job, or command entrypoints |
| Call paths and resource ownership | Language server or host-native code intelligence | Following service calls, transaction boundaries, async flow, session scopes, and cleanup | Targeted search plus direct inspection of definitions and callers |
| Query behavior | Existing query logs, tracing, ORM diagnostics, and application metrics | Establishing frequency, duplication, timing, rows, and cache behavior | Static query-in-loop and fetch-shape analysis with explicit limits |
| Query plans | Database-native explain tooling on an approved non-production target | A safe read query and representative schema/data are available | Inspect indexes, predicates, joins, statistics assumptions, and generated SQL statically |
| Runtime performance | Existing profiler, benchmark, or repository diagnostic command | Allocation, blocking, loop amplification, or I/O cost needs measurement | Complete static cost path marked as unmeasured |
| Correctness verification | Repository-defined tests, integration environment, and migration checks | Reproducing transaction, retry, consistency, or lifecycle behavior safely | Static failure trace and required verification plan |
| External semantics | Official database, driver, framework, and runtime documentation matching installed versions | Isolation, pooling, cancellation, caching, trigger, or async semantics affect a finding | Primary-source web research; otherwise mark `UNVERIFIED` |

Never connect to production or run mutating diagnostics. `EXPLAIN ANALYZE` executes the statement: use it only for confirmed read-only queries on an approved disposable or non-production target. Do not create indexes, migrate, vacuum, rewrite data, or change pool settings during the audit.

## Workflow Boundary

This workflow owns read-only persistence findings, including migration and replay risks. Schema delivery and database recovery are lifecycle implementation; runtime effect recovery is mutation implementation. Findings do not authorize either change.

Use this workflow for an independent assessment across persistence paths. A focused review of a particular migration or recovery procedure may remain with database lifecycle engineering in read-only mode; do not run both reviews merely because they share a subject.

## Evidence Rules

- Query count, duration, rows, plan, lock, or profile evidence is stronger than a static performance suspicion.
- Static evidence can prove correctness and lifecycle defects when the full path is visible, but performance impact must be labeled unmeasured.
- ORM conventions, bounded administrative paths, startup-only work, and intentionally small datasets require context before becoming findings.
- Transaction advice must match the actual database, isolation level, driver, framework, and retry model.
- Recommendations must preserve data integrity and failure semantics, not only reduce latency.

## Checklist

### 1. Establish the Data and Runtime Context

- [ ] Detect databases, ORMs, drivers, caches, queues, schemas, migrations, pools, dependency-injection scopes, and runtime entrypoints in scope.
- [ ] Resolve installed versions, database capabilities, deployment topology, consistency requirements, and expected workload from repository evidence.
- [ ] Identify critical data paths, high-volume paths, streaming paths, scheduled work, and operations that hold transactions or resources across external calls.
- [ ] Read repository instructions and inspect Git state before running diagnostics or interpreting current work.
- [ ] Establish available query logs, metrics, traces, profiles, representative data, test environments, and safe diagnostic permissions.
- [ ] Keep the audit read-only; record executed query shapes, commands, targets, and created artifacts with sensitive parameters, credentials, and row data redacted.

### 2. Audit Query and Cache Efficiency

- [ ] Trace representative paths from entrypoint to generated query and materialization, including tenant/owner predicates and row-level controls where they determine which data may be read or changed.
- [ ] Find N+1 behavior, repeated fetches, query-in-loop amplification, unnecessary sequential independent reads, and redundant existence/count queries; preserve snapshot, ordering, connection-budget, and transaction constraints when proposing batching or parallelism.
- [ ] Check over-fetching, broad entity loading, unbounded reads, premature materialization, missing pagination, and user-controlled result amplification.
- [ ] Check missing bulk operations, per-row writes, avoidable round trips, fragmented commits, and opportunities for set-based work.
- [ ] Inspect predicates, joins, sort and group operations, index alignment, query-plan assumptions, and statistics only with schema and workload context.
- [ ] Check cache ownership, key design, scope, invalidation, stampede control, negative caching, staleness tolerance, and duplication with database guarantees.
- [ ] Distinguish latency caused by query shape, connection wait, locks, network, serialization, application work, or downstream services before recommending a fix.
- [ ] Measure or clearly label the expected impact; do not present a candidate index or cache as a proven optimization.

### 3. Audit Transactions and Consistency

- [ ] Identify who begins, commits, rolls back, retries, and disposes each transaction and whether ownership matches the business operation.
- [ ] Check atomicity across related writes, early commits, missing rollback, swallowed exceptions, nested transaction behavior, and partial-success states.
- [ ] Find long-held transactions, network or file calls inside transactions, user interaction during locks, and transactions spanning unnecessary computation.
- [ ] Check isolation assumptions, lost updates, write skew, duplicate processing, optimistic or pessimistic locking, and retry safety.
- [ ] Verify idempotency keys, unique constraints, deduplication, outbox or inbox behavior, and at-least-once delivery paths where applicable.
- [ ] Check triggers, notifications, events, and subscribers for naming, commit-time visibility, payload compatibility, ordering, duplicate delivery, and orphan consumers; do not add intermediate commits merely to expose progress if that breaks business atomicity.
- [ ] Check migrations and backfills for transactional behavior, lock duration, mixed-version compatibility, resumability, and failure recovery.
- [ ] Verify recommendations against official semantics for the installed database, driver, and framework when behavior is version-sensitive.

### 4. Audit Runtime and Resource Lifecycle

- [ ] Check blocking database, filesystem, or network I/O in asynchronous paths and synchronous waits that can starve workers or event loops.
- [ ] Check repeated allocation, copying, serialization, string building, conversion, and collection growth on data-heavy loops.
- [ ] Trace sessions, connections, cursors, readers, streams, locks, subscriptions, and temporary files through success, error, timeout, cancellation, and streaming completion.
- [ ] Include consumer abandonment and partial enumeration: generators, async iterators, streaming responses, and client disconnects must release resources even when normal completion never occurs.
- [ ] Check dependency-injection scope against resource lifetime, especially singleton access to scoped state and request resources held by background or streaming work.
- [ ] For background, streaming, or otherwise longer-lived work, verify bounded resource ownership and acquisition at the point of need instead of retaining a shorter-lived session or connection; a passed factory or pool is one valid design, not a universal requirement.
- [ ] Inspect pool size, timeouts, acquisition, validation, recycling, leak evidence, and the total connection budget across replicas, processes, workers, and failover capacity—not only one process's setting.
- [ ] Check cancellation propagation, command timeouts, retry storms, circuit behavior, and cleanup between retry attempts and after abandoned work.
- [ ] Check ORM expiration, lazy loading, detached entities, and implicit autoflush so no query or write occurs outside the intended session or transaction lifetime.
- [ ] Use runtime measurements where available to separate hot paths from low-frequency or bounded code before assigning performance severity.

### 5. Validate Findings and Report

- [ ] Reproduce high-severity correctness defects with a safe test or complete failure trace and performance defects with query, plan, lock, or profile evidence where possible.
- [ ] Filter framework-managed lifecycle, bounded maintenance tasks, fixtures, migrations kept for history, and documented consistency tradeoffs before confirming findings.
- [ ] Deduplicate symptoms that share one root query, transaction boundary, scope mismatch, or pool configuration.
- [ ] Apply the materiality gate: require concrete integrity, security, availability, latency, scalability, resource, or recurring maintenance impact at evidenced scale. Reject taste, theoretical purity, generic practice, hypothetical scale, and reasonable alternatives; require the outcome or constraint, not a preferred implementation.
- [ ] **External correction evidence:** Ground external corrections in version-matched official contracts, using primary engineering sources for unresolved tradeoffs. Cite the supported mechanism; local evidence suffices for local defects.
- [ ] For accepted persistence findings, name the data invariant, owning transaction/query boundary, and reproducible correction evidence without performing remediation.
- [ ] Classify findings as `P0`-`P3` based on data corruption, security, outage risk, scalability, latency, resource exhaustion, and recurrence.
- [ ] Use `BLOCKED` when a critical data path, database semantic, or required non-production environment cannot be verified without a credible fallback; use `FAIL` for an evidenced unresolved corruption, atomicity, outage, resource-exhaustion risk, required failing gate, or another `P0/P1`; use `CONCERNS` only for evidenced non-blocking risk or material unmeasured uncertainty, and `PASS` only when critical paths are trustworthy with no material finding.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Stores, versions, workload, deployment, and measured versus statically inspected paths; query/cache efficiency, transactions, consistency, and resource lifecycle. Findings need priority, call path/query/resource, evidence and confidence, failure or cost mechanism, workload impact, unacceptable tradeoff, and minimal safe correction plus verification. Label unmeasured impact and accepted consistency tradeoffs.
