# Changelog

<!-- SCOPE: User-facing changes only. Max 5 bullets per entry. Focus: new capabilities, workflow changes, breaking changes. -->

## 2026-04-21

- **hex-line v1.17→v1.27** — PROTOCOL.md Response grammar (action-line + section/entry/detail prefixes), prose-noise cleanup (-37% output bytes), boundary-echo auto-strip preserves structural `}`/`)`/`]`/`});` delimiters, post-edit lexical brace-balance advisory, `range_checksum` on `replace_between`, new `warnings` field on `edit_file`
- **hex-graph v0.13.0→v0.15.0** — text-only MCP protocol (`content[0].text` grammar; `structuredContent`/`outputSchema` retired), expansion pointers carry canonical selectors (`symbol_id > workspace_qualified_name > qualified_name > name+file`), new `#quality` section exposing family/support tier/languages, 102/102 semantic tests
- **hex-ssh v1.4.2→v1.6.0** — per-tool timeout field scoping (exec-path tools expose `execTimeoutMs`, transfer tools expose `transferTimeoutMs`), per-call timeout overrides for connect/keepalive/exec/transfer
- **Response grammar migration** — hex-line graph-enrich output drops emoji prose (`⚠ Semantic impact:` → `#semantic_impact`, indented facts → `.` prefix, `⚠ N clone(s):` → `!clone_siblings count=N list=...`); MCP output families documented (structured vs text-grammar) in MCP_OUTPUT_CONTRACT_GUIDE and MCP_TOOL_DESIGN_GUIDE
- **Docs & CI** — five Claude hook events documented, plan-mode enforcement for mutating MCP tools, Monitor pattern docs, AGENTS docs unified with MCP result envelope, CI test suite repaired (hash collision test, 11 missing suites, deleted-runtime cleanup), Windows temp-path hint in coordinator CLI errors

## 2026-04-14

- **Gemini dropped from advisor role** — Codex is now the sole external parallel-advisor for skill_groups 200/300/310/510. Fallback is Opus self-review. Gemini CLI remains a first-class install/sync target (installer, syncer, `GEMINI.md`), just not an advisor. Cleanup across `agent_registry.json`, `agent_runner.mjs`, and the shared agent delegation/review/memory references.

## 2026-04-10

- **hex-line v1.12→v1.16** — progressive disclosure read (`edit_ready`/`verbosity`), line-ending preservation (LF/CRLF/CR), `allow_external` scope boundary, graph staleness auto-refresh, summary-first grep
- **hex-graph v0.8→v0.12** — summary-first output with `available_expansions`/provenance, expanded use-case API, SCIP module fix, 92/92 semantic tests
- **Artifact-first coordinators** — coordinators advance only from machine-readable artifacts; workers keep persisted runtime state and emit JSON summaries; new runtime contracts across all coordinator families
- **Planning runtime overhaul** — new/updated contracts for scope decomposition, epic/story/task planning, dependency and worker runtimes with coordinator summary contract and guard tests
- **Skill updates** — ln-200, ln-201, ln-210–ln-310, ln-840 refreshed with runtime alignment

## 2026-04-05

- **hex-line v1.12.0** — conservative conflict recovery (retry_edit/retry_edits/retry_plan), hook policy extraction, canonical output contracts for verify/changes
- **hex-graph v0.8.0** — output contract alignment (pruneEmpty, STATUS/ACTION constants, error mapping, DB busy handling), refactored platform and use-case API
- **hex-ssh v1.4.0** — remotePlatform parameter (auto/posix/windows), requirePosixRemotePath validation, transfer improvements
- **GitHub Actions Node.js 24** — upgraded checkout@v6, setup-node@v6, deploy-pages@v5
- **MCP Registry fix** — shortened tool descriptions to ≤100 chars for hex-line and hex-graph

## 2026-04-01

- **hex-line v1.10.0** — tool descriptions refresh, graph-enrich refactor, hook safeExit, edit/read improvements
- **hex-graph v0.6.0** — new flow.mjs dataflow module with find_dataflows source/sink API, store expansion
- **CI fixes** — guards.mjs split path fix, hex-ssh sftp test isolation, hex-graph cross-platform workspace discovery, better-sqlite3 native binary rebuild on CI

## 2026-03-31

