# Independent Review Panel

Use Six Thinking Hats as evidence lenses, not personalities. The Blue lead scopes the review, selects agents, verifies claims, resolves conflicts, and issues the verdict.

The subagent budget for one authoritative task and stable scope is at most two rounds: one scope-scaled initial review and, only when corrections or unresolved material evidence warrant it, one selective follow-up. Never start a third round; after the budget, Blue verifies directly and carries unresolved evidence into the verdict.
Before the initial round, Blue understands the exact change and risk map, then selects all and only lenses with a distinct evidence question likely to change the verdict. Use no subagent for trivial or fully evidenced work and one or a few for narrow risk. Never launch a lens to satisfy a quota or defer an obviously required lens to another round. Treat a review as initial when no completed prior report proves the reviewed base, head, scope, and panel, or when the authoritative task, scope, release boundary, or comparison lineage materially changed; ordinary correction commits remain follow-up.
For the single optional follow-up of the same task and scope, no hat or specialist is mandatory. Blue selects the smallest non-duplicative subset or none from the correction diff, unresolved findings, unproven evidence, and changed risks; never rerun the full panel or a lens only because it ran before. Apply the same risk-based freedom to non-code delivery and record `Independent review panel: None` when no lens adds value.

| Hat | Question |
|---|---|
| White — facts | What changed, which outcome and paths are affected, and what scoped evidence is missing? |
| Red — human response | What will surprise or mislead a user, developer, reviewer, or operator? Treat intuition as a hypothesis. |
| Black — caution | How can the change regress, corrupt state, breach trust, or fail at edges and partial failure? |
| Yellow — value | Which intended value, compatibility, and sound tradeoffs must be preserved; which concerns are false positives? |
| Green — surgical simplicity | Is this the smallest sufficient diff and simplest efficient algorithm for the evidenced need without sacrificing safety, clarity, testability, or operability? |

| Specialist | Trigger | Focus |
|---|---|---|
| Security and privacy | Trust boundaries, untrusted input, secrets, sensitive data, destructive action | Guards, isolation, recovery, and sensitive-data flow |
| Data and concurrency | Schemas, transactions, queues, caches, events, async work, locks | Atomicity, races, ordering, duplicates, wiring, and orphan channels |
| API and compatibility | Public interfaces, protocols, serialization, configuration, mixed versions | Producers, consumers, removals, and supported compatibility |
| Architecture and migration | Approved design, replacement, refactor, cutover, or deprecation | Plan traceability, owning boundary, root-cause resolution, target completeness, old paths, and unmigrated callers |
| Tests and oracles | Changed tests, test strategy, or material behavior needing oracle review | Material business risks, trustworthy oracles, risk-appropriate coverage, and removal or consolidation of low-value tests |
| Performance and reliability | Hot paths, I/O, retries, timeouts, load, resource ownership | Amplification, measurement, leaks, storms, and degradation |
| UI and accessibility | A user-facing surface is changed or causally reached, even when UX change is not requested | Existing-experience preservation, stable selectors, keyboard, focus, names, motion, copy, and rendered behavior |
| Operations and release | Deployment, configuration, observability, rollback, recovery | Safe rollout, useful signals, and recovery steps |

Every specialist is optional in both rounds. Select only the smallest set justified by impact, likelihood, rollback difficulty, and missing evidence; avoid duplicate questions and record selection, omission, or merge reasons.

Give each subagent the same frozen packet: authoritative task, required plan items, business thesis, acceptance criteria, user-experience baseline and authorized changes, maturity evidence, base and head, changed/supporting/excluded scope, non-goals, approved approach, repository instructions, risk class, and allowed commands. Add exactly one lens, read-only and scope boundaries, and the result schema. Do not include provisional or sibling findings.

Run each round in parallel or bounded blind batches within host limits; batches remain one analytical round and never receive sibling outputs. Allow read, search, code intelligence, official-source research, and non-mutating verification; forbid tracked edits, commits, pushes, deployments, external writes, and nested subagents. Retry a technically failed selected lens once only when a concrete cause changes, within the same round and question. Wait for all selected lenses and resolve material conflicts through direct evidence; never add a verifier round.

Each subagent returns coverage, candidate findings with change-causal evidence and smallest correction, rejected hypotheses that resolve material ambiguity, and open questions. `No findings` is valid; never manufacture comments to justify a lens.
