# Two-Layer Detection Methodology

Unified methodology for L3 audit workers. Replaces pure grep-based scanning with grep + agent reasoning.

## Why Two Layers

Grep (Layer 1) finds candidates fast but produces false positives. Agent reasoning (Layer 2) reads context, builds models, and filters FP — catching issues grep cannot detect alone (cross-process races, scope-dependent violations, architecture-level gaps).

## Layer 1: Pattern Scan

Fast, automated scan using Grep/Glob/Bash tools.

| Action | Tool | Purpose |
|--------|------|---------|
| Find code patterns | Grep | Match known anti-patterns, violation signatures |
| Find files by structure | Glob | Locate config files, entry points, test files |
| Run analysis tools | Bash | Execute linters, audit commands, type checkers |


### Layer 1 Acceleration: audit_workspace

When hex-graph is available (project indexed via `mcp__hex-graph__index_project`), use `mcp__hex-graph__audit_workspace` for Layer 1 DRY candidate detection instead of Grep:

```
audit_workspace(path, verbosity="full")
```

| Output field | Use |
|---|---|
| `groups[].type` | exact = identical copy, normalized = renamed vars, near_miss = modified structure |
| `groups[].members[]` | file, name, lines, stmt_count, callers |
| `groups[].impact` | Refactoring priority (callers x size) |
| `groups[].suppressed` | true = test-fixture (skip), false + hints = review needed |

Layer 2 verification still required: read actual code, confirm refactoring value.

**Fall back to Grep when:** hex-graph not indexed, or domain-specific duplication (validation logic, error messages, SQL) — `audit_workspace` surfaces structural clone groups, not arbitrary semantic similarity.
**Output:** List of candidate locations (file:line) with matched pattern.

## Layer 2: Context Analysis

Agent reads surrounding code and applies domain reasoning to each candidate.

### Standard Steps

1. **Read Context** — Read 20-50 lines around candidate. Understand scope (function, module, process), data flow, synchronization present nearby.

2. **Build Model** (when applicable):
   - Resource model: Who accesses what? Is resource exclusive? Is sync present?
   - Data flow model: Where does input come from? Where does output go?
   - Dependency model: What depends on this? What does this depend on?

3. **Critical Questions** (domain-specific, defined per check):
   - Does the context change the severity or validity of this finding?
   - Is there a safe pattern nearby that mitigates the issue?
   - What's the blast radius if this is a real issue?

4. **Classify:**
   - **Confirmed** — Real issue with assigned severity
   - **False Positive** — Candidate not a real issue (document reason)
   - **Needs Context** — Cannot determine without more info (report as LOW with note)

### When Layer 2 Is Mandatory

| Situation | Layer 2 | Rationale |
|-----------|---------|-----------|
| Grep pattern has high FP rate (>30%) | **Mandatory** | Without context analysis, report is noise |
| Finding depends on scope/architecture | **Mandatory** | Grep cannot determine scope, lifecycle, or architecture |
| Finding involves cross-process/OS interaction | **Mandatory** | Domain knowledge required |
| Tool provides structured output with confidence | Optional | Tool already analyzed context (e.g., `npm audit` with CVSS) |
| Pattern is unambiguous (e.g., `time.sleep` in `async def`) | Optional | Low FP, context rarely changes verdict |

### Example: Clipboard Race Condition

**Layer 1 found:** `writeOsc52()` + `setClipboardText()` in same file.

**Layer 2 analysis:**
1. Read context: both called in sequence within same function
2. Build resource model: Win32 clipboard is exclusive (one `OpenClipboard()` at a time). `writeOsc52` → stdout → terminal calls `OpenClipboard()`. `setClipboardText` → FFI calls `OpenClipboard()`. Two accessors, one exclusive resource.
3. Trace timeline: ~1ms window where both compete for clipboard lock
4. Critical question: "Can terminal process the escape sequence before our native call?" → Yes, timing-dependent
5. Verdict: **CRITICAL** — two processes race for exclusive OS resource

**Without Layer 2:** Grep finds two clipboard-related calls but cannot understand that OSC 52 causes the terminal to access clipboard — this is domain knowledge about terminal emulators.

## Usage in SKILL.md

Reference this file in Workflow section:

```markdown
**MANDATORY READ:** Load `shared/references/two_layer_detection.md` for detection methodology.
```

Each check should specify which Layer 2 steps apply and what domain-specific critical questions to ask.

---
**Version:** 1.0.0
**Last Updated:** 2026-03-04
