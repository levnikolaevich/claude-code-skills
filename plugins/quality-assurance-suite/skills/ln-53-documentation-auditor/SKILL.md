---
name: ln-53-documentation-auditor
description: "Audits documentation and comments for trust, coverage, consistency and freshness; read-only."
---

# Documentation Auditor

**Goal:** Audit documentation as a read-only evidence system: can a new contributor, operator, user, or coding agent find the right source, trust its claims, and act without hidden context? Review both standalone documents and code comments where they carry public or operational knowledge.

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

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Document inventory and hierarchy | Native file listing with narrow patterns | Establishing documentation surfaces, generated areas, and navigation structure | Repository tree and known entry documents |
| Links, repeated terms, claims, and contradictions | Native text search, then focused reads | Finding references, stale names, duplicated guidance, paths, commands, and configuration keys | Manual cross-document comparison |
| Code and configuration truth | Native code search, manifests, schemas, and direct file reads | A document claims that a path, option, endpoint, behavior, or default exists | Execute a safe inspection command when text is insufficient |
| Freshness and ownership | Git log, blame, and diff | Determining when a claim changed, whether a document tracks active code, or who owns a convention | Current code and explicit ownership files |
| Commands and examples | Shell in non-mutating or dry-run mode | Verifying help text, command existence, config parsing, generated output, or example syntax | Inspect command registration and tests; mark runtime proof unavailable |
| External facts | Official documentation, specifications, and release notes | A current external API, version, standard, or platform behavior affects correctness | Primary-source web research; otherwise mark `UNVERIFIED` |

Do not run commands that publish, migrate, deploy, write production state, or rewrite documentation. Generated caches are acceptable only when permitted and disclosed.

## Workflow Boundary

This workflow assesses documentation trust without editing. Project-rule creation is artifact authoring, and skill behavioral review is a different outcome. Report conflicting owners with evidence instead of creating a new normative registry.

## Evidence Rules

| Claim type | Required evidence |
|---|---|
| Repository path, symbol, command, configuration, endpoint, or default | Current repository or safe command output |
| External API, version, standard, or compatibility statement | Official source matching the relevant version |
| Count or coverage statement | Reproducible query with scope and exclusions |
| Historical rationale | Current decision record or history that still matches implementation |
| Recommendation | A demonstrated reader failure, contradiction, maintenance cost, or operational risk |

Absence of documentation is a finding only when a real audience needs the missing knowledge. Judge stale and missing guidance by the reader failure or harm they cause.

Treat personal preferences, project policy, skill procedures and executable settings as distinct owners. Historical memory and copied examples are context, not authority over current accepted rules.

## Checklist

### 1. Establish Scope and Audiences

- [ ] Identify documentation entrypoints, public docs, maintainer docs, operational runbooks, generated references, examples, and code-comment surfaces in scope.
- [ ] Identify intended audiences and their concrete tasks: understand, install, configure, operate, troubleshoot, extend, or verify the system.
- [ ] Read applicable repository instructions and detect documentation ownership, generation commands, language policy, and source-of-truth conventions.
- [ ] Separate authored documents from generated, vendored, archived, temporary, and example content before scoring defects.
- [ ] Classify each target as entrypoint/index, reference, how-to, explanation, decision record, generated output, or example; prioritize canonical and claim-dense documents before navigation-only files.
- [ ] Define which code, configuration, schemas, tests, and external contracts can verify documentation claims.
- [ ] Keep the audit read-only and record any unavailable source, command, or environment as a limitation.

### 2. Check Structure and Discoverability

- [ ] Verify that the root entry document explains purpose, supported use, prerequisites, installation path, and navigation appropriate to its audience.
- [ ] Check hierarchy, headings, table of contents, local navigation, cross-links, anchors, and predictable placement of related material.
- [ ] Verify local paths and anchors, including case sensitivity, and inspect external redirects for a wrong or unavailable destination; a working intentional redirect is not a defect.
- [ ] Identify orphan documents, duplicate entrypoints, circular navigation, deep chains, and important content reachable only by repository search.
- [ ] Check that concepts have one canonical owner and that secondary documents link rather than fork rules, thresholds, or procedures.
- [ ] Verify that generated documentation names its generator and does not invite hand editing that will be overwritten.
- [ ] Check whether large documents can be split or compressed without hiding the sequence or context needed to act safely.

### 3. Check Relevance, Coverage, and Consistency

