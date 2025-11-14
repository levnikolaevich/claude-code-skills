# Skill Architecture Guide

**Industry Best Practices for Claude Code Skills (2024-2025)**

This document captures industry standards and best practices for designing Claude Code skills, based on research from Claude Skills Guidelines, Multi-Agent Orchestration patterns, and Agile methodologies.

---

## Writing Guidelines (Progressive Disclosure Pattern)

**When adding content to this document, follow these rules to maintain token efficiency:**

### Structure Format

| Content Type | Format | Example |
|--------------|--------|---------|
| **Comparisons** | Table with columns | Orchestrator vs Worker responsibilities |
| **Criteria/Indicators** | Table with description column | When to Split Skills indicators |
| **Decision Trees** | Table with YES/NO columns | Should This Be One Skill? |
| **Examples** | Table with verdict + rationale columns | PDF Processing, Task Management |
| **References** | One-line format (source, topics, key insight) | Claude Skills Deep Dive (leehanchung.github.io) - topics. Key Insight: "quote" |
| **Workflows** | Inline arrow notation (→) | Discovery → Load Metadata → Delegate → Worker |
| **Lists** | Bullet points (NOT numbered paragraphs) | Benefits: Item 1, Item 2, Item 3 |
| **Key Takeaways** | Compact bullets with inline details | Pattern Name - Brief description (metrics, impact) |

### When Verbose Content Is Justified

**KEEP detailed examples ONLY for:**
- ❌ **Anti-patterns** - Showing what NOT to do prevents mistakes (educational value)
- 🎓 **Educational workflows** - Structure examples that demonstrate architecture principles
- ⚠️ **Common pitfalls** - Real-world mistakes with explanations

**COMPRESS everything else:**
- ✅ Definitions → one sentence
- ✅ Benefits → bullet list
- ✅ Examples → table rows
- ✅ References → one line per source

### Rationale

**Token efficiency = Faster context loading + Lower costs + Better maintainability**

Target: 400-600 lines for core principles, 600-800 lines with advanced documentation techniques (this document: 791 lines, includes 23 advanced documentation principles from 2024-2025 research).

---

## Advanced Documentation Principles (2024-2025)

**Source:** Research from Vercel VP, Microsoft Documentation, Nielsen Norman Group, Diátaxis Framework, Flesch-Kincaid readability standards (2024)

### Quick Wins for SKILL.md Optimization

**Top 5 principles with highest ROI (Low effort, High impact):**

| # | Principle | Token Savings | Effort | Application |
|---|-----------|---------------|--------|-------------|
| 1 | **Concise Terms** | -30 to -40% | Low | Replace verbose phrases (see Appendix A) |
| 2 | **Brevity Rules** | -40 to -50% | Low | Remove filler words (simply, quickly, easily) |
| 3 | **Active Voice** | -15 to -20% | Low | Convert passive → active |
| 4 | **Chunking Pattern** | -20% | Medium | Phase 1 \| Phase 2 \| Phase 3 (compact) |
| 5 | **Lead with Code** | -15 to -25% | Medium | Code examples before text |

**Combined effect:** -30 to -40% token reduction per SKILL.md

### Additional Principles

| Principle | Description | Token Impact | When to Use |
|-----------|-------------|--------------|-------------|
| **Diátaxis Framework** | Classify docs into 4 types: Tutorial/How-to/Explanation/Reference | 0% (reorganization) | Full SKILL.md restructure |
| **Inverted Pyramid** | Most important info first (What/Who/Key Benefit) | -40% in descriptions | Frontmatter, introductions |
| **Information Scent** | Predictable, quantified headings ("5-Phase Workflow") | +10% size, -40% search time | All headings |
| **Progressive Disclosure** | Max 2 nesting levels (NN/G 2024) | 0%, +40% findability | <details> sections |
| **NOT JUST HAPPY PATH** | Document errors, workarounds, troubleshooting | +10-15% size, -60% support | Error handling sections |
| **Semantic Headings** | Descriptive > generic ("Configure Team ID" vs "Configuration") | +10% size, -40% search | All headings |
| **DRY Include Files** | Single source for duplicated content | -70% per duplicate | Shared content (status tables) |
| **Flesch-Kincaid** | Target: Reading Ease 50-60, Grade Level 10-12 | -25% (shorter sentences) | All text |
| **F-Pattern Layout** | Key info at top left (eye tracking 2024) | 0%, +60% scan speed | Document structure |
| **Restrict Sentence Length** | Max 20-25 words per sentence | 0%, +40% readability | All paragraphs |
| **Short Paragraphs** | 3-5 sentences max, 1 idea per paragraph | 0%, +50% scannability | All sections |
| **Use Cases** | 3-5 real scenarios with Input/Action/Output | +20% size, +70% comprehension | How-to sections |
| **Conversational Tone** | "you" instead of "user", simple present tense | -10 to -15% | All text |
| **Task-Oriented Titles** | Start with verb for tasks/tutorials | +5%, +100% actionability | Tutorial/How-to headings |
| **Context Before Action** | "If X, do Y" (not "Do Y if X") | 0%, +30% clarity | Conditional statements |

