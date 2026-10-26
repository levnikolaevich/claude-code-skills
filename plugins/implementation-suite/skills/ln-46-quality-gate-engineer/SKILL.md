---
name: ln-46-quality-gate-engineer
description: "Configures and verifies lint, type, architecture and other engineering checks; not product cleanup, policy invention or deployment redesign."
---

# Quality Gate Engineer

**Goal:** Deliver approved executable engineering checks with proven coverage and failure behavior. Change only authorized analyzer configuration, dev tooling, check scripts, rule fixtures and existing invocation points; distinguish effective checks from a compliant product.

**Execution contract:** Track every checklist item as `PENDING`, `PROVEN` with observed outcome evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap. Reading, delegation, tool failure, zero exit status, and self-reported success are not proof. Reconcile after each section; before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, mode, and existing authorization. Complete authorized work before required external approval; ask only consequential unresolved choices. If nobody can answer, report the exact question and apply the skill's gap verdict without waiting or guessing. Cite any blocking instruction and unresolved boundary; never invent approval gates. Scale depth to material risk; preserve mandatory checks, dependencies, and safety order while choosing verification methods.
Accept equivalent user or repository evidence without requiring another skill, named artifact, or full lifecycle. Preserve source requirement and decision IDs. Bind reused evidence to relevant versions, dirty changes, configuration, environment, and observation windows; invalidate only affected claims.
Choose the primary workflow by outcome and explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting audits. Split distinct deliverables by scope, not mandatory skill invocation. Broad independent assessments use audit workflows; focused domain reviews remain read-only.
On continuation, reconcile task, authorization, state, and gaps. Return a compact continuation record for long work or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Trace applicable requirements to their authoritative owner, planned or implemented change, acceptance evidence and status in the existing artifact or response; no new registry is required. Explicit constraints remain binding until an authorized deviation; risk determines priority, not permission to ignore them.
Investigate the causal flow beyond initially named files. Within implementation authority, include structural repair needed for the outcome; minimize total complexity and risk, not changed lines. This does not authorize unrelated cleanup or mutation during review.
Before retrieval, define the evidence question; read selectively without skipping applicable instructions. Use tools for mechanical processing; summarize bounded results, errors, coverage, and source paths, keeping full output outside context.
Before technical decisions, establish applicability and actual versions; verify version-dependent assumptions against official documentation or specifications. Search and read primary pages for current external recommendations; snippets are not evidence. Version-matched bundled documentation or valid prior evidence suffices. Record decision, version, source, and limitations. Mark unavailable evidence UNVERIFIED; block only essential dependent work. Prefer native mechanisms, justify added tools or abstractions with evidence, and reuse the existing rule owner.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Policy and scope | User intent, repository instructions, accepted standards/ADRs and Git state | Name missing consequential policy; do not invent thresholds |
| Coverage and configuration | Tracked-file inventory, manifests, effective analyzer configuration and check entrypoints | Direct file/configuration inspection with explicit gaps |
| Version-specific rule semantics | Installed/resolved versions and official version-matched documentation | Valid bundled docs; block dependent choices if evidence is essential |
| Implementation | Existing analyzer extensions, native config, package manager and portable launchers | Small owned script only when no suitable rule exists |
| Verification | Real check commands plus isolated allowed/forbidden fixtures | Static evidence cannot prove enforcement; report missing execution |

## Boundaries

Accepted project standards own policy; technical guidance records it and this workflow implements approved enforcement. Application configuration owns runtime values. A feature/fix may maintain incidental checks without invoking this workflow. Standalone dependency upgrades retain their own outcome; necessary compatible dev dependencies may be included here.

Connect checks to existing local/CI entrypoints only within scope. Do not change delivery topology, triggers, credentials, permissions, environments, artifact publication or rollout. Do not install global hooks or publish anything without that authority; shipped skills do not require hook code.

Review/explanation requests are read-only. Setting up checks does not authorize product cleanup, mass formatting, changing public types or suppressing existing defects. Preserve required strictness and warning policy; propose justified exceptions for approval instead of weakening gates for a green result.

In read-only mode, clear implementation steps as inapplicable. Assess the remaining checks from existing evidence or permitted non-mutating diagnostics; do not create fixtures or edit configuration. Report missing execution evidence without claiming enforcement is proven.

## Checklist

### 1. Establish Policy and Coverage

