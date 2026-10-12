---
name: ln-92-container-engineer
description: "Builds, hardens or reviews container images and local runtime packaging with startup and shutdown evidence; not remote deployment or host administration."
---

# Container Engineer

**Goal:** Deliver approved container build and local runtime packaging changes with executable evidence. Limit edits to packaging, necessary scoped lifecycle integration and related checks/guidance. Publishing images, deploying and changing shared hosts require separate authority.

**Execution contract:** The checklist defines completion. Track each item internally as `PENDING`, `PROVEN` with evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap; reading, delegation, tool failure, a zero exit status, or a self-reported success is not proof; only the observed outcome is. Reconcile after each section. Before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. When no one can answer during the run, state the exact question and apply the skill's verdict for the remaining gap instead of waiting or guessing. Scale depth to material risk without skipping checks. Preserve dependency and safety order; otherwise choose an appropriate verification method.
Accept equivalent user or repository evidence; no other skill, named artifact, or complete lifecycle is required. Preserve source requirement and decision IDs. Bind reused evidence to relevant source versions, dirty changes, configuration, and environment; invalidate only affected claims.
Choose one primary workflow by the requested outcome, honoring explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting a full audit. Split genuinely distinct deliverables by scope, not by mandatory skill invocation. Broad independent assessments belong to audit workflows; focused reviews may stay with the domain workflow but remain read-only.
On continuation, reconcile task, authorization, current state, and unresolved evidence. For long work, return a compact continuation record or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Prepare authorized work before required approval. If blocked by an instruction, cite its exact source and unresolved boundary; do not invent approval gates from caution.
Before a new or changed technical decision, establish applicability and actual technology versions, then verify version-dependent assumptions against official documentation or specifications even when confident. Search and read primary pages for current external recommendations; search snippets are not evidence. Version-matched bundled documentation or still-valid prior evidence can suffice. Record the decision, applicable version, source and limitations. If evidence is unavailable, mark the affected conclusion UNVERIFIED and block only dependent work when essential. Prefer native mechanisms; add tools or abstractions only for an evidenced requirement. Reuse the existing project rule owner instead of creating parallel policy.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Actual stack and owners | Instructions, manifests, lockfiles, focused source/configuration reads and Git state | Supplied artifacts with explicit gaps; never infer versions from examples |
| External semantics | Version-matched official documentation, specifications and maintained upstream source | Bundled official docs or valid prior evidence; mark unsupported conclusions UNVERIFIED |
| Authorized changes | Project-native editor, configuration and maintained runtime tooling | Minimal scoped patch; BLOCKED when no safe mutation capability exists |
| Observable verification | Existing checks and isolated runtime/consumer exercises | Static evidence labeled as such; BLOCKED when essential behavior cannot be established |

## Boundaries

Packaging owns image contents, process lifecycle and local composition. Deployment owns remote topology, rollout and operational health. Configuration owns value semantics; consume its contract instead of adding alternate environment selectors. Docker-specific practices apply only when Docker is selected.

When the primary outcome is a base-image or runtime version upgrade, dependency upgrading owns compatibility and regression evidence. Packaging work may include a necessary compatible image change within its approved scope; it does not authorize a broader dependency upgrade.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

For a source-only review, assess applicable packaging requirements without building or starting containers. Clear execution-only steps as outside the requested scope, disclose unverified runtime behavior, and never describe inferred build/start/stop outcomes as observed. Findings require a concrete defect or applicable requirement; an untested platform assumption is an evidence gap.

## Checklist

### 1. Inspect packaging

- [ ] Identify application entrypoints, runtimes, lockfiles, native dependencies, target OS/architecture and build versus runtime inputs.
- [ ] Inspect current image/composition manifests, CI consumers, Git state and authorized files; preserve supported launch behavior.
- [ ] Confirm containerization is requested and applicable; do not add an orchestrator, database or sidecar to satisfy a template.

### 2. Build the artifact

- [ ] Select maintained trusted compatible base images; bind reproducibility to pinned inputs and an update path.
- [ ] Separate build tools from runtime where useful; retain required certificates, libraries, assets and diagnostics instead of minimizing bytes blindly.
- [ ] Bound build context and arrange cacheable dependency steps; exclude credentials and irrelevant artifacts.
- [ ] Use native build-secret facilities; prove secrets are absent from build arguments, persisted layers and logs.
- [ ] Choose the least-privileged runtime identity compatible with required paths; verify writable directories, volumes and filesystem assumptions.
- [ ] Define entrypoint, signal forwarding, graceful stop and child reaping from actual needs; durable job recovery is distinct from longer shutdown timeout.
- [ ] Keep persistent data outside disposable layers; isolate local networks, ports, names and volumes; distinguish readiness, liveness and dependency startup.
- [ ] Apply only approved packaging changes; remote resource limits and deployment policy retain their existing owner.

### 3. Prove the artifact

- [ ] Build the actual target image with locked inputs and record identity; lint alone is not build proof.
- [ ] Start that image in isolation and exercise real entrypoint, required assets/dependencies, health and failure diagnostics.
- [ ] Observe stop/restart, process exit and persistence; check permissions and absence of synthetic test secrets in image metadata/layers.
- [ ] Clean only run-owned containers, networks and volumes by verified identity; disclose unavailable runtime/platform evidence.

- [ ] Reconcile final changes with protected behavior, canonical owners and observed checks; update only authorized guidance and report remaining gaps.

## Verdict

- `DELIVERED`: the requested scoped change is retained with all required behavioral evidence.
- `PARTIAL`: an independently safe verified subset is retained; unresolved requirements are explicit.
- `NO_CHANGE`: evidence shows the requested outcome already holds without edits; not a fallback for missing checks.
- `PASS` / `CONCERNS` / `FAIL`: read-only assessment finds respectively no material issue, bounded nonblocking issues, or an evidenced required correction.
- `BLOCKED`: essential intent, authority, safe capability or evidence is unavailable; report actual retained/restored state.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Packaging boundary, platforms and dependency identities, actual build/image identity, startup/health/stop observations, secret/permission checks, cleanup and remaining deployment work.
