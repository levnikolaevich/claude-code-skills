# 👋 Welcome to Claude Code Skills Repository

> A comprehensive collection of skills for Claude Code, providing end-to-end Agile workflow automation integrated with Linear for modern software development teams.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Skills](https://img.shields.io/badge/skills-24-green) ![Updated](https://img.shields.io/badge/updated-Jan%202025-orange) ![License](https://img.shields.io/badge/license-MIT-green) [![GitHub stars](https://img.shields.io/github/stars/levnikolaevich/claude-code-skills?style=social)](https://github.com/levnikolaevich/claude-code-skills)

---

## 📖 About

This repository contains **24 production-ready skills** for [Claude Code](https://claude.ai/code) that automate and streamline your entire software development lifecycle. From initial documentation to story execution and quality assurance, these skills work together to create a complete Agile development workflow.

**What You Get:**
- 🎯 **Complete Agile Workflow** - From Epic decomposition to task execution and review
- 📋 **Linear Integration** - Seamless task management and tracking
- 🔄 **Automated Workflows** - Intelligent orchestration of development tasks
- 📊 **Visual Documentation** - Mermaid diagrams for every skill workflow
- 🏗️ **Best Practices Built-In** - KISS/YAGNI/DRY principles, Risk-Based Testing, Industry Standards compliance

**Perfect For:**
- Software development teams using Agile methodologies
- Projects integrated with Linear for task management
- Teams seeking to automate repetitive development workflows
- Organizations wanting to standardize their development practices

---

## 🚀 Features

### Pre-Planning Skills (5)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-docs-creator](ln-docs-creator/)** | Create comprehensive project documentation BEFORE development begins. Generates requirements, architecture, technical specs, README hub, ADR structure, and optional HTML presentation. | 6.0.0 | ✅ |
| **[ln-html-builder](ln-html-builder/)** | Build interactive HTML presentation from project documentation with 6 tabs (Overview, Requirements+ADRs, Architecture, Technical Spec, Roadmap, Guides). Uses Mermaid v11. | 2.3.1 | ✅ |
| **[ln-docs-system](ln-docs-system/)** | Orchestrator that creates complete documentation system (MD docs + HTML presentation) in one command. Invokes ln-docs-creator and ln-html-builder. | 1.1.0 | ✅ |
| **[ln-docs-updater](ln-docs-updater/)** | Update existing project documentation based on code changes. Automatically scans git diff and updates only affected sections. Preserves existing content. | 3.0.0 | ✅ |
| **[ln-adr-creator](ln-adr-creator/)** | Create minimal Architecture Decision Records (ADRs) through 5-question dialog. Categorizes as Strategic or Technical. Nygard format with 7 sections (~300-500 words). | 5.0.0 | ✅ |

### Planning Skills (6)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-epic-creator](ln-epic-creator/)** | Decompose scope into 3-7 Linear Projects (Epics) with business goals, success criteria, and phased strategy through interactive dialog. Auto-discovers team ID. | 4.0.0 | ✅ |
| **[ln-story-manager](ln-story-manager/)** | Universal Story operations (create/replan) with automatic Epic decomposition. Phase 0: Library & Standards Research via MCP Context7 + Ref → IDEAL Story plan (5-10 Stories) → creates or replans existing Stories (KEEP/UPDATE/OBSOLETE/CREATE). | 8.0.0 | ✅ |
| **[ln-task-coordinator](ln-task-coordinator/)** | **Orchestrator** for task operations. Analyzes Story, builds optimal task plan (1-6 tasks, Consumer-First ordered), delegates to ln-task-creator (CREATE) or ln-task-replanner (REPLAN) with `taskType: "implementation"`. Auto-discovers team ID. For implementation tasks only. | 7.2.0 | ✅ |
| **[ln-task-creator](ln-task-creator/)** | **Universal factory** for creating ALL 3 task types (implementation, refactoring, test). Generates task documents from templates, validates type-specific rules, creates in Linear. Invoked by orchestrators (ln-task-coordinator, ln-story-quality-coordinator, ln-test-coordinator). Owns all 3 templates. | 2.2.0 | ✅ |
| **[ln-task-replanner](ln-task-replanner/)** | **Universal replanner** for updating ALL 3 task types (implementation, refactoring, test). Compares IDEAL plan vs existing, categorizes operations (KEEP/UPDATE/OBSOLETE/CREATE), applies type-specific validation, executes changes in Linear. Reads templates from ln-task-creator/references/. | 2.2.0 | ✅ |
| **[ln-test-coordinator](ln-test-coordinator/)** | Create test task for Story after manual testing passes. Analyzes Story, generates comprehensive test task with 11 sections. **Delegates to ln-task-creator (CREATE) or ln-task-replanner (REPLAN)** with `taskType: "test"`. Supports existing test task updates. | 7.2.0 | ✅ |

### Execution Skills (6)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-story-processor](ln-story-processor/)** | 🔄 **Orchestrate complete Story processing workflow** from task planning to Done. Delegates to ln-task-coordinator (Phase 2), ln-story-validator (Phase 3a), ln-story-coordinator (Phase 3b with To Review → To Rework → Todo priorities) and explicitly drives ln-story-quality-coordinator Pass 1 + Pass 2. Looping workflow until Story status = Done. Full pipeline automation: Todo → In Progress → To Review → Done. | 2.0.0 | ✅ |
| **[ln-story-coordinator](ln-story-coordinator/)** | Orchestrate Story execution (Todo → In Progress → To Review → Done). **Priority 0: Backlog** (auto-verify new tasks before execution) → **Priority 1: To Review** → **Priority 2: To Rework** → **Priority 3: Todo**. Auto-invokes ln-story-quality-coordinator Pass 1 + Pass 2 (full automation). Phase 4 delegates Story quality to ln-story-quality-coordinator (Orchestrator-Worker Pattern). | 6.0.0 | ✅ |
| **[ln-task-executor](ln-task-executor/)** | ⚙️ Execute implementation tasks ONLY (Todo → In Progress → To Review). Uses KISS/YAGNI principles, reads guide links, runs type checking and linting. Story status management removed (now ln-story-coordinator's responsibility). NOT for test tasks. | 10.1.0 | ✅ |
| **[ln-test-executor](ln-test-executor/)** | ⚙️ Execute Story Finalizer test tasks (Todo → In Progress → To Review). E2E-first Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit). Includes test fixes, infrastructure, docs, and legacy cleanup. | 3.0.0 | ✅ |
| **[ln-task-reviewer](ln-task-reviewer/)** | 🔍 Review completed tasks for To Review → Done/Rework transition. Distinguishes test/implementation tasks. Checks architecture, docs, security, quality, and test coverage. | 7.3.0 | ✅ |
| **[ln-task-rework](ln-task-rework/)** | Fix tasks marked To Rework. Analyzes feedback, applies fixes following KISS/YAGNI/DRY principles, runs quality gates (type checking, linting), and submits back To Review. | 5.1.0 | ✅ |

### Validation Skills (2)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-story-validator](ln-story-validator/)** | Critically review Stories and Tasks against 2025 industry standards before approval (Backlog → Todo). ALWAYS auto-fixes all 16 verification criteria. Auto-creates guides/manuals/ADRs via AUTO-RESEARCH. No "Needs Work" path exists. | 11.0.0 | ✅ |
| **[ln-story-quality-coordinator](ln-story-quality-coordinator/)** | L2 orchestrator for Story quality. Pass 1 delegates code analysis to `ln-code-quality-checker`, regression to `ln-regression-checker`, manual AC verification to `ln-manual-tester` (Format v1.0) with FAIL‑FAST exit at each gate; auto-creates refactor/bug tasks when any gate fails. When all gates pass, automatically runs `ln-test-coordinator` (`autoApprove: true`) to create Story Finalizer test task. Pass 2 verifies automated tests (Priority ≥15, limits 10‑28) and moves Story to Done. | 7.1.0 | ✅ |

### Documentation Skills (2)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-guide-creator](ln-guide-creator/)** | Research and create minimal project guides (6 sections, 300-500 words) documenting reusable patterns. AUTO-RESEARCH via MCP Ref/Context7. Returns guide path for linking. | 4.0.0 | ✅ |
| **[ln-manual-creator](ln-manual-creator/)** | Create minimal Package API reference manuals (~300-500 words, OpenAPI-inspired format). AUTO-RESEARCH via MCP Context7 + Ref. Neutral, factual tone. Version-specific (package-version.md). Returns manual path for linking. | 1.1.0 | ✅ |

### Testing & Quality Skills (3)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[ln-regression-checker](ln-regression-checker/)** | 🧪 Run existing test suite to verify no regressions. Auto-detects framework (pytest/jest/vitest/go test). Returns JSON verdict + Linear comment. Atomic worker - does NOT create tasks or change statuses. | 1.0.0 | ✅ |
| **[ln-manual-tester](ln-manual-tester/)** | 🎯 Perform manual functional testing of Story AC using curl (API) or puppeteer (UI). Tests main scenarios + edge cases + error handling + integration. Creates reusable temp script `scripts/tmp_[story_id].sh`. Documents results in Linear (Format v1.0). | 2.0.0 | ✅ |
| **[ln-code-quality-checker](ln-code-quality-checker/)** | 🔎 Analyze code quality for DRY/KISS/YAGNI/Architecture violations and guide compliance. Checks git diffs of Done implementation tasks. Reports structured issues by severity (HIGH/MEDIUM/LOW). Fail Fast principle - runs FIRST in Phase 4. | 2.0.0 | ✅ |

---

## 📥 Installation

**Prerequisites:** [Claude Code CLI](https://claude.ai/code) installed

Choose your installation method:

**Method 1: Plugin Marketplace (Recommended)**
```bash
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install agile-linear-workflow@agile-linear-workflow-marketplace
/skills  # Verify installation
```

**Method 2: Direct Plugin**
```bash
/plugin add levnikolaevich/claude-code-skills
/skills  # Verify installation
```

**Method 3: Git Clone**
```bash
# macOS/Linux
git clone https://github.com/levnikolaevich/claude-code-skills.git ~/.claude/skills

# Windows
git clone https://github.com/levnikolaevich/claude-code-skills.git %USERPROFILE%\.claude\skills

# Verify
/skills
```

> 📖 For detailed setup, updates, and configuration, see [Advanced Setup](#-advanced-setup) section below.

---

## 📊 Visual Documentation

**Every skill includes workflow diagrams** to help you understand the execution flow, decision points, and state transitions.

### Diagram Files

Each skill directory contains:
- **`diagram.html`** - Standalone HTML file with embedded Mermaid diagram
- **`shared/css/diagram.css`** - Universal CSS styles (shared across all skills)

**Key Features:**
- Mermaid diagrams embedded directly in HTML (no separate source files)
- Works locally via file:// protocol (no HTTP server required)
- Consistent styling via shared CSS (130 lines replace 1760+ lines of duplication)

### How to View Diagrams

**Open the HTML file (easiest)**
```bash
# Navigate to any skill folder and open the HTML file
cd ln-docs-creator
start diagram.html  # Windows
open diagram.html   # macOS
xdg-open diagram.html  # Linux
```

**Editing Diagrams:**
- Edit Mermaid code directly in HTML files within `<div class="mermaid">...</div>` blocks
- All styling controlled via `shared/css/diagram.css`

### Diagram Types

- **Linear Workflows** - Sequential phases (ln-docs-creator, ln-html-builder, ln-adr-creator)
- **State Machine Workflows** - Todo → In Progress → To Review (ln-task-executor, ln-test-executor)
- **Branching Workflows** - Multiple decision paths (ln-task-reviewer, ln-story-quality-coordinator, ln-test-coordinator)
- **Looping Workflows** - Iterative processing (ln-story-coordinator, ln-epic-creator)
- **Single-Path Auto-Fix** - Linear with auto-corrections (ln-story-validator)

### Standard Color Coding

All diagrams follow consistent color scheme:
- **Discovery/Preparation** - `#E3F2FD` (light blue)
- **Loop/Processing** - `#FFF9C4` (light yellow)
- **Decision Points** - `#FFE0B2` (light orange)
- **Actions/Updates** - `#C8E6C9` (light green)
- **Critical/Stop** - `#FFCDD2` (light red)

---

## 💡 Usage

### Quick Start Example

**Creating Project Documentation:**
```bash
# In Claude Code, invoke the skill
ln-docs-creator
# Follow the interactive prompts to generate comprehensive documentation
```

**Decomposing Epic into Stories:**
```bash
# Invoke story manager with Epic number
ln-story-manager
# Skill will analyze Epic and create/replan Stories automatically
```

**Executing a Story:**
```bash
# Invoke story executor with Story ID
ln-story-coordinator
# Skill will orchestrate task execution, reviews, and rework
```

### Typical Workflow

**Manual Step-by-Step (Full Control):**
```
1. ln-docs-creator            → Create project documentation
2. ln-epic-creator            → Decompose scope into Epics
3. ln-story-manager           → Create Stories for an Epic (with Phase 0 Library Research)
4. ln-task-coordinator        → Create implementation tasks for a Story
5. ln-story-validator         → Validate and approve Story + tasks (auto-fixes 16 criteria)
6. ln-story-coordinator       → Execute tasks with auto-delegation to ln-story-quality-coordinator
   ├─ Executes implementation tasks (Priority: To Review → To Rework → Todo)
   ├─ Auto-invokes ln-story-quality-coordinator Pass 1 when all impl tasks Done
   └─ Auto-invokes ln-story-quality-coordinator Pass 2 when test task Done
7. ln-story-quality-coordinator (auto-invoked by ln-story-coordinator Phase 4)
   ├─ Pass 1: ln-code-quality-checker → ln-regression-checker → ln-manual-tester (FAIL-FAST)
   ├─ On Pass 1 success: auto-invokes ln-test-coordinator to create test task
   └─ Pass 2: verifies automated tests → moves Story to Done
8. ln-test-executor           → Execute Story Finalizer test task (if not automated)
```

**Fully Automated (ln-story-processor):**
```
1. ln-docs-creator     → Create project documentation
2. ln-epic-creator     → Decompose scope into Epics
3. ln-story-manager    → Create Stories for an Epic (with Phase 0 Library Research)
4. ln-story-processor  → Complete automation from task planning to Done
   └─ Orchestrates: ln-task-coordinator → ln-story-validator → ln-story-coordinator
                    (which auto-delegates to ln-story-quality-coordinator Pass 1 + Pass 2)
```

For detailed usage of each skill, see [CLAUDE.md](CLAUDE.md).

---

## 🔧 Advanced Setup

### Prerequisites

Before installation, ensure you have:

- **Claude Code CLI** - Install from [claude.ai/code](https://claude.ai/code)
- **Git** - Required for Method 3 (Git Clone) installation
- **Linear Account** (optional) - For task management integration features
  - Create API key at [linear.app/settings/api](https://linear.app/settings/api)
  - Configure team ID in `docs/tasks/kanban_board.md` (auto-generated by ln-docs-creator)

### Updating

**For Plugin installations (Method 1 or 2):**
```bash
/plugin update agile-linear-workflow
```

**For Git Clone installation (Method 3):**
```bash
# Navigate to skills directory
cd ~/.claude/skills                    # macOS/Linux
cd %USERPROFILE%\.claude\skills       # Windows CMD
cd $env:USERPROFILE\.claude\skills    # Windows PowerShell

# Pull latest changes
git pull origin master
```

### Configuration

**Linear Integration (Optional):**

Skills automatically discover configuration from `docs/tasks/kanban_board.md`:
- Team ID
- Next Epic Number
- Next Story Number

To set up:
1. Run `ln-docs-creator` skill to generate `docs/tasks/kanban_board.md`
2. Add your Linear API key to environment or Claude Code settings
3. Skills will auto-discover and use configuration when needed

**No setup required** - skills work independently without Linear integration.

---

## 🤝 Contributing

**We warmly welcome contributions from the community!** 🎉

Whether you're fixing bugs, improving documentation, adding new features, or creating new skills - your contributions help make this project better for everyone.

### How to Contribute

1. **Fork the repository**
   ```bash
   # Click "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-code-skills.git
   cd claude-code-skills
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make your changes**
   - Follow the existing skill structure
   - Add diagrams for new skills (diagram.html with embedded Mermaid code)
   - Update CLAUDE.md if adding new skills
   - Include version and last updated date

5. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch and describe your changes

### What to Contribute

- 🐛 **Bug Fixes** - Report and fix issues
- 📖 **Documentation** - Improve explanations, add examples, fix typos
- ✨ **New Skills** - Create skills for new workflows
- 🎨 **Improvements** - Enhance existing skills, optimize workflows
- 🌐 **Translations** - Help translate documentation (Stories/Tasks can be in any language)
- 💡 **Ideas** - Share suggestions and use cases

### Development Guidelines

- **Follow CLAUDE.md standards** - All skills follow unified structure
- **Document your changes** - Update SKILL.md, add version numbers
- **Create diagrams** - Visual workflows help users understand skills
- **Test thoroughly** - Verify your skill works end-to-end
- **Use English** - All documentation in English (Stories/Tasks can vary)

---

## 📚 Documentation

### Core Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive guide with:
  - Repository structure and skill organization
  - Task hierarchy (Epic → Story → Task)
  - Development principles (KISS/YAGNI/DRY, Standards First, Risk-Based Testing)
  - Complete workflow documentation for all skills
  - Template references and best practices
  - Linear integration details

### Skill Structure

Each skill follows a unified structure:
```
x-skill-name/
├── SKILL.md              # Metadata and full description
├── diagram.html          # Standalone HTML with embedded Mermaid diagram
└── references/           # Templates and guides
    ├── template.md       # Document templates
    └── guide.md          # Reference guides

shared/
└── css/
    └── diagram.css       # Universal CSS for all diagrams
```

### Template Ownership Principle

- Each skill owns its templates in its own `references/` directory (Single Source of Truth)
- Templates are NOT copied to project during setup
- Skills use templates directly from their `references/` when generating documents
- Example: ln-adr-creator uses `ln-adr-creator/references/adr_template.md` when creating ADRs

---

## 🌟 Key Concepts

### Task Hierarchy
```
Epic (Linear Project)
  └── User Story (Linear Issue with label "user-story")
      └── Task (Linear Issue with parentId=Story ID)
          └── Subtask (implementation steps)
```

### Development Principles

**Hierarchy of Principles (when conflicts arise):**
1. **Industry Standards & RFCs** (OAuth 2.0, REST API design, OpenAPI, protocol standards)
2. **Security Standards** (OWASP Top 10, NIST guidelines)
3. **Development Principles** (KISS/YAGNI/DRY apply WITHIN standard boundaries)

**Core Principles:**
- **Standards First** - Follow industry standards before applying KISS/YAGNI
- **YAGNI** - Do not add functionality ahead of time
- **KISS** - Simplest solution that works (within standard boundaries)
- **DRY** - Do not duplicate code
- **Consumer-First** - Consumer first (API endpoint), then provider (Repository)
- **Task Granularity** - Optimal task size 3-5 hours (max 6 tasks per Story)
- **Value-Based Testing** - Prioritize by business risk (2-5 E2E, 3-8 Integration, 5-15 Unit per Story)
- **No Legacy Code** - Remove backward compatibility shims and deprecated patterns

---

## 📄 License

This project is licensed under the MIT License - see the repository for details.

Feel free to use, modify, and distribute this software in your projects!

---

## 🙏 Acknowledgments

- **Claude Code Team** - For creating an amazing AI-powered development environment
- **Linear Team** - For excellent task management and API
- **Mermaid.js** - For beautiful, git-friendly diagrams
- **Community Contributors** - Thank you for making this project better!

---

## 👤 Author

**Lev Nikolaevich**
- GitHub: [@levnikolaevich](https://github.com/levnikolaevich)
- Repository: [claude-code-skills](https://github.com/levnikolaevich/claude-code-skills)

---

## 📬 Questions or Feedback?

- 💬 **Discussions** - Share ideas and ask questions in [GitHub Discussions](https://github.com/levnikolaevich/claude-code-skills/discussions)
- 🐛 **Issues** - Report bugs or request features via [GitHub Issues](https://github.com/levnikolaevich/claude-code-skills/issues)
- ⭐ **Star this repo** - If you find it useful!

---

<div align="center">

**Happy Coding! 🚀**

*Built with ❤️ by the community, for the community*

</div>
