---
name: ln-61-skill-reviewer
description: "Reviews standalone skills and their configured distribution surfaces before publication. Use for skill release readiness; not for product code or implementation-plan review."
---

# Skill Reviewer

Review skill changes without modifying the repository or external state.

## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Repository scope and evidence | Native file search, focused reads, and Git diff | Equivalent read-only shell commands |
| Frontmatter and skill structure | Repository-defined or host-native skill validator | Manual YAML, path, naming, and repository-contract checks |
| Plugin integration | Repository-defined plugin validator plus manifest parsing | Manual manifest and applicable catalog comparison |
| Host discovery | Host-native validator for every configured distribution surface | Manual catalog, manifest, and source-path inspection |
| Current host rules | Official host documentation | Mark the claim `UNVERIFIED` when unavailable |
| Behavioral independence | Fresh subagent or clean context | Separate self-review passes with reduced-confidence disclosure |

Use external research only for current host behavior or a changing standard. Do not use web sources to override the repository's actual files, installed versions, or local validation output.

Tool absence is not itself a skill defect. Apply the documented fallback and use `BLOCKED` only when the missing capability prevents a reliable verdict.

## Checklist

- [ ] Establish the review target from explicit paths, the Git diff, staged files, and untracked files.
- [ ] Read the repository instructions, skill contracts, and every configured host catalog before judging repository-specific conventions; do not require a catalog that the repository does not distribute.
- [ ] Separate primary skills from manifests, catalogs, and documentation affected by the same change.
- [ ] Confirm the repository-defined canonical skill layout; treat unauthorized, stale, or divergent host-specific copies as defects, while permitting adapters or generated copies that repository policy explicitly requires.
- [ ] Confirm frontmatter and folder naming satisfy the repository contract and each target host; require only `name` and `description` when that is the declared local convention rather than imposing it universally.
- [ ] Check that each description states the capability, positive trigger, and important near-negative boundary.
- [ ] Check that descriptions stay within the host limit and avoid claims broader than the workflow supports.
- [ ] Confirm each skill is standalone: no required skill, MCP server, tracker, coordinator, worker, or shared runtime.
- [ ] Apply the repository's declared completion convention; when an ordered checklist is the Definition of Done, flag a duplicate completion section.
- [ ] Preserve non-obvious domain rules, tool-routing decisions, safety gates, evidence requirements, verdict mapping, output contract, and residual risks.
- [ ] Flag explanations a capable current model already knows unless they prevent a demonstrated execution failure.
- [ ] Verify every required capability has an available tool path, a credible fallback, or an explicit `BLOCKED` outcome.
- [ ] Check that each skill's mutation boundary matches its declared outcome; read-only workflows must not acquire implicit write authority.
- [ ] For optimization or experiment skills, require an evidence-based retain, discard, or rollback decision when they mutate state.
- [ ] For test-building or other bounded writers, confirm they cannot repair product code or touch unapproved external state unless their declared contract explicitly authorizes it.
- [ ] Trace the workflow through missing tools, insufficient context, dirty Git state, failed commands, and conflicting evidence.
- [ ] Check that the output contract distinguishes facts, inferences, missing evidence, verdict, and residual risk.
- [ ] Inspect neighboring descriptions for trigger overlap without assuming the skills know about one another.

## Repository Validation

- [ ] Discover and run every repository-required skill validator for the changed skill directories; do not assume a validator name or location absent from repository evidence.
- [ ] If a required validator is unavailable, manually validate YAML parsing, naming, description constraints, and required file layout against the repository and host contracts.
- [ ] Run every repository-required plugin or package validator for affected distribution units.
- [ ] Run each host-native strict validator when its corresponding catalog or manifest exists.
- [ ] Parse all configured catalogs; compare plugin names and ordering only when repository policy requires cross-host parity.
- [ ] Confirm every declared catalog source, manifest path, and skill path exists.
- [ ] Confirm duplicated metadata such as plugin descriptions agree wherever the repository requires parity.
- [ ] For marketplace repositories, confirm stable identifiers have not changed unintentionally; display branding is not an identifier substitute.
- [ ] Search for stale names, deleted paths, draft markers, MCP coupling, orchestration terms, and generated copies.
- [ ] Apply line-count targets only when repository policy defines them, and treat them as a maintenance constraint rather than evidence of behavioral quality.

## Behavioral Review

- [ ] Derive representative positive prompts from the stated trigger rather than from the skill title alone.
- [ ] Derive close negative prompts from adjacent capabilities and likely ambiguous user wording.
- [ ] Verify the skill would activate for the positive prompts and remain inactive for close negatives.
- [ ] Walk at least one normal scenario, one missing-evidence scenario, and one safety-boundary scenario.
- [ ] For complex or high-risk changes, use fresh independent contexts when available and provide only the skill plus raw task artifacts.
- [ ] Do not reveal expected findings, intended fixes, or prior conclusions to an independent evaluator.
- [ ] Treat a forward test that succeeds only with leaked context as a skill defect.
- [ ] Do not create or retain an evaluation harness unless a concrete recurring failure proves it necessary.

## Evidence Rules

- [ ] Cite each finding to an exact file and the smallest useful line or section.
- [ ] Distinguish validator failures from manual concerns and speculative improvements.
- [ ] Reproduce critical failures before assigning a blocking severity.
- [ ] Do not report a preference as a correctness defect.
- [ ] Record commands executed, exit status, and material output without exposing secrets.
- [ ] Report coverage gaps when a required host or clean-context test cannot be run.

## Verdict

- `PASS` — structural, behavioral, and integration checks pass with no material concern.
- `PASS WITH CONCERNS` — publishable, but bounded non-blocking uncertainty remains.
- `FAIL` — a confirmed defect can cause wrong triggering, unsafe behavior, broken installation, or an invalid contract.
- `BLOCKED` — required evidence or tooling is unavailable and no credible fallback exists.

## Output Contract

Before returning, account for every checkbox: mark it complete only when its action and required evidence are complete; `N/A`, skipped, unavailable, or delegated items remain incomplete and must be explained. Apply the skill's existing verdict, decision, and approval rules to every incomplete item.
Prepend this accounting header to every skill-specific report template: **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

Return:

1. Scope and changed surfaces.
2. Validator and behavioral evidence.
3. Findings ordered by severity, each with location, impact, evidence, and minimal correction.
4. Trigger boundary assessment.
5. Marketplace and host parity assessment.
6. Verdict.
7. Residual risks and checks not run.

Do not edit files, stage changes, publish packages, update marketplaces, or create GitHub state while reviewing.

Any diagnostic artifact must be temporary, outside canonical plugin directories, and disclosed in the residual-risk section.
