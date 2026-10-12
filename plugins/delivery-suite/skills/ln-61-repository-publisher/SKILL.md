---
name: ln-61-repository-publisher
description: "Commits, pushes and remotely verifies authorized repository changes; does not create releases."
---

# Repository Publisher

**Goal:** Publish only changes the user has authorized, then verify the result from the remote source.

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
| Scope, staging, history, and synchronization | Native Git CLI | Stop if equivalent Git evidence is unavailable |
| Repository validation | Project-native commands and installed validators | Documented manual checks |
| Remote branch and CI state | Authenticated hosting CLI or connector | Git remote evidence plus direct workflow URLs |
| Clean-source verification | Temporary clone and isolated host configuration when distribution surfaces changed | Remote raw files plus `BLOCKED` for required install evidence |
| Static-site verification | Deployment workflow plus direct HTTP request | Hosting API deployment state |
| Current marketplace behavior | Official host documentation | Mark assumptions and avoid destructive retries |

Prefer compact Git output first, then open the full diff for files that will be staged. Never pipe commands in a way that hides the failing exit code.

Use hosting APIs for remote facts and Git for repository facts. Local distribution or deployment state cannot prove that a remote consumer update works.

## Checklist

### Establish scope and evidence

- [ ] Confirm the user explicitly requested a commit and push and identify the intended branch.
- [ ] Read repository instructions, release rules, and the current branch policy before mutation.
- [ ] Check `git status -sb`, staged and unstaged diffs, untracked files, remotes, and recent commit style.
- [ ] Identify unrelated user changes; do not stage them without explicit whole-worktree authorization.
- [ ] Inspect deletions and generated files as carefully as edited text.
- [ ] Check whether behavior, installation commands, catalogs, layout, or the public site require matching documentation updates.
- [ ] Do not change versions, tags, or release metadata during an ordinary publication unless the request or repository policy explicitly includes them.
- [ ] For marketplace edits, confirm every stable identifier is unchanged unless an intentional migration was approved.
- [ ] When multiple host catalogs exist and repository policy requires parity, confirm they contain the same distribution units in the required order.
- [ ] When metadata is duplicated across manifests or catalogs, confirm descriptions and source paths agree with the canonical source.

### Validation Routing

- [ ] Discover and run repository-native validation commands before generic checks.
- [ ] For changed skills, run repository-required or host-native skill validators, or perform their documented manual fallback.
- [ ] For changed plugins or packages, run repository-required validators, or perform their documented manual fallback.
- [ ] Run every host-native strict validator whose distribution surface exists and changed or is required by repository policy.
- [ ] Run only the catalog parity, manifest parsing, stale-reference, local-link, and whitespace checks required by the repository and affected surfaces.
- [ ] Run only relevant product tests; do not invent a heavyweight release gate absent from repository policy.
- [ ] Stop before commit on a confirmed failing required check unless the user explicitly accepts the failure.
- [ ] Record skipped checks with the exact missing dependency or environment.

### Synchronization and Commit

- [ ] Fetch the target remote and compare local HEAD with the remote branch before committing.
- [ ] If behind or diverged, inspect both sides and reconcile within the authorized branch workflow while preserving user changes; stop for unresolved semantic conflicts or a required history rewrite. Never force-push implicitly.
- [ ] Stage explicit paths when the worktree is mixed; use whole-worktree staging only when the user approved all changes.
- [ ] Review the cached diff and diffstat after staging; ensure required checks cover this exact tree, rerunning only checks invalidated by synchronization or subsequent edits.
- [ ] Exclude secrets, local caches, temporary artifacts, and unintended credentials from the staged set without deleting user-owned files; if an intended change contains a secret, block that publication and report redacted evidence.
- [ ] Match the repository's commit-message convention and summarize the entire staged change.
- [ ] Preserve configured commit signing and attribution policy; do not invent contributor identities or disable required signing.
- [ ] Create the commit and capture its full SHA.
- [ ] Push to the authorized branch without changing branch protections or using force.

### Remote Verification

- [ ] Verify remote publication refers to the exact checked source state and exclude unverified later changes; repository publication alone does not prove a release or deployment.
- [ ] Verify the published commit on the authorized remote through Git or the hosting API; use a second source only if identity or synchronization is uncertain.
- [ ] Track required CI for the pushed commit with bounded waits and direct run URLs. If execution cannot continue waiting, report pending state as `PARTIAL`; do not equate pending with success.
- [ ] If the static site changed, wait for deployment and verify live content with a cache-busting request.
- [ ] If installation or marketplace content changed, clone an authorized consumer-accessible remote into a clean temporary directory and validate the affected distribution surface.
- [ ] When install or update behavior changed, test at least one affected package or plugin from its documented distribution source in isolated host configuration.
- [ ] When stable distribution identifiers or versions exist, verify the installed artifact resolves under the expected identifier and version.
- [ ] Keep temporary host configuration isolated from the user's active settings and remove it safely afterward.
- [ ] Recheck local worktree and HEAD against the published commit. If the remote advanced concurrently, verify that it still contains the published commit and report both SHAs; do not overwrite newer work to restore equality.

### Safety Gates

- [ ] Never expose authentication tokens or credential values in output.
- [ ] Never create a release, tag, package publication, discussion, or pull request unless explicitly requested.
- [ ] Never delete remote branches or alter the default branch as a side effect.
- [ ] Return `BLOCKED` rather than bypassing branch protection, authentication, or required checks.

## Verdict

- `PUBLISHED` — commit, push, required CI, and applicable remote verification succeeded.
- `PARTIAL` — the push succeeded but a non-destructive remote check is pending or failed.
- `BLOCKED` — publication did not complete because authorization, synchronization, validation, or remote access failed.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Published/excluded paths, branch, full commit SHA, remote URL, validation results, CI/deployment URLs, and applicable clean-source install/update proof. For `PARTIAL`, state whether the pushed commit is safe to leave and the observable event that closes verification. Use `PUBLISHED` only when the remote commit and every applicable required workflow are observed.