- [ ] Compare each document's title, scope statement, and intended audience with its actual content.
- [ ] Judge content by document kind: indexes route without duplicating detail, references optimize exact lookup, how-to guides are safely sequenced, explanations build the right mental model, and decision records preserve context, decision, alternatives, and consequences.
- [ ] Flag filler, repeated summaries, speculative narration, generic generated prose, and ceremonial sections that do not help the intended audience decide or act.
- [ ] Prefer durable intent, contracts, constraints, and operations over copied implementation or business logic; retain only minimal verified code or command examples needed to act safely.
- [ ] Identify off-topic content, scope creep, unexplained prerequisites, hidden assumptions, and sections that no longer support an active task.
- [ ] Check coverage of public behavior, configuration, deployment, migrations, failure recovery, security-sensitive operation, and extension points where applicable.
- [ ] Trace requirements and architecture statements across documents; report contradictions and ambiguous ownership rather than choosing silently.
- [ ] Find obsolete future-tense plans, completed TODOs, removed features, legacy compatibility guidance, old directory layouts, and stale screenshots or examples.
- [ ] Check terminology, entity names, identifiers, capitalization, and lifecycle states for consistency with code and across documents.
- [ ] Verify that warnings, prerequisites, destructive actions, rollback steps, and failure outcomes appear at the point where readers need them.
- [ ] In always-loaded agent instructions, identify redundant formatting prose already enforced by tooling and path-specific detail that can move to supported scoped files. Preserve discovery, non-obvious requirements, and host compatibility.

### 4. Verify Facts and Examples

- [ ] Extract material claims about paths, files, symbols, versions, counts, commands, flags, environment variables, configuration keys, ports, endpoints, schemas, and defaults.
- [ ] Build a normalized claim ledger before verification and group repeated claims by subject so one repository check can expose both stale copies and cross-document contradictions.
- [ ] Verify each claim against current repository evidence or a safe command; record the exact source and scope of the check.
- [ ] Resolve installed versions from manifests and lockfiles before consulting external documentation or claiming current support.
- [ ] Use official sources for external APIs, deprecations, security standards, platform limits, and compatibility statements.
- [ ] Execute examples only in a safe local or disposable context; otherwise inspect parsing, tests, and expected output and mark them statically verified.
- [ ] Check examples for missing imports, placeholders presented as real values, invalid paths, unsafe secrets, obsolete syntax, and output that no longer matches behavior.
- [ ] Interpret examples, templates, future plans, and external references in their declared context. Verify conditional guidance for supported prerequisites even when currently disabled; do not judge a hypothetical example as deployed behavior.
- [ ] Verify numeric counts with a reproducible query and documented exclusions; avoid preserving aggregate counts that will drift without automation.
- [ ] Recommend moving change-prone versions, paths, defaults, inventories, generated output, and status snapshots to authoritative code, configuration, or generated sources where practical; otherwise identify the source, scope, and owner or generation/update trigger needed to prevent silent staleness.
- [ ] Apply the research-to-action gate: external guidance becomes a finding only when it proves a concrete in-repository defect or risk.

### 5. Review Comments and Produce the Report

- [ ] Check comments and docstrings for useful rationale, invariants, contracts, side effects, failure behavior, and non-obvious constraints.
- [ ] For documented deliberate simplifications with material limits, verify supported bounds, an observable revisit trigger, and what to reconsider. Report missing bounds or triggers, exceeded limits, and overdue reviews with evidence and impact; require no special marker and do not label undocumented routine code as debt.
- [ ] Match docstrings for public or non-obvious interfaces against the current signature, parameters, return value, raised errors, side effects, nullability, and lifecycle obligations.
- [ ] Flag syntax narration, obsolete history, dead code, false promises, and information better expressed by names or types; preserve historical rationale that still explains a constraint or prevents a known regression.
- [ ] Check public interfaces for documentation required by the language or ecosystem and for examples that match the actual contract.
- [ ] Filter intentional audience simplification, framework convention, generated prose, and accepted legacy constraints before reporting.
- [ ] Classify every in-scope document or comment surface as `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE`; recommend deletion or consolidation only when canonical coverage preserves every required audience task and contract.
- [ ] Apply the materiality gate: require concrete reader error, blocked task, unsafe action, contradiction, or recurring maintenance cost at evidenced scale. Reject taste, theoretical purity, generic practice, hypothetical scale, and reasonable alternatives; require the outcome or constraint, not a preferred implementation.
- [ ] **External correction evidence:** Ground external corrections in version-matched official contracts, using primary engineering sources for unresolved tradeoffs. Cite the supported mechanism; local evidence suffices for local defects.
- [ ] For each accepted finding, identify the owning documentation surface, affected reader outcome, and evidence that a correction would restore trust; do not turn recommendations into authorized edits.
- [ ] Classify findings as `P0`-`P3` based on the harm caused by wrong action, inability to operate, maintenance drift, or minor friction.
- [ ] Use `BLOCKED` when a safety-critical claim, required audience journey, or authoritative source cannot be verified without a credible fallback; use `FAIL` when evidence proves unsafe guidance, an inoperable required journey, or an unresolved `P0/P1`; use `CONCERNS` only for material non-blocking trust gaps, and `PASS` only when required claims and journeys are verified with no material finding.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Documentation audiences and journeys; structure, coverage, accuracy, durability/SSOT, and comment trust. Record `KEEP / ADD / UPDATE / DELETE / MERGE` per in-scope surface. Findings need priority, document location, verifying evidence, affected audience, material impact, unacceptable tradeoff, and minimal correction or canonical owner; allow equivalent structures. Distinguish unverified claims from proven defects.
