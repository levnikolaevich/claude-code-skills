---
name: ln-91-engineering-baseline-builder
description: "Creates project technical rules and recurring local procedures from the actual stack; edits guidance only, not architecture targets or application code."
---

# Engineering Baseline Builder

**Goal:** Create or reconcile approved technical guidance and local procedures. Edit only authorized documentation, agent instructions and local skill artifacts. Audits remain read-only; never repair product code, tests, CI or infrastructure.

**Execution contract:** Track every checklist item as `PENDING`, `PROVEN` with observed outcome evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap. Reading, delegation, tool failure, zero exit status, and self-reported success are not proof. Reconcile after each section; before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, mode, and existing authorization. Complete authorized work before required external approval; ask only consequential unresolved choices. If nobody can answer, report the exact question and apply the skill's gap verdict without waiting or guessing. Cite any blocking instruction and unresolved boundary; never invent approval gates. Scale depth to material risk; preserve mandatory checks, dependencies, and safety order while choosing verification methods.
Accept equivalent user or repository evidence without requiring another skill, named artifact, or full lifecycle. Preserve source requirement and decision IDs. Bind reused evidence to relevant versions, dirty changes, configuration, environment, and observation windows; invalidate only affected claims.
Choose the primary workflow by outcome and explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting audits. Split distinct deliverables by scope, not mandatory skill invocation. Broad independent assessments use audit workflows; focused domain reviews remain read-only.
On continuation, reconcile task, authorization, state, and gaps. Return a compact continuation record for long work or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Before retrieval, define the evidence question; read selectively without skipping applicable instructions. Use tools for mechanical processing; summarize bounded results, errors, coverage, and source paths, keeping full output outside context.
Before technical decisions, establish applicability and actual versions; verify version-dependent assumptions against official documentation or specifications. Search and read primary pages for current external recommendations; snippets are not evidence. Version-matched bundled documentation or valid prior evidence suffices. Record decision, version, source, and limitations. Mark unavailable evidence UNVERIFIED; block only essential dependent work. Prefer native mechanisms, justify added tools or abstractions with evidence, and reuse the existing rule owner.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Actual stack and owners | Instructions, manifests, lockfiles, focused source/configuration reads and Git state | Supplied artifacts with explicit gaps; never infer versions from examples |
| External semantics | Version-matched official documentation, specifications and maintained upstream source | Bundled official docs or valid prior evidence; mark unsupported conclusions UNVERIFIED |
| Authorized changes | Project-native editor, configuration and maintained runtime tooling | Minimal scoped patch; BLOCKED when no safe mutation capability exists |
| Observable verification | Existing checks and isolated runtime/consumer exercises | Static evidence labeled as such; BLOCKED when essential behavior cannot be established |

## Boundaries

Architecture requirements own quality targets; architecture decisions own structural tradeoffs. This workflow translates those inputs into project technical guidance, not a second architecture baseline. Executable configuration owns exact values. Local procedures own steps, not copied policy. A readiness request does not authorize implementing every gap.

## Checklist

### 1. Establish applicability

- [ ] Inspect requested artifacts, Git state and existing instructions; preserve unrelated and interrupted work.
- [ ] Identify project type, runtimes/versions, deployment topology, trust boundaries and operational constraints from executable sources.
- [ ] Assess containers, configuration, authentication, authorization, errors, observability, mutation recovery and database lifecycle separately; record applicability and evidence for exclusions.
- [ ] Read existing requirements and contracts; distinguish accepted current behavior, desired changes and unverified historical claims.
- [ ] Locate each normative rule owner and executable owner of mutable values; resolve material conflicts without replacing business intent.

### 2. Build project guidance

- [ ] Map applicable principles to native stack mechanisms and version-matched evidence; record accepted exceptions and revisit triggers.
- [ ] Reuse existing documents; create an owner only when none exists. Link architecture targets and functional grants instead of copying them.
- [ ] Keep always-loaded instructions limited to constraints and conditional routing. Use supported host imports or references to one canonical body; verify actual resolution in each targeted host.
- [ ] Create a local skill only for an evidenced recurring procedure. Derive commands from the project; include inputs, target identity, side effects, verification, recovery and continuation.
- [ ] Keep local procedures independently usable without this plugin or another skill; do not duplicate the specialist catalog or invent a mandatory state directory.
- [ ] For mechanically enforceable invariants, identify an existing check or exact missing verification; implementing product/CI checks is outside this artifact-only scope.

### 3. Verify ownership and usability

- [ ] Check links, commands, configuration references and instruction precedence against actual owners; exclude secrets and volatile inventories.
- [ ] Trace representative future tasks through routing and procedures. Verify prerequisites and stop conditions without unauthorized operations.
- [ ] Ensure repeated application updates the same owners without duplicates; report implementation gaps separately from artifact readiness.

- [ ] Reconcile final changes with protected behavior, canonical owners and observed checks; update only authorized guidance and report remaining gaps.

## Verdict

- `READY`: requested guidance is usable, canonical and verified against its sources; this does not assert implementation readiness.
- `INCOMPLETE`: useful guidance exists but consequential contract gaps remain.
- `PASS` / `CONCERNS` / `FAIL`: a read-only guidance assessment finds respectively no material issue, bounded gaps, or an evidenced required correction.
- `BLOCKED`: scope, authority, ownership or essential evidence prevents a usable artifact.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Applicable principles, stack evidence, canonical document/executable owners, changed artifacts, routing/local procedure decisions, source/version mapping, exclusions and unresolved implementation work.
