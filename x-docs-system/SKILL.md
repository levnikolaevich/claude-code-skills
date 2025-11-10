---
name: x-docs-system
description: Orchestrator skill that creates complete documentation system by invoking specialized skills (x-docs-creator + x-html-builder + x-adr-creator). This skill should be used when starting new project and need full documentation suite at once.
---

# Documentation System Creator (Orchestrator)

This skill orchestrates the creation of a complete documentation system by invoking specialized documentation skills in sequence. It provides a single-command solution for comprehensive project documentation.

## When to Use This Skill

This skill should be used when:
- Start a new IT project and need complete documentation system at once
- Use automated workflow instead of manually invoking multiple skills
- Create both markdown documentation AND HTML presentation in one go
- Prefer orchestrated approach over manual skill chaining

**Alternative**: If you prefer granular control, invoke skills manually:
1. [x-docs-creator](../x-docs-creator/SKILL.md) - Create MD docs
2. [x-html-builder](../x-html-builder/SKILL.md) - Create HTML presentation (optional)
3. [x-adr-creator](../x-adr-creator/SKILL.md) - Add individual ADRs later (optional)

## How It Works

The skill follows a 3-phase orchestration workflow:

### Phase 1: User Confirmation

**Objective**: Explain workflow and get user approval.

**Process**:
1. Show user what will be created:
   - Project documentation (MD files via x-docs-creator)
   - HTML presentation (via x-html-builder)
   - Estimated time: 15-20 minutes with interactive dialog
2. Ask: "Proceed with complete documentation system creation? (yes/no)"
3. Ask: "Include HTML presentation? (yes/no)"

**Output**: User approval + HTML preference

---

### Phase 2: Create Markdown Documentation

**Objective**: Invoke x-docs-creator skill to generate all MD files.

**Process**:
1. Notify user: "Invoking x-docs-creator skill..."
2. Use **Skill tool** to invoke:
   ```
   command: "x-docs-creator"
   ```
3. Wait for x-docs-creator to complete all 5 phases:
   - Phase 1: Project Type Detection
   - Phase 2: Copy Reference Templates
   - Phase 3: Automatic Material Analysis (Optional)
   - Phase 4: Sequential Document Creation (Requirements → Architecture → Technical Spec → ADRs)
   - Phase 5: Summary and Next Steps
4. Verify output exists:
   - `docs/project/README.md`
   - `docs/project/requirements.md`
   - `docs/project/architecture.md`
   - `docs/project/technical_specification.md`
   - `docs/project/adrs/` (3-5 ADR files)

**Output**: Complete markdown documentation suite in `docs/project/`

---

### Phase 3: Create HTML Presentation (Optional)

**Objective**: If user approved HTML in Phase 1, invoke x-html-builder skill.

**Process**:
1. If user chose "yes" for HTML:
   - Notify user: "Invoking x-html-builder skill..."
   - Use **Skill tool** to invoke:
     ```
     command: "x-html-builder"
     ```
   - Wait for x-html-builder to complete all 3 phases:
     - Phase 1: Read Documentation
     - Phase 2: Create Modular HTML Structure
     - Phase 3: Build Final Presentation
   - Verify output exists:
     - `docs/project/presentation_final.html`
     - `docs/project/assets/` directory
2. If user chose "no":
   - Skip HTML generation
   - Notify user: "Skipped HTML presentation (can run x-html-builder later)"

**Output**: Interactive HTML presentation (if enabled)

---

### Phase 4: Summary and Next Steps

**Objective**: Provide complete overview of created system.

**Process**:
1. List all created files with sizes:
   - `docs/project/README.md` (navigation hub)
   - `docs/project/requirements.md`
   - `docs/project/architecture.md`
   - `docs/project/technical_specification.md`
   - `docs/project/adrs/adr-001-*.md` (3-5 files)
   - `docs/project/presentation_final.html` (if HTML enabled)
   - `docs/project/assets/` (if HTML enabled)

2. Show documentation system features:
   - ✅ SCOPE tags (document boundaries defined)
   - ✅ Maintenance sections (update triggers + verification)
   - ✅ README hub (central navigation)
   - ✅ DAG structure (Directed Acyclic Graph navigation)
   - ✅ Living documentation ready

3. Recommend next steps:
   - "Review generated documentation in docs/project/"
   - "Open presentation_final.html in browser (if generated)"
   - "Run x-epic-creator to decompose scope into Epics"
   - "Share documentation with technical stakeholders"
   - "Run x-adr-creator skill to add more ADRs later (if needed)"

**Output**: Summary message with file list and recommendations

---

## Complete Output Structure

```
docs/project/
├── README.md                         # Navigation hub
├── requirements.md                   # FR + NFR + traceability
├── architecture.md                   # arc42 + C4 diagrams
├── technical_specification.md        # Tech stack + API + DB
├── adrs/                             # Architecture Decision Records
│   ├── _template.md
│   ├── adr-001-frontend-framework.md
│   ├── adr-002-backend-framework.md
│   ├── adr-003-database-choice.md
│   └── ...
├── presentation_final.html           # ← Interactive HTML (optional, generated by x-html-builder)
└── assets/                           # ← HTML modules (optional, generated by x-html-builder)
```

---

## Integration with Project Workflow

**Recommended workflow for new projects:**

1. **x-docs-system** (this skill) - Create complete documentation system
2. **x-epic-creator** - Decompose scope into Epics (Linear Projects)
3. **x-story-manager** - Create User Stories for each Epic (automatic decomposition + replan)
4. **x-task-manager** - Break down Stories into implementation tasks (automatic decomposition + replan)
5. **x-story-verifier** - Verify Stories before development
6. **x-story-executor** - Orchestrate Story implementation
7. **x-story-reviewer** - Review completed Stories