- **Gemini auto-model selection** — removed hardcoded `-m gemini-3-flash-preview` from agent registry; Gemini CLI now auto-selects best available model. ln-011 post-install disables Conseca safety checker
- **hex-line search output cap** — block-aware 80K char limit prevents CC truncation on large search results; emits `OUTPUT_CAPPED` diagnostic with narrowing guidance
- **Agent review suggestion schema v2** — added `file`, `line_start`, `line_end`, `recommended_action` fields to all review schemas and prompt templates; relaxed read-only constraint to allow trivial fixes
- **model: claude-sonnet-4-6 in skills** — 32 SKILL.md files now declare explicit model; skills run on Sonnet 4.6 by default instead of inheriting parent model
- **hex-line hook safeExit + path filter** — writeSync-based flush before exit prevents output loss; path filter simplified to project-dir check (drops complex settings.json allowlist)

## 2026-03-30

- **hex-graph workspace-aware API** — tool parameters updated with explicit `path`, canonical selector rules, precision controls (`min_confidence`), and expanded language coverage (Python, C#, PHP with optional precise overlay)
- **hex-ssh file transfer and interop** — new `transfer.mjs` module, interop test fixtures, and expanded SSH server capabilities
- **State machine guards audit** — guards.mjs and store.mjs hardened across 12 runtimes with final_result/resumablePhases enforcement; new guard coverage tests for all runtime families
- **CI workflow** — added `.github/workflows/test.yml` for automated testing
- **review-skills R9 false positive fix** — auditor count check no longer triggers when site correctly omits volatile numbers

## 2026-03-29

- **ln-310 quality-based refinement** — Codex iterative loop now exits by quality (MEDIUM/HIGH findings drive continuation), not just iteration count; added Architecture Gate, patience requirements, and risk mitigation criterion
- **Process cleanup enforcement** — mandatory `--verify-dead {pid}` after every Codex call in ln-310, ln-510, ln-813; runtime guard blocks self-check pass without process verification
- **Exit reason enum canonicalized** — CONVERGED/CONVERGED_LOW_IMPACT/MAX_ITER/ERROR/SKIPPED unified across workflow, runtime contract, status catalog, and smoke tests
- **Perspective-based refinement** — 5 iterations now use different review angles (Generic, Dry-Run, New Dev, Adversarial, Final Sweep) instead of repeating the same criteria; exits on 2 consecutive APPROVED
- **Guard integration tests** — new `guards.mjs` test validates all machine-enforced state transitions (exit_reason, processes_verified_dead)

## 2026-03-28

- **ln-015-hex-line-uninstaller** — standalone skill to remove hex-line hooks, output style, and settings from the system
- **hex-line auto-sync** — `setup_hooks` tool removed; hooks and output style now auto-sync on MCP server startup via content comparison

## 2026-03-27
- **Marketplace install docs** — updated README, plugin docs, and GitHub Pages site to use the current Claude Code marketplace flow (`/plugin marketplace add` + `/plugin install plugin@marketplace`) instead of deprecated `/plugin add`
- **Audit runtime unification** — 6XX coordinators and workers migrated to run-scoped artifacts, evaluation runtime CLIs, and JSON summary contract with `summaryArtifactPath`
- **Runtime status catalog** — canonical status sets codified across active runtime contracts (story-gate, optimization, evaluation, environment)
- **Worker independence cleanup** — removed 36 coordinator-aware DoD references, fixed 3 false positives in review-skills checks (R12/R13/R16)

## 2026-03-26
- **State platform runtime** — shared coordinator runtime now enforces manifest, state, checkpoints, history, active-pointer, and status schemas across stateful skill families
- **Planning and environment migration** — ln-010, ln-220, and ln-300 now run on identifier-scoped runtimes with pause/resume, replay, and standalone worker summaries
- **Coordinator family alignment** — ln-310, ln-400, ln-500, ln-810, and ln-1000 now follow the same run-scoped runtime discipline and normalized CLI/status contracts
- **Review and contract hardening** — ln-162 and `review-skills` now catch standalone-worker drift, reverse coupling, and non-run-scoped runtime artifacts
- **Docs and skill compression** — planning, environment, and pipeline skills/docs were rewritten into shorter runtime-first contracts with updated public docs and site pages

## 2026-03-25
- **ln-010 npx cache probe** — hex package version detection via npx cache scan instead of `npm outdated -g`; setup_hooks called unconditionally in Phase 3c verification
- **ln-014 auto-fix** — Phase 5b auto-fixes missing Compact Instructions and MCP Tool Preferences sections in instruction files
- **ln-012 probe cleanup** — removed global npm/npm ls fallback probes; hex packages are npx-only


## 2026-03-24
- **skills-catalog rename** — `skills/` → `skills-catalog/` to fix plugin skill duplication (128×6 entries in autocomplete)
- **ln-840-benchmark-compare** — new skill in optimization-suite: A/B benchmark (built-in vs hex-line), renamed from ln-015
- **bulk_replace caps** — format param (compact/full), per-file diff cap (50L), payload cap (30K chars)

---

## 2026-03-23

- **ln-010 assess-dispatch-verify** — redesigned from invoke-all to smart dispatch: probes environment once, builds decision matrix, skips workers with nothing to do
- **ln-150 removed** — presentation-creator skill deleted; all references cleaned from pipeline, marketplace, site, docs
- **ln-162 Check 18** — new automated check verifies every SKILL.md has `**Type:**` line; prevents silent bypass of Check 9/17
- **run_checks.sh hardened** — Check 5 scoped to skills-catalog/ paths only; Check 9/17 exclude Workers from coordinator-only requirements
- **ln-014 auditor → manager** — renamed to ln-014-agent-instructions-manager; creates missing CLAUDE.md, AGENTS.md, GEMINI.md

## 2026-03-22

- **GitHub Pages MCP section** — hex-line, hex-ssh, hex-graph MCP servers showcased on site index with dedicated detail pages (`site/mcp/`)
- **Plugin pages enhanced** — all 6 plugin detail pages now link each skill row to its SKILL.md source on GitHub
- **GitHub Pages best practices** — new standards doc for site development guidelines
- **hex-graph layered rewrite** — canonical symbol identities, layered semantic edges, and the current use-case graph analysis surface replaced the old flat impact/context API
- **Agent review simplified** — debate protocol (challenge/follow-up rounds) replaced with AGREE/REJECT verification + iterative Codex refinement loop (max 5 iterations)
- **hex-ssh security hardening** — 4 new modules: command-policy, edit-validation, host-verify, shell-escape

## 2026-03-21

- **ln-012 MCP configurator** — 3 critical phases added: hooks+outputStyle install (Phase 4b), allowed-tools REPLACE strategy with mcp__* preservation (Phase 4d), MCP Tool Preferences auto-write to CLAUDE.md/GEMINI.md/AGENTS.md (Phase 4e)
- **01X consistency audit** — ln-010 delegation table and rules aligned with ln-012 sanctioned write paths; ln-013 hooks mentioned in description, duplicate tool mapping removed

## 2026-03-20

- **hex MCP family** — 3 npm MCP servers: hex-line (hash-verified file editing, 10 tools), hex-ssh (remote file ops over SSH, 6 tools), hex-graph (code knowledge graph, 7 tools); rebranded from sharpline
- **hex MCP v2** — output style system, hash-hint fallback, anchor-based editing, benchmark v3 (91-98% savings on multi-step workflows); hex-line v1.1.0, hex-ssh v1.1.0, hex-graph v0.2.0 published to npm
- **Setup Environment plugin** — 7th plugin extracted from agile-workflow: ln-010 coordinator + 4 workers (agent installer, MCP configurator, config syncer, instructions auditor)
- **Research skills consolidated** — ln-001 and ln-002 merged into ln-310 and ln-220 via shared layer; research methodology and docs creation extracted to shared references
- **Best practice guides** — MCP Tool Design, Hook Design, Prompt Caching; hooks redesigned with dangerous command blocker
## 2026-03-19

- **hex MCP family** — 3 bundled MCP servers: hex-line (hash-verified file editing, 10 tools), hex-ssh (remote file ops over SSH, 6 tools), hex-graph (code knowledge graph with tree-sitter AST, 7 tools); FNV-1a hashing, security boundaries; npm publishable
- **Agent runner overhaul** — Windows spawn fix (whichSync PATHEXT), heartbeat removed (log-based monitoring), registry 4→2 agents with focus_hint, `--approval-mode yolo` ⚠️ BREAKING
- **Python → Node.js ESM** — all runtime scripts (.py) replaced with .mjs: agent_runner, 3 hooks, analyze_test_logs; Python dependency eliminated ⚠️ BREAKING
- **ln-1000 redesign** — TeamCreate/heartbeat replaced with sequential Skill() calls; quality gate (ln-500) and test planning (ln-520) can no longer be skipped ⚠️ BREAKING
- **GitHub Actions** — npm auto-publish for hex-line-mcp on tag `hex-line-v*`

## 2026-03-18

- **Agent process tree kill** — agent_runner kills entire process tree (not just immediate child) on both timeout and normal completion; `--verify-dead` CLI flag for safety net checks
- **Python advanced tools mandatory** — import-linter, deptry, vulture, pip-audit promoted from optional to required in linter configurator; new config templates added
- **Multi-stack verification matrix** — quality setup coordinator now has tool matrix across TypeScript/Python/.NET for all verification checks
- **Epistemic protocol** — new `shared/references/epistemic_protocol.md` for source attribution and anti-hallucination across all research skills; integrated into research_tool_fallback, phase2_research_audit, solution_validation
- **Description triggers + agent timeout 30min** — all 125 descriptions rewritten with "Use when..." triggers; ln-162 reviewer gains M6 + CHECK 14; all agent hard timeouts raised to 30 min; 7XX bootstrap skills get Meta-Analysis sections

## 2026-03-16

- **Codex Windows performance** — agent_runner auto-detects Windows and prepends prompt hint directing Codex to prefer built-in file read over PowerShell shell commands (5-15s overhead per call)

## 2026-03-15

- **Multi-cycle optimization** — performance pipeline now iterates (profile → research → validate → execute → repeat) until target met or plateau detected; each cycle discovers new bottlenecks as dominant ones are fixed (Amdahl's law)
- **Cross-service performance profiling** — optimization pipeline traces bottlenecks across microservices (monorepo, git submodules, docker-compose); profiles inside accessible services instead of treating them as black boxes
- **Community Engagement plugin** — new plugin with skills for automated GitHub community management: triage issues/PRs, compose announcements, launch RFC debates, respond to threads
- **Token efficiency: output normalization** — new shared reference normalizes, deduplicates, and groups CLI output before presenting to agent; reduces noise in test runners, build auditors, profilers, log analyzers
- **Skill reviewer automated script** — ln-162 Phase 2 checks now run via executable `run_checks.sh` instead of manual template assembly

## 2026-03-14

- **Agent sandbox fix** — plan files from outside project workspace now materialized for agent access (Gemini CLI CWD restriction)

## 2026-03-13

- **Test log analysis** — new skill classifies errors from Docker/file/Loki logs into 4 categories; only Real Bugs block quality verdict
- **Documentation skill extraction** — scan project docs, extract procedural content into reusable `.claude/commands` with quality review

---

## 2026-03-11

- **Pipeline orchestrator hardening** — Plan Gate now enforced at all 5 stages, worker prompts consolidated

---

## 2026-03-08

- **Plugin marketplace** — split into 5 focused plugins installable individually: agile-workflow, documentation-pipeline, codebase-audit-suite, project-bootstrap, optimization-suite
- **Optimization Suite** — new plugin for full-stack performance optimization (profile → research → execute), dependency upgrades (npm/NuGet/pip), code modernization (OSS replacement, bundle optimization)
- **Destructive operation safety** — all skills now classify destructive actions by severity with human-in-the-loop gates

---

## 2026-03-07

- **Two-layer detection** — audit skills now use grep pre-filter + AI context analysis instead of pure AI scanning (faster, fewer false positives)

---

## 2026-03-06

- **Documentation fact-checker** — new skill extracts verifiable claims from .md files (paths, versions, configs) and cross-checks against codebase

---

## 2026-02-13

- **Pipeline Orchestrator** — one command drives a Story through the full lifecycle: task planning → validation → implementation → quality gate → merge to develop. Uses Agent Teams for parallel worker coordination

---

## 2026-02-12

- **Multi-round agent debate** — Codex/Gemini sessions now persist across challenge rounds, preserving full reasoning context during disagreements

---

## 2026-02-11

- **Multi-model code review** — parallel Codex + Gemini analysis with Critical Verification: Claude independently validates each suggestion and debates controversial findings (max 2 rounds)
- **Risk Analysis in validation** — 6 risk categories with Impact × Probability scoring before Story approval
- **Persistence performance audit** — new skills for query efficiency, transaction correctness, blocking I/O, resource lifecycle analysis

---

## 2026-01-10

- **Project Bootstrap** — 32 new skills for scaffolding production-ready projects or transforming existing ones to Clean Architecture. Supports React, .NET, Python with Docker, CI/CD, security scanning, and quality tooling setup

---

## 2025-12-23

- **RICE prioritization** — new skill scores Stories by Reach, Impact, Confidence, Effort with automated market research

---

## 2025-12-21

- **Validation overhaul** — universal pattern detection (OAuth, REST, ML pipelines) with fast path for trivial CRUD stories

---

## 2025-11-21

- **100x token reduction** — coordinators now load Story/Task metadata only (~50 tokens vs ~5,000), delegating full reads to workers

---

## 2025-11-14

- **Orchestrator-Worker architecture** — 3-level hierarchy (L1 orchestrators → L2 coordinators → L3 workers) with Progressive Disclosure for 24-40% documentation reduction

---

## 2025-11-10

- **v1.0.0** — Agile workflow automation end-to-end: scope decomposition, task execution, quality gates, Linear integration, Risk-Based Testing