### Concise Terms Reference

**20 most common verbose → concise pairs (full list in Appendix A):**

| ❌ Avoid | ✅ Use | Savings |
|---------|-------|---------|
| in order to | to | -67% |
| at this point in time | now | -80% |
| has the ability to | can | -73% |
| is able to | can | -67% |
| in the event that | if | -79% |
| prior to | before | -63% |
| for the purpose of | to/for | -75% |
| make use of | use | -67% |
| provides a description of | describes | -76% |
| a number of | several | -67% |

**Full dictionary:** See [Appendix A: Concise Terms Dictionary](#appendix-a-concise-terms-dictionary)

### Brevity Rules - Words to Remove

| Filler Word | Why Remove |
|-------------|------------|
| simply | Doesn't add meaning |
| quickly | Subjective |
| easily | Subjective |
| on top of that | Use "and" |
| in many cases | Use "often" |
| it is important to note | Redundant |
| basically | Adds no value |
| actually | Rarely needed |
| really | Subjective emphasis |
| very | Use stronger adjective |

### Readability Metrics (Flesch-Kincaid 2024)

**Targets for technical documentation:**

| Metric | Formula | Target | Tool |
|--------|---------|--------|------|
| **Reading Ease** | 206.835 - 1.015×(words/sent) - 84.6×(syll/word) | 50-60 (College) | textstat.flesch_reading_ease() |
| **Grade Level** | 0.39×(words/sent) + 11.8×(syll/word) - 15.59 | 10-12 (High school) | textstat.flesch_kincaid_grade() |
| **Sentence Length** | words/sentences | 15-20 words max | Manual count |
| **Paragraph Length** | sentences/paragraph | 3-5 sentences | Manual count |

### Documentation Structure (Diátaxis)

**4 types of documentation with different goals:**

| Type | Goal | Style | Use in SKILL.md |
|------|------|-------|-----------------|
| **Tutorial** | Learning-oriented | Step-by-step with examples | Quick Start section |
| **How-to** | Task-oriented | Recipes for real problems | Workflow, Use Cases |
| **Explanation** | Understanding-oriented | Concepts, context, "why" | Architecture, Principles |
| **Reference** | Information-oriented | Technical facts, API, params | Status tables, Parameters |

**Application:** Separate SKILL.md into distinct sections by type

---

## Table of Contents

1. [Advanced Documentation Principles (2024-2025)](#advanced-documentation-principles-2024-2025)
2. [Core Principles](#core-principles)
3. [Orchestrator-Worker Pattern](#orchestrator-worker-pattern)
4. [Single Responsibility Principle](#single-responsibility-principle)
5. [When to Split Skills](#when-to-split-skills)
6. [When to Combine Skills](#when-to-combine-skills)
7. [Skill Architecture Patterns](#skill-architecture-patterns)
8. [Token Efficiency](#token-efficiency)
9. [Task Decomposition (Agile)](#task-decomposition-agile)
10. [Red Flags](#red-flags)
11. [Best Practices Checklist](#best-practices-checklist)
12. [References](#references)
13. [Appendix A: Concise Terms Dictionary](#appendix-a-concise-terms-dictionary)

---

## Core Principles

### 1. Single Responsibility Principle

**Definition:** Each skill should do ONE thing well, not multiple unrelated things.

**Good Examples:**
- `pdf` skill - handles PDF operations only
- `email-comms` skill - handles email composition only
- `x-task-executor` - executes implementation tasks only (NOT test tasks)

**Bad Examples:**
- ❌ Skill that handles PDF processing AND email composition
- ❌ Skill that creates tasks AND updates tasks AND reviews tasks
- ❌ Skill with > 3-4 major workflow steps

**Rationale:**
- Easier to maintain and debug
- Clear scope and responsibilities
- Better reusability
- Reduces context size

### 2. Orchestrator-Worker Pattern

**Definition:** Separate coordination logic from execution logic.

**Structure:**
```
Orchestrator (Coordinator)
├── Discovers context
├── Makes decisions
├── Delegates to Workers via Skill tool
└── Manages workflow state

Workers (Executors)
├── Receive specific tasks
├── Execute single-responsibility work
└── Return results
```

**Benefits:**
- **90.2% performance improvement** on complex tasks (industry data 2024)
- Parallel processing
- Specialized expertise per worker
- Clean context management
- Easy to add new workers

**Examples in This Repository:**
- **Level 1:** `x-story-processor` → coordinates full Story lifecycle
- **Level 2:** `x-story-coordinator`, `x-task-coordinator` (domain orchestrators) → coordinate specific workflows, delegate to workers
- **Level 3:** `x-task-reviewer`, `x-task-executor`, `x-test-executor`, `x-task-creator`, `x-task-replanner` → execute work

**Note:** See "3-Level Hierarchy (Industry Standard)" section below for complete structure and Microsoft Scheduler Agent Supervisor Pattern reference.

### 3. Narrow Specialization

**Definition:** Skills should have focused, well-defined domains.

**Guidelines:**
- SKILL.md should be < 5000 words (~800 lines)
- Frontmatter description < 200 characters
- Clear tool scoping (only necessary tools)
- Progressive resource loading (lazy loading)

**Red Flag:** Description > 200 chars = too broad scope

---

## Orchestrator-Worker Pattern

### Orchestrator vs Worker Responsibilities

| Component | Should Do | Should NOT Do |
|-----------|-----------|---------------|
| **Orchestrator** | Discover context (Team ID, project info)<br>Load metadata only (ID, title, status)<br>Make routing decisions<br>Delegate via Skill tool<br>Manage workflow state<br>Handle loops and retries | Execute work directly<br>Load full descriptions<br>Contain business logic |
| **Worker** | Receive specific task<br>Load full descriptions when needed<br>Execute single-responsibility work<br>Return results/status | Make workflow decisions<br>Call other workers directly<br>Manage global state |

**Key Pattern:** Orchestrator reloads metadata after each worker completes, then re-evaluates priorities.

**Example Flow (x-story-coordinator):**
Discovery → Load Tasks Metadata (ID, title, status) → Loop (Priority 1: To Review → x-task-reviewer, Priority 2: To Rework → x-task-rework, Priority 3: Todo → x-task-executor, Reload after each) → Story Review

### 3-Level Hierarchy (Industry Standard)

**Industry Reference:** [Scheduler Agent Supervisor Pattern](https://learn.microsoft.com/azure/architecture/patterns/scheduler-agent-supervisor) (Microsoft Architecture Center)

This architecture follows industry-proven pattern where:
- **Scheduler** arranges workflow steps and orchestrates execution
- **Agent** encapsulates service calls and resource access
- **Supervisor** monitors status and handles failures (not implemented separately in our case)

**Our Implementation:**

| Level | Role | Responsibilities | Data Loading | Examples |
|-------|------|------------------|--------------|----------|
| **Level 1** | Top Orchestrator | Coordinate full lifecycle workflows | Metadata only | `x-story-processor` |
| **Level 2** | Domain Orchestrator | Coordinate specific domain workflows | Metadata only | `x-story-coordinator`, `x-story-validator`, `x-story-quality-coordinator`, `x-task-coordinator`, `x-test-coordinator` |
| **Level 3** | Worker | Execute atomic work | FULL descriptions when needed | `x-task-executor`, `x-test-executor`, `x-task-reviewer`, `x-task-creator`, etc. |

**Critical Rules:**

1. **Metadata-Only Loading (L1+L2):**
   - Orchestrators load ONLY ID, title, status, labels
   - Workers load FULL descriptions when executing work
   - Rationale: Minimize coordination, reduce token usage (saves 10,000+ tokens)

2. **Delegation via Skill Tool (L1+L2):**
   - Orchestrators delegate via async Skill tool calls
   - NO direct worker-to-worker calls
   - L2→L2 delegation ALLOWED with strict rules (see L2→L2 Delegation Rules below)

3. **Worker Specialization (L3):**
   - Single responsibility per worker
   - Load FULL data when needed
   - Return results to orchestrator

**Reference:** Microsoft Architecture Center, "Scheduler Agent Supervisor Pattern" - https://learn.microsoft.com/azure/architecture/patterns/scheduler-agent-supervisor

### L2→L2 Delegation Rules

**Context:** Level 2 orchestrators may delegate to other L2 orchestrators when domains are separate and workflow is sequential.

**Industry Precedents:**
- AWS Step Functions Nested Workflows - orchestrator steps invoke other state machines
- LangGraph Multi-Agent Supervisors - supervisor agents delegate to other supervisors
- Microsoft Scheduler Agent Pattern - schedulers can compose other schedulers for complex flows

**Rules for L2→L2 Delegation:**

| Rule | Description | Rationale |
|------|-------------|-----------|
| **1. Explicit Delegation** | MUST use Skill tool with explicit skill name and parameters | Prevents ambiguity, ensures audit trail |
| **2. Sequential Flow** | NO parallel L2→L2 calls - one orchestrator completes before next starts | Avoids race conditions, simplifies state management |
| **3. Domain Separation** | Orchestrators MUST have different domains (task execution vs quality validation) | Prevents circular dependencies, maintains Single Responsibility |
| **4. DAG Only** | Workflow MUST form Directed Acyclic Graph - no cycles allowed | Prevents infinite loops, ensures termination |
| **5. Documentation Mandatory** | MUST document L2→L2 call in both SKILL.md files with rationale | Maintainability, clarity for future developers |

**Valid L2→L2 Examples:**

| Delegating Skill | Delegated Skill | Domain Separation | Rationale |
|------------------|-----------------|-------------------|-----------|
| x-story-coordinator | x-story-quality-coordinator Pass 1 | Task execution → Story quality validation | After all tasks Done, delegate quality verification |
| x-story-coordinator | x-story-quality-coordinator Pass 2 | Task execution → Final approval | After test task Done, delegate final Story approval |

**Invalid L2→L2 Examples (Violations):**

| Delegating Skill | Delegated Skill | Violation | Why Invalid |
|------------------|-----------------|-----------|-------------|
| x-story-coordinator | x-story-validator | Rule 3: Domain overlap | Both manage task/story status - circular dependency risk |
| x-task-coordinator | x-story-coordinator | Rule 4: Cycle risk | Creates potential loop (coordinator → coordinator) |

**Key Insight:** L2→L2 delegation enables workflow composition while maintaining separation of concerns. Use sparingly - prefer L2→L3 delegation when possible.

### Self-Healing Pipeline Pattern

Orchestrator automatically creates fix tasks when quality checks fail, then restarts the loop.

**Benefits:** Automatic error recovery, no manual intervention, ensures quality before completion.

---

## Single Responsibility Principle

### Decision Tree: Should This Be One Skill?

| Question | YES → | NO → |
|----------|-------|------|
| Q1: Do X and Y share the same domain? | Continue | Split into 2 skills |
| Q2: Do X and Y require different tool permissions? | Split into 2 skills | Continue |
| Q3: Are X and Y used independently by users? | Split into 2 skills | Continue |
| Q4: Combining X and Y results in > 800 lines? | Split into 2 skills | Can be 1 skill |
| Q5: Skill has > 3-4 major workflow steps? | Consider orchestrator + workers | 1 skill is fine |

### Examples

| Example | Functions | Verdict | Rationale |
|---------|-----------|---------|-----------|
| **PDF Processing** | Read PDF, Extract tables, Create PDF, Merge PDFs | ✅ ONE skill | Same domain, same tools, used together, < 800 lines |
| **Task Management** | Analyze story, Create tasks, Update tasks, Review tasks | ❌ SPLIT into orchestrator + workers | Different responsibilities, > 3 workflow steps, can be used independently |
| **x-task-coordinator (Before)** | Decompose, Create, Replan | ❌ SPLIT | Monolithic, 470 lines, violates SRP |
| **x-task-coordinator (After)** | Orchestrates task operations | ✅ Orchestrator | Delegates to x-task-creator, x-task-replanner |

---

## When to Split Skills

### Indicators for Splitting

| Indicator | Description | Example |
|-----------|-------------|---------|
| **Different Tool Requirements** | Needs different permissions for functions | File operations vs API calls |
| **Different Domains** | Unrelated purposes | PDF processing + email composition |
| **Independent User Workflows** | Invoked separately, rarely together | Create task vs Update task |
| **Size Threshold** | SKILL.md > 800 lines OR > 3-4 major workflow steps | Monolithic skills |
| **Different Models Needed** | Some functions need Opus, others Haiku | Complex reasoning vs simple tasks |

### Splitting Strategy: Orchestrator + Workers

**When to use:** Skill has coordination logic + execution logic, workers can be parallelized.

**Structure:** `x-{operation}-manager` (orchestrator) → `x-{operation}-creator`, `x-{operation}-updater`, `x-{operation}-deleter` (workers)

**Example:** `x-task-coordinator` (orchestrator) → `x-task-creator`, `x-task-replanner`

---

## When to Combine Skills

### Indicators for Combining

| Indicator | Criteria |
|-----------|----------|
| **Common Workflow Steps** | Functions share 70%+ of workflow (read → process → write) |
| **Identical Tool Permissions** | Both functions need exactly the same tools |
| **Rarely Used Independently** | Functions almost always used together |
| **Small Total Size** | Combined SKILL.md < 500 lines, < 3 major workflow steps |

### Example: x-adr-creator

**Functions:** Ask 5 questions → Generate ADR document (7 sections) → Create file in docs/adrs/

**Verdict:** ✅ ONE skill (single user workflow, common tools, small size ~300 lines, not used independently)

---

## Skill Architecture Patterns

### Pattern 1: Linear Workflow

**Use Case:** Sequential steps, no branching

**Structure:**
```
Phase 1: Input/Discovery
Phase 2: Processing
Phase 3: Validation
Phase 4: Output/Save
```

**Examples:**
- `x-docs-creator` - generates documentation sequentially
- `x-html-builder` - builds HTML presentation
- `x-guide-creator` - creates guides

**Diagram Type:** `graph TD` (top-down linear)

### Pattern 2: State Machine

**Use Case:** State transitions with rules

**Structure:**
```
State 1 (Todo) → State 2 (In Progress) → State 3 (To Review) → State 4 (Done)
                                                               ↓
                                         State 5 (To Rework) ← ┘
```

**Examples:**
- `x-task-executor` - moves tasks through states
- `x-test-executor` - test task lifecycle
- `x-task-rework` - fixes after review

**Diagram Type:** `stateDiagram-v2` or `graph TD` with state nodes

### Pattern 3: Branching Workflow

**Use Case:** Decisions with multiple paths

**Structure:**
```
Phase 1: Input
Phase 2: Decision
  ├── Path A (condition 1) → Action A
  ├── Path B (condition 2) → Action B
  └── Path C (condition 3) → Action C
Phase 3: Output
```

**Examples:**
- `x-task-reviewer` - 3 verdicts (Accept/Minor Fixes/Needs Rework)
- `x-story-reviewer` - Two-pass with different paths
- `x-task-coordinator` - CREATE or REPLAN mode

**Diagram Type:** `graph TD` with decision diamonds

### Pattern 4: Looping Workflow

**Use Case:** Repeat until condition met

**Structure:**
```
Phase 1: Load items
Phase 2: Process item
Phase 3: Check condition
  ├── Not done → Reload → GOTO Phase 2
  └── Done → STOP
```

**Examples:**
- `x-story-coordinator` - loops through tasks by priority
- `x-epic-creator` - loops through domains

**Diagram Type:** `graph TD` with loop-back arrows

### Pattern 5: Orchestrator

**Use Case:** Coordinate multiple workers

**Structure:**
```
Phase 1: Discovery
Phase 2: Load Metadata
Phase 3: Decision
Phase 4: Delegate
  ├── Worker 1 (via Skill tool)
  ├── Worker 2 (via Skill tool)
  └── Worker 3 (via Skill tool)
Phase 5: Aggregate Results
```

**Examples:**
- `x-story-coordinator` - coordinates task workers
- `x-task-coordinator` - coordinates creator/replanner

**Diagram Type:** `graph TD` with delegation nodes

---

## Token Efficiency

### Lazy Loading Pattern

**Problem:** Loading all data upfront wastes tokens.

**Solution:** Load metadata first (ID, title, status), full descriptions later when needed.

**Benefits:** 80-90% token reduction in orchestrator, avoids context truncation, scales to Stories with many tasks.

**Example (x-story-coordinator):**
```
Phase 2: Load Tasks Metadata (150 tokens) - ID, title, status ONLY
Phase 3: Orchestration Loop - Delegate to worker → Worker loads FULL description → Reload metadata
```

### Progressive Resource Loading

**Pattern:** Load only what's needed for current step → Load additional data when required → Cache frequently accessed.

**Example (x-task-replanner):** Load IDEAL plan → Load existing tasks ONE BY ONE (Task 1 → Compare → Decision, Task 2 → Compare → Decision) → Execute operations

**Rationale:** Prevents token overflow when comparing 10+ tasks.

---

## Task Decomposition (Agile)

### Vertical Slicing (RECOMMENDED)

**Definition:** Tasks cross ALL architectural layers (UI + API + Service + DB).

**Benefits:**
- ✅ Independent - no dependencies on other tasks
- ✅ Valuable - delivers end-to-end functionality
- ✅ Testable - can be tested in isolation
- ✅ Estimable - clear scope

**Example:**
```
Good: "Add login endpoint"
  - Includes: API endpoint + service logic + DB queries + UI form + tests

Bad: Split by layers
  - Task 1: Create DB schema
  - Task 2: Create service layer
  - Task 3: Create API endpoint
  - Task 4: Create UI
  Problem: Each task has no value until ALL are done
```

**Rationale:** Horizontal splitting creates dependencies and reduces agility.

### Horizontal Splitting (AVOID)

**Definition:** Tasks split by type of work (implementation, testing, docs).

**Problems:**
- ❌ Creates dependencies (can't test without implementation)
- ❌ No value until all slices complete
- ❌ Increases coordination overhead
- ❌ Violates INVEST criteria (Independent, Valuable)

**Example (BAD):**
```
Task 1: Implementation (login endpoint)
Task 2: Testing (login tests)
Task 3: Documentation (API docs)

Problem: Task 2 depends on Task 1, Task 3 depends on Task 1+2
```

**When Horizontal Splitting Is OK:**
- **Test tasks from test planning skill** - created AFTER manual testing of entire Story
- Rationale: Tests verify INTEGRATED functionality, not individual tasks

### Task Size Guidelines

**Optimal:** 3-5 hours (1-2 work sessions)

**Too Small (< 3h):**
- Combine with related work
- Example: "Add validation" + "Add error handling" → "Add login validation and error handling"

**Too Large (> 8h):**
- Decompose further
- Split by CRUD operations, business rules, or workflow steps

**Story Limits:**
- **Max 6 tasks per Story** (12-30 hours total)
- Rationale: Easy to estimate, track, and review; reduces scope creep

### INVEST Criteria

Every User Story should be:
- **I**ndependent - no dependencies on other stories
- **N**egotiable - details can be discussed
- **V**aluable - delivers value to users
- **E**stimable - can estimate effort
- **S**mall - fits in 1-2 sprints
- **T**estable - clear acceptance criteria

---

## Red Flags

### Skill Design Red Flags

| Red Flag | Problem | Solution |
|----------|---------|----------|
| SKILL.md > 800 lines | Too complex, multiple responsibilities | Split into orchestrator + workers |
| Description > 200 chars | Scope too broad or unclear | Narrow focus, split into multiple skills |
| > 3-4 major workflow steps | Monolithic design | Extract workers, use orchestrator |
| Many unrelated `allowed-tools` | Mixing concerns | Split by tool requirements |
| Constant behavior modification | Using conversation context as workaround | Use proper skill scoping |
| Orchestrator loads full descriptions | Token inefficiency | Lazy loading, delegate to workers |
| Worker makes workflow decisions | Responsibility leak | Move decision logic to orchestrator |

### Task Design Red Flags

| Red Flag | Problem | Solution |
|----------|---------|----------|
| Task split by arch layers | Horizontal splitting, no independent value | Use vertical slicing |
| Task < 3 hours | Too granular, overhead > value | Combine with related work |
| Task > 8 hours | Too large, hard to estimate/track | Decompose further |
| Story > 6 tasks | Scope creep, complexity | Split into multiple Stories |
| Implementation + Test + Docs as separate tasks | Horizontal splitting, dependencies | Include tests/docs in implementation task |

---

## Best Practices Checklist

### Skill Creation Checklist

- [ ] **Single Responsibility**: Does this skill do ONE thing well?
- [ ] **Size**: Is SKILL.md < 800 lines?
- [ ] **Description**: Is frontmatter description < 200 characters?
- [ ] **Workflow**: Does the skill have ≤ 3-4 major workflow steps?
- [ ] **Tools**: Are all `allowed-tools` necessary for this skill's purpose?
- [ ] **Orchestrator Pattern**: If coordinating work, does it delegate to workers?
- [ ] **Token Efficiency**: Does orchestrator use lazy loading (metadata only)?
- [ ] **Reusability**: Can workers be reused by other orchestrators?
- [ ] **Documentation**: Is there a workflow diagram (mermaid)?
- [ ] **Versioning**: Does SKILL.md have version and last updated date?

### Task Creation Checklist

- [ ] **Vertical Slice**: Does task cross all architectural layers?
- [ ] **Independence**: No dependencies on other tasks?
- [ ] **Value**: Delivers testable functionality?
- [ ] **Size**: 3-5 hours optimal (not < 3h or > 8h)?
- [ ] **Story Size**: Story has ≤ 6 tasks?
- [ ] **INVEST**: Meets all INVEST criteria?
- [ ] **Tests Included**: Tests integrated in implementation task (not separate)?
- [ ] **Docs Included**: Documentation integrated in implementation task?

### Orchestrator Design Checklist

- [ ] **Metadata Only**: Loads only ID, title, status (not full descriptions)?
- [ ] **Delegates Work**: Uses Skill tool to invoke workers?
- [ ] **Single Loop**: Reloads metadata after each worker completes?
- [ ] **No Business Logic**: All execution logic in workers?
- [ ] **State Management**: Manages workflow state transitions?
- [ ] **Self-Healing**: Creates fix tasks on failures?

### Worker Design Checklist

- [ ] **Single Responsibility**: Does ONE specific job?
- [ ] **Loads Full Data**: Gets full descriptions when needed?
- [ ] **Returns Results**: Provides status/results to orchestrator?
- [ ] **No Workflow Decisions**: Doesn't decide what to do next?
- [ ] **No Direct Worker Calls**: Doesn't call other workers directly?

---

## References

### Industry Sources

1. **Claude Skills Deep Dive** (leehanchung.github.io) - Single responsibility, orchestrator pattern, skill composition. Key Insight: "Skill composition > monoliths"

2. **Multi-Agent Orchestration (2024-2025)** (GitHub claude-flow, Medium) - Orchestrator-Worker pattern, performance benefits. Key Insight: "90.2% performance improvement on complex tasks". Production Stats: 85 specialized agents, 15 orchestrators

3. **Agile Task Decomposition** (Pluralsight) - Vertical slicing, INVEST criteria, task sizing. Key Insight: "Horizontal splitting fails at independent and valuable"

4. **Humanizing Work Guide** - Story splitting patterns, anti-patterns. Key Insight: "Never split by architectural layer"

### Repository-Specific Examples

**Good Orchestrators:** `x-story-coordinator` (280 lines), `x-task-coordinator` v6.0.0 (150 lines)

**Good Workers:** `x-task-creator` (150 lines), `x-task-replanner` (250 lines), `x-task-executor`, `x-test-executor`

**Monolithic (Before Refactoring):** `x-task-coordinator` v5.1.0 (470 lines, mixed CREATE/REPLAN logic)

---

## Conclusion

**Key Takeaways:**

1. **Orchestrator-Worker Pattern** - Industry standard 2024-2025 (90%+ performance improvement, proven in production: 85 agents + 15 orchestrators)

2. **Single Responsibility** - One skill = one job (< 800 lines, < 200 char description, ≤ 3-4 major workflow steps)

3. **Vertical Slicing** - Cross all layers (UI + API + Service + DB), avoid horizontal splitting, exception: Story-level test tasks after manual testing

4. **Token Efficiency** - Lazy loading (orchestrators: metadata only, workers: full descriptions when needed)

5. **Consistency** - All `x-*-executor` and `x-*-manager` skills follow orchestrator pattern

**When in doubt:** Narrow specialization > monoliths, use orchestrator pattern for coordination, load data lazily, vertical slice tasks.

---

## Appendix A: Concise Terms Dictionary

**57 verbose → concise phrase replacements for token efficiency**

**Source:** QuantConnect Documentation Style Guide, technical writing best practices (2024)

| ❌ Avoid (Verbose) | ✅ Use (Concise) | Token Savings |
|-------------------|------------------|---------------|
| in order to | to | -67% |
| at this point in time | now | -80% |
| has the ability to | can | -73% |
| is able to | can | -67% |
| in the event that | if | -79% |
| prior to | before | -63% |
| for the purpose of | to/for | -75% |
| make use of | use | -67% |
| provides a description of | describes | -76% |
| a number of | several | -67% |
| with regard to | about | -67% |
| in relation to | about | -67% |
| with reference to | about | -67% |
| in accordance with | per/following | -67% |
| due to the fact that | because | -75% |
| for the reason that | because | -75% |
| in spite of the fact that | although | -80% |
| on the basis of | based on | -60% |
| in the process of | (remove) | -100% |
| during the course of | during | -67% |
| with the exception of | except | -73% |
| in close proximity to | near | -80% |
| at the present time | now | -75% |
| in the near future | soon | -75% |
| at an earlier time | previously | -67% |
| on a regular basis | regularly | -73% |
| in most cases | usually | -67% |
| the majority of | most | -73% |
| a large number of | many | -78% |
| a small number of | few | -78% |
| is in a position to | can | -78% |
| has a tendency to | tends to | -67% |
| it is necessary to | must | -78% |
| it is recommended that | recommend | -75% |
| it should be noted that | note that | -75% |
| it is important to note | (remove) | -100% |
| take into consideration | consider | -75% |
| give consideration to | consider | -75% |
| have an impact on | affect | -75% |
| make a decision | decide | -67% |
| make a determination | determine | -67% |
| make an adjustment | adjust | -67% |
| perform an analysis | analyze | -67% |
| conduct an investigation | investigate | -63% |
| provide assistance | help | -67% |
| have a need for | need | -75% |
| exhibit a tendency | tend | -67% |
| brings about a change | changes | -75% |
| has the potential to | can/may | -78% |
| is responsible for | handles | -67% |
| serves the function of | functions as | -70% |
| in conjunction with | with | -75% |
| subsequent to | after | -67% |
| as a consequence of | because of | -67% |
| with the result that | so | -80% |
| for this reason | therefore | -67% |
| it may be said that | (remove) | -100% |

**Usage:** Apply these replacements globally to SKILL.md files using search/replace for -30 to -40% token reduction in descriptive text.

**Example transformation:**
```markdown
❌ Before (48 words):
"In order to execute tasks, x-task-executor has the ability to load the task
from Linear. At this point in time, the skill provides a description of the
implementation approach. It is important to note that quality gates are run
prior to completion."

✅ After (26 words, -46% reduction):
"To execute tasks, x-task-executor can load the task from Linear.
Now, the skill describes the implementation approach.
Quality gates run before completion."
```

---

**Version:** 1.3.0
**Last Updated:** 2025-11-14