---

## Advantages of Orchestrator Approach

**Benefits:**
- ✅ Single command creates complete system
- ✅ No need to remember skill sequence
- ✅ Automated skill chaining
- ✅ Consistent output every time
- ✅ Time-saving (one invocation vs 2-3 manual invocations)

**Trade-offs:**
- ⚠️ Less granular control (can't skip x-docs-creator phases)
- ⚠️ Longer execution time (15-20 minutes)
- ⚠️ Can't reuse existing docs (starts fresh)

**When to use manual approach instead:**
- Need to update existing documentation → use [x-docs-updater](../x-docs-updater/SKILL.md)
- Need only HTML rebuild → use [x-html-builder](../x-html-builder/SKILL.md)
- Need one specific ADR → use [x-adr-creator](../x-adr-creator/SKILL.md)

---

## Error Handling

If any invoked skill fails:
1. Notify user which skill failed
2. Show error message from failed skill
3. Recommend manual invocation for debugging
4. List already completed steps (partial progress)

---

## Technical Implementation Notes

**Skill Invocation:**
- Uses **Skill tool** with command parameter
- Waits for each skill to complete before proceeding
- Verifies output files exist before moving to next phase

**File Verification:**
- Uses **Glob** tool to check docs/project/ structure
- Lists file sizes for user confirmation
- Warns if expected files missing

**Standards Compliance:**
- All output follows same standards as underlying skills
- ISO/IEC/IEEE 29148:2018 (Requirements)
- ISO/IEC/IEEE 42010:2022 (Architecture)
- arc42 + C4 Model + Michael Nygard's ADR Format

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ User Confirmation Obtained (Phase 1):**
- [ ] Workflow explained to user:
  - Project documentation (MD files via x-docs-creator)
  - HTML presentation (via x-html-builder, optional)
  - Estimated time: 15-20 minutes with interactive dialog
- [ ] User approved: "Proceed with complete documentation system creation? (yes/no)"
- [ ] HTML preference captured: "Include HTML presentation? (yes/no)"

**✅ Markdown Documentation Created (Phase 2):**
- [ ] User notified: "Invoking x-docs-creator skill..."
- [ ] x-docs-creator invoked via Skill tool (command: "x-docs-creator")
- [ ] x-docs-creator completed all 5 phases:
  - Phase 1: Project Type Detection
  - Phase 2: Copy Reference Templates
  - Phase 3: Automatic Material Analysis (Optional)
  - Phase 4: Sequential Document Creation (Requirements → Architecture → Technical Spec → ADRs)
  - Phase 5: Summary and Next Steps
- [ ] Output verified (all files exist):
  - `docs/project/README.md` (navigation hub)
  - `docs/project/requirements.md`
  - `docs/project/architecture.md`
  - `docs/project/technical_specification.md`
  - `docs/project/adrs/_template.md`
  - `docs/project/adrs/adr-001-*.md` through `adr-005-*.md` (3-5 ADRs)

**✅ HTML Presentation Created (Phase 3, if enabled):**
- [ ] **If user chose "yes" for HTML:**
  - User notified: "Invoking x-html-builder skill..."
  - x-html-builder invoked via Skill tool (command: "x-html-builder")
  - x-html-builder completed all 3 phases:
    - Phase 1: Read Documentation
    - Phase 2: Create Modular HTML Structure
    - Phase 3: Build Final Presentation
  - Output verified:
    - `docs/project/presentation_final.html` exists
    - `docs/project/assets/` directory exists with all modules
- [ ] **If user chose "no":**
  - HTML generation skipped
  - User notified: "Skipped HTML presentation (can run x-html-builder later)"

**✅ File Verification Complete:**
- [ ] All expected MD files verified (Glob tool used to check docs/project/ structure)
- [ ] File sizes listed for user confirmation
- [ ] If HTML enabled: HTML files verified (presentation_final.html + assets/)
- [ ] Warning displayed if expected files missing

**✅ Summary Displayed (Phase 4):**
- [ ] All created files listed with sizes:
  - docs/project/README.md
  - docs/project/requirements.md
  - docs/project/architecture.md
  - docs/project/technical_specification.md
  - docs/project/adrs/ (3-5 files)
  - docs/project/presentation_final.html (if HTML enabled)
  - docs/project/assets/ (if HTML enabled)
- [ ] Documentation system features highlighted:
  - ✅ SCOPE tags (document boundaries defined)
  - ✅ Maintenance sections (update triggers + verification)
  - ✅ README hub (central navigation)
  - ✅ DAG structure (Directed Acyclic Graph navigation)
  - ✅ Living documentation ready

**✅ User Guidance Provided:**
- [ ] Next steps recommended:
  - "Review generated documentation in docs/project/"
  - "Open presentation_final.html in browser (if generated)"
  - "Run x-epic-creator to decompose scope into Epics"
  - "Share documentation with technical stakeholders"
  - "Run x-adr-creator skill to add more ADRs later (if needed)"
- [ ] Integration workflow mentioned (x-docs-system → x-epic-creator → x-story-manager → ...)

**✅ Error Handling (if applicable):**
- [ ] If any skill failed:
  - User notified which skill failed
  - Error message from failed skill shown
  - Manual invocation recommended for debugging
  - Already completed steps listed (partial progress)

**Output:**
- Complete documentation system in `docs/project/`:
  - 5 core MD files (README + requirements + architecture + technical_spec + adrs/)
  - 3-5 ADR files
  - Optional: HTML presentation (presentation_final.html + assets/)
- Next steps recommendation (x-epic-creator to decompose scope)

---

**Version:** 1.0.2
**Last Updated:** 2025-01-31
