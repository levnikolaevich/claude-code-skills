# Changelog

<!-- SCOPE: Release history and version changes ONLY. Contains dated release notes, one paragraph per release. -->
<!-- DO NOT add here: detailed feature specs → individual SKILL.md files, version numbers in skills → SKILL.md footer -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**CRITICAL RULE: Each release = ONE concise paragraph (3-5 sentences max). NO detailed subsections. One entry per date, newest first.**

---

## 2026-03-01

**Zoned Labs Fork: Trimmed from 106 to 54 skills.** Removed 52 enterprise skills: Planning (ln-200 through ln-230), Task Management (ln-300 through ln-311), Orchestrators (ln-400, ln-403, ln-500, ln-520-523, ln-1000), and entire Bootstrap plugin (ln-700 through ln-783). Retained: Utility/Research (5), Docs Pipeline (13), Execution Workers (3), Quality Workers (5), Audit Suite (28). Consolidated to single plugin (zoned-labs-dev-skills). Updated all cross-references in kept skills. ln-510-quality-coordinator now produces standalone verdict (was delegating to removed ln-500). ln-401/ln-402/ln-404 accept task IDs from user directly (was from removed ln-400 orchestrator).

---

## 2026-02-13

New skill: ln-1000-pipeline-orchestrator (L0 Meta-Orchestrator). Reads kanban board, user selects ONE Story, drives it through 4-stage pipeline (ln-300 task planning -> ln-310 validation -> ln-400 execution -> ln-500 quality gate) via Claude Code Agent Teams. Single Story per run, user-confirmed merge to develop on quality gate PASS. Includes 6 reference files: message_protocol.md (formal lead<->worker message contract with regex parsing), worker_health_contract.md (3-step crash detection + respawn), pipeline_states.md (state machine with guards), worker_prompts.md (4 stage templates), kanban_parser.md (task presence detection), and 4 Mermaid diagrams. New 10XX Orchestration category. Total skills: 100 -> 101.

---

## 2026-02-12

Session Resume for Agent Debate: ln-311 and ln-513 now resume Codex/Gemini sessions during challenge/follow-up rounds via `--resume-session` flag, preserving full agent context (file analysis, reasoning). New: agent_runner.py session capture + fallback to stateless, agent_registry.json v3.0 with resume_args/session_id_capture config. `.agent-review/` existence check before creation, removed auto-add to .gitignore. New skill: ln-003-push-all (commit+push all changes). Total skills: 99 → 100.

---

## 2026-02-11

Agent Review v2.0: ln-311 and ln-513 with Critical Verification + Debate Protocol (background tasks, process-as-arrive, challenge rounds via challenge_review.md). Risk Analysis: ln-310 criterion #20 with 6 risk categories and Impact x Probability scoring (20 criteria, 8 groups, max 75 penalty points). New shared infra: agent_registry.json v2.0 (no timeouts), agent_runner.py --output-file/placeholder support. New audit skills: ln-601, ln-631-635, ln-643-644, ln-650-653. Total skills: 85 → 99.

---

## 2026-01-10

**NEW: Project Bootstrap System (7XX)** - Added 32 new skills for technology-agnostic project migration. L1 Top Orchestrator (ln-700-project-bootstrap) coordinates 8 L2 coordinators: dependency-upgrader (710), structure-migrator (720), devops-setup (730), quality-setup (740), commands-generator (750), security-setup (760), crosscutting-setup (770), bootstrap-verifier (780). Each coordinator delegates to specialized L3 workers. Supports React/Vue/Angular frontends, .NET/Node/Python backends. Total skills: 51 → 83.

---

## 2025-12-23

**BREAKING: Major skill renumbering** - Reorganized 51 skills into 6 balanced categories: 0XX Shared (ln-001, ln-002), 1XX Docs, 2XX Planning, 3XX Tasks, 4XX Execution, 5XX Quality, 6XX Audit. All renamed skills → v3.0.0. New: ln-230-story-prioritizer (RICE prioritization with market research). Key workflow: ln-400 → ln-300 → ln-310 → ln-410 → ln-500.

---

## 2025-12-21

ln-310-story-validator v3.0.0 - Critical Path Validation First. 5-phase architecture with universal pattern detection (OAuth, REST, ML, etc.) via ln321_auto_trigger_matrix.md. TRIVIAL CRUD fast path (2min vs 10min). Research delegated to ln-002 (10x token reduction). 20→17 validation criteria.

---

## 2025-11-21

ln-220-story-coordinator v4.0.0 - Orchestrator-Worker decomposition (831→409 lines, -51%). New workers: ln-221-story-creator, ln-222-story-replanner. Token efficiency: 100x reduction (metadata-only loading ~50 tokens/Story vs ~5,000 full). ln-001-standards-researcher renamed from ln-021-library-researcher.

---

## 2025-11-17

Centralized validation + file naming standardization. ln-110-documents-pipeline v5.0.0 added Phase 3: Validate All Documentation. 5 workers refactored to pure CREATE (-93 lines duplication). File naming standardized to lowercase (documentation_standards.md, principles.md).

---

## 2025-11-16

**BREAKING: Idempotent mode** - 7 documentation skills with file existence checks (24 total). Skills create ONLY missing files, preserve existing documentation, prevent accidental data loss on repeated invocations.

---

## 2025-11-15

**BREAKING: Epic Grouping Pattern** in kanban board. Hierarchical format: Epic → Story → Task (indentation). Four-level README hierarchy. ADRs/Guides/Manuals moved to docs/reference/.

---

## 2025-11-14

**BREAKING: 3-Level Hierarchy Architecture** (L1 → L2 → L3). L2→L2 Delegation Rules, Story Status Responsibility Matrix. Progressive Disclosure Pattern (24-40% docs reduction). autoApprove mechanism for full automation.

---

## 2025-11-13

Added SKILL_ARCHITECTURE_GUIDE.md (industry best practices 2024-2025). New workers: ln-301-task-creator, ln-302-task-replanner (Universal Factory for 3 task types). Orchestrator-Worker Pattern unified across all skills (90.2% token efficiency improvement).

---

## 2025-11-12

Added Phase 0: Library & Standards Research in Planning workflow. Automated research via MCP Context7 + Ref BEFORE Story generation (15-20 min time-boxed). Expanded task_template_universal.md with library versions, key APIs, pseudocode.

---

## 2025-11-10

**v1.0.0 Initial release** - 17 production-ready skills in 5 categories. Complete Agile workflow automation for Linear (MCP integration). Risk-Based Testing (E2E-first, Priority ≥15). Decompose-First Pattern (Epic → Stories → Tasks). Plugin manifest + marketplace support.

---

## Future Releases

- Additional workflow optimizations
- Extended integration capabilities
- Community-contributed templates

---

**Links:**
- [Repository](https://github.com/levnikolaevich/claude-code-skills)
- [Issues](https://github.com/levnikolaevich/claude-code-skills/issues)
- [Contributing Guidelines](https://github.com/levnikolaevich/claude-code-skills#contributing)