- [ ] Resolve whether the outcome is check setup, read-only review or a fully passing project; identify authorized files and protected user changes.
- [ ] Inventory relevant languages and tracked code, styles, docs, workflows, container files and scripts; distinguish generated/vendor files and justified exclusions.
- [ ] Read accepted rules for types, complexity, dependency direction, cycles, dead files/exports/dependencies/styles/translation keys, API ownership and asynchronous code; classify applicability separately from availability.
- [ ] Inspect actual tool versions, effective presets, rule overrides, warning behavior, entrypoints and supported operating systems; detect checks that select no relevant files.
- [ ] **Engineering enforcement:** Map applicable technical rules to executable checks, covered technologies/files, strictness and documented exceptions. Identify missing or ineffective checks and their implementation owner; preserve mandated presets and warning policy. Bind evidence to the actual command and supported environment, not configuration presence. Read-only workflows report gaps without repairing them; guidance-only workflows describe controls without executing or implementing them.

### 2. Design the Smallest Enforceable Control

- [ ] For each mapped obligation, identify the owning configuration, exact input set and positive/negative oracle; reuse the project command surface.
- [ ] For a disputed control, distinguish the required property from its proxy and supporting machinery. If the proxy rejects valid work, correct the check rather than add isolation or tracking solely to sustain an unnecessary condition.
- [ ] Choose supported version-matched presets that meet policy; when policy is unspecified, explain fit rather than enabling every rule. Document exceptions, scope and revisit triggers without silently relaxing mandatory settings.
- [ ] Prefer native rules/plugins; use a custom rule or small script only for a concrete gap, with useful diagnostics and remediation guidance.
- [ ] Keep performance-sensitive constraints tied to measured runtime behavior; static patterns do not prove speed, and complexity limits must not force unmeasured hot-path regressions.
- [ ] Define target command coverage, exit propagation, configuration discovery, path/encoding handling and supported OS behavior; preserve byte-sensitive files and project EOL policy.

### 3. Implement Within the Tooling Boundary

- [ ] Use existing configuration and dependency workflows; update owned config, lockfiles and required check documentation together without parallel rule registries.
- [ ] Make warnings, suppressed rules, excludes and baselines visible; do not hide product defects with casts, ignore expansion, weaker thresholds or always-success wrappers.
- [ ] Scope local hooks to intended staged inputs and final gates to required project inputs; neither local leftovers nor generated directories may hide tracked violations.
- [ ] Preserve existing CI permissions and delivery behavior when wiring a command; keep checks effective without optional hooks or a particular editor.
- [ ] Keep any product fixes outside this task unless separately authorized; report the actual violations with their owning scope.

### 4. Prove Enforcement and Report Product State

- [ ] Run representative allowed and forbidden fixtures through the real entrypoint in isolation; prove diagnostics, nonzero rejection and successful valid input without modifying product behavior.
- [ ] Where false rejection is plausible, exercise a realistic permitted boundary case, such as an unrelated concurrent change, using evidence valid for the relevant inputs.
- [ ] Exercise relevant selection boundaries, configuration discovery and command failure propagation; a direct tool pass does not prove the wrapper runs it.
- [ ] Run the intended project checks on the final configuration in each required available environment; report unavailable OS/tool evidence without claiming portability.
- [ ] Record check implementation status separately from project compliance, including existing violations, ignored/skipped scope and unverified gates.
- [ ] Inspect the diff and clean only owned fixtures; preserve required rules, user work and delivery authority.

## Verdict

- `DELIVERED`: the agreed tooling outcome is retained and enforcement is proven. A setup-only request may expose existing product violations, which must be reported as noncompliant; this is not delivery readiness. If the request requires a passing project, all required project gates must also pass.
- `PARTIAL`: a safe verified subset is retained, but requested enforcement or required project compliance remains unfinished.
- `BLOCKED`: essential policy, execution evidence or safe scope is unavailable and no useful verified subset can be completed.
- `PASS` / `CONCERNS` / `FAIL`: read-only review respectively finds no required gap, bounded uncertainty, or a proven required enforcement defect; none authorizes repair.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Policy source -> control owner -> covered inputs -> command -> positive/negative outcome. Include versions/presets, exceptions, changed files, supported-environment evidence, tooling status and separate project compliance, unresolved violations and cleanup. Never equate a configured file, an installed tool or a green subset with complete enforcement.
