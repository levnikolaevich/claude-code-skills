# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**IMPORTANT:** One version entry per date. Combine all daily changes under the highest version number for that date.

---

## 2025-11-15

**[3.0.1]** Fixed sequential numbering in ln-00-story-pipeline v2.0.1 (Phase 3 Step 3a/3b/3c → Step 1/2/3), updated diagram.html v1.1.1 Mermaid nodes, replaced step number cross-references with worker names to avoid ambiguity (e.g., "ln-20-story-validator re-approves" instead of "Step 1 re-approves").

---

## 2025-11-14

Four releases: **[3.0.0]** added L2→L2 Delegation Rules, Story Status Responsibility Matrix (4 transitions), autoApprove mechanism for full pipeline automation; BREAKING: ln-00-story-pipeline v2.0.0 always invokes ln-10-story-decomposer, ln-30-story-executor v6.0.0 removed Priority 0 (3 priorities now), Progressive Disclosure Pattern applied to 5+ skills (24-40% documentation reduction). **[1.14.0]** unified documentation structure (ln-22-adr-creator v4.0.0 → docs/adrs/), ln-20-story-validator v11.0.0 auto-creates 3 doc types (Guides/Manuals/ADRs) via AUTO-RESEARCH. **[2.0.0]** BREAKING: renamed 5 skills with semantic suffixes (x-story-executor → ln-30-story-executor, etc.) for L2 Domain Orchestrator distinction, implemented 3-Level Hierarchy Architecture (Microsoft Scheduler Agent Supervisor Pattern) with Progressive Loading (15,000+ tokens saved), changed "auto-invoke" → "explicit delegation" terminology. **[1.14.0]** added Writing Guidelines (Progressive Disclosure Pattern), ln-00-story-pipeline v1.0.0 (Story Processing Orchestrator); BREAKING: x-story-reviewer v6.0.0 Early Exit Pattern (Code Quality → Regression → Manual Testing), x-story-executor v5.0.0 Priority 0 Auto-Verify + Auto Pass 2 for full automation; compressed SKILL_ARCHITECTURE_GUIDE.md by 22% and CLAUDE.md by 57% (14,485 total tokens saved).

---

## 2025-01-14

**[1.13.0]** Added ln-23-manual-creator v1.0.0 for creating Package API reference manuals via AUTO-RESEARCH (MCP Context7 + Ref), OpenAPI-inspired format with 4-phase workflow (Research → Method Analysis → Manual Generation → Storage to docs/manuals/). Total repository skills: 23 → 24.

---

## 2025-11-13

**[1.7.0]** Added 5 new skills: ln-11-task-creator/ln-12-task-replanner v1.0.0 (Universal Factory Pattern for all 3 task types: implementation/refactoring/test), ln-41/42/43 v1.0.0 (atomic quality/regression/manual testing workers), SKILL_ARCHITECTURE_GUIDE.md v1.0.0 (industry best practices 2024-2025), expanded refactoring_task_template.md (83→513 lines), Test Result Format v1.0. BREAKING: x-test-task-planner v6.0.0 renamed from x-story-finalizer, x-task-planner v6.0.0 refactored to Orchestrator Pattern (delegates to ln-11/12 workers), ln-11-task-creator v2.0.0 + ln-12-task-replanner v2.0.0 Universal Factory Pattern (requires taskType parameter), x-story-finalizer v5.0.0 + x-story-reviewer v5.0.0 delegate task creation to universal factory. Architecture unified: Orchestrator-Worker Pattern across all skills, 90.2% performance improvement (token efficiency via lazy loading).

---

## 2025-11-12

**[1.1.0]** Added Phase 0: Library & Standards Research in ln-71-story-manager v8.0.0 (automated research via MCP Context7 + Ref BEFORE Story generation, 15-20 min time-boxed), story_template_universal.md v7.0.0 with Library Research + Related Guides subsections, task_template_universal.md v6.0.0 with expanded Technical Approach (~50→200-300 words with library versions, key APIs, pseudocode), Temporary Manual Testing Scripts workflow (scripts/tmp_[story_id].sh). Updated x-story-executor v3.0.0 (critical task loading rules, automatic loop restart), x-story-reviewer v4.0.0 (two-pass structure: Pass 1 6 phases, Pass 2 3 phases), x-story-verifier v10.0.0 (major restructuring 1077 lines, validates Library Research table), x-task-planner v5.1.0 (consolidated principles, 630 lines restructured), ln-34-test-executor v4.0.0 (cleanup temp scripts in Step 6).

---

## 2025-11-10

**[1.0.0]** Initial plugin release with 17 production-ready skills in 5 categories: Pre-Planning (5 skills: ln-61-docs-creator, ln-62-html-builder, ln-60-docs-system, ln-63-docs-updater, ln-22-adr-creator), Planning (4: ln-70-epic-creator, ln-71-story-manager, x-task-manager, x-story-finalizer), Execution (5: x-story-executor, ln-31-task-executor, ln-34-test-executor, ln-32-task-reviewer, ln-33-task-rework), Validation (2: x-story-verifier, x-story-reviewer), Documentation (1: ln-21-guide-creator). Features: Complete Agile workflow automation for Linear (MCP integration), Risk-Based Testing (E2E-first, Priority ≥15), Decompose-First Pattern (Epic → Stories → Tasks with KEEP/UPDATE/OBSOLETE/CREATE), Template Ownership, Consumer-First Principle, DAG Documentation Support, Auto-Guide Creation. Plugin manifest + marketplace support, Mermaid diagrams for all skills, comprehensive documentation (CLAUDE.md, README.md), MIT License, 3 installation methods (plugin system/direct plugin/git clone).

---

## Future Releases

### Planned

- Additional workflow optimizations
- Extended integration capabilities
- Community-contributed templates

---

**Links:**
- [Repository](https://github.com/levnikolaevich/claude-code-skills)
- [Issues](https://github.com/levnikolaevich/claude-code-skills/issues)
- [Contributing Guidelines](https://github.com/levnikolaevich/claude-code-skills#contributing)
