# 👋 Welcome to Claude Code Skills Repository

> A comprehensive collection of skills for Claude Code, providing end-to-end Agile workflow automation integrated with Linear for modern software development teams.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Skills](https://img.shields.io/badge/skills-17-green) ![Updated](https://img.shields.io/badge/updated-Nov%202025-orange) ![License](https://img.shields.io/badge/license-MIT-green) [![GitHub stars](https://img.shields.io/github/stars/levnikolaevich/claude-code-skills?style=social)](https://github.com/levnikolaevich/claude-code-skills)

---

## 📖 About

This repository contains **17 production-ready skills** for [Claude Code](https://claude.ai/code) that automate and streamline your entire software development lifecycle. From initial documentation to story execution and quality assurance, these skills work together to create a complete Agile development workflow.

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
| **[x-docs-creator](x-docs-creator/)** | Create comprehensive project documentation BEFORE development begins. Generates requirements, architecture, technical specs, README hub, ADR structure, and optional HTML presentation. | 5.5.0 | ✅ |
| **[x-html-builder](x-html-builder/)** | Build interactive HTML presentation from project documentation with 6 tabs (Overview, Requirements+ADRs, Architecture, Technical Spec, Roadmap, Guides). Uses Mermaid v11. | 2.3.1 | ✅ |
| **[x-docs-system](x-docs-system/)** | Orchestrator that creates complete documentation system (MD docs + HTML presentation) in one command. Invokes x-docs-creator and x-html-builder. | 1.0.2 | ✅ |
| **[x-docs-updater](x-docs-updater/)** | Update existing project documentation based on code changes. Automatically scans git diff and updates only affected sections. Preserves existing content. | 2.1.0 | ✅ |
| **[x-adr-creator](x-adr-creator/)** | Create minimal Architecture Decision Records (ADRs) through 5-question dialog. Categorizes as Strategic or Technical. Nygard format with 7 sections (~300-500 words). | 3.0.0 | ✅ |

### Planning Skills (4)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[x-epic-creator](x-epic-creator/)** | Decompose scope into 3-7 Linear Projects (Epics) with business goals, success criteria, and phased strategy through interactive dialog. Auto-discovers team ID. | 4.0.0 | ✅ |
| **[x-story-manager](x-story-manager/)** | Universal Story operations (create/replan) with automatic Epic decomposition. Builds IDEAL Story plan (5-10 Stories), then creates or replans existing Stories (KEEP/UPDATE/OBSOLETE/CREATE). | 7.0.0 | ✅ |
| **[x-task-manager](x-task-manager/)** | Universal task operations (create/update/replan) with automatic decomposition. Analyzes Story, builds optimal task plan (1-6 tasks), then creates or replans existing tasks. For implementation tasks only. | 5.0.0 | ✅ |
| **[x-story-finalizer](x-story-finalizer/)** | Create final Story task after manual testing passes. Generates comprehensive test task with 11 sections: E2E/Integration/Unit tests (Risk-Based), test fixes, infrastructure updates, documentation, and legacy cleanup. | 4.1.0 | ✅ |

### Execution Skills (5)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[x-story-executor](x-story-executor/)** | Orchestrate Story execution (Todo/In Progress → ready for review). Prioritizes To Review → To Rework → Todo. Invokes task reviewers, executors, and rework handlers. Auto-discovers team ID. | 2.6.0 | ✅ |
| **[x-task-executor](x-task-executor/)** | ⚙️ Execute implementation tasks ONLY (Todo → In Progress → To Review). Uses KISS/YAGNI principles, reads guide links, runs type checking and linting. NOT for test tasks. | 10.0.0 | ✅ |
| **[x-test-executor](x-test-executor/)** | ⚙️ Execute Story Finalizer test tasks (Todo → In Progress → To Review). E2E-first Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit). Includes test fixes, infrastructure, docs, and legacy cleanup. | 4.0.0 | ✅ |
| **[x-task-reviewer](x-task-reviewer/)** | 🔍 Review completed tasks for To Review → Done/Rework transition. Distinguishes test/implementation tasks. Checks architecture, docs, security, quality, and test coverage. | 7.3.0 | ✅ |
| **[x-task-rework](x-task-rework/)** | Fix tasks marked To Rework. Analyzes feedback, applies fixes following KISS/YAGNI/DRY principles, runs quality gates (type checking, linting), and submits back To Review. | 5.1.0 | ✅ |

### Validation Skills (2)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[x-story-verifier](x-story-verifier/)** | Critically review Stories and Tasks against 2025 industry standards before approval (Backlog → Todo). ALWAYS auto-fixes all 15 verification criteria - no "Needs Work" path exists. Auto-creates guides and validates structure. | 9.3.0 | ✅ |
| **[x-story-reviewer](x-story-reviewer/)** | Review completed User Stories through manual functional testing. Two-pass workflow: Pass 1 (test impl tasks + create test task), Pass 2 (verify tests + mark Story Done). | 3.5.0 | ✅ |

### Documentation Skills (1)

| Skill | Purpose | Version | Diagrams |
|:------|:--------|:-------:|:--------:|
| **[x-guide-creator](x-guide-creator/)** | Research and create minimal project guides (6 sections, 300-500 words) documenting reusable patterns. AUTO-RESEARCH via MCP Ref/Context7. Returns guide path for linking. | 4.0.0 | ✅ |

---

## 📊 Visual Documentation

**Every skill includes workflow diagrams** to help you understand the execution flow, decision points, and state transitions.

### Diagram Files

Each skill directory contains:
- **`diagram.mmd`** - Mermaid source file (text-based, git-friendly, editable)
- **`diagram.html`** - Standalone HTML file for viewing diagram in browser

### How to View Diagrams

**Option 1: HTML file (easiest)**
```bash
# Navigate to any skill folder and open the HTML file
cd x-docs-creator
start diagram.html  # Windows
open diagram.html   # macOS
xdg-open diagram.html  # Linux
```

**Option 2: Online editor**
1. Copy `diagram.mmd` content
2. Paste into [https://mermaid.live/](https://mermaid.live/)
3. View/edit/export as PNG/SVG

**Option 3: VS Code**
1. Install extension: "Markdown Preview Mermaid Support"
2. Open `diagram.mmd`
3. Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (macOS) for preview

**Option 4: GitHub**
- View `.mmd` files directly in repository
- Diagrams render automatically in markdown

### Diagram Types

- **Linear Workflows** - Sequential phases (x-docs-creator, x-html-builder, x-adr-creator)
- **State Machine Workflows** - Todo → In Progress → To Review (x-task-executor, x-test-executor)
- **Branching Workflows** - Multiple decision paths (x-task-reviewer, x-story-reviewer, x-story-finalizer)
- **Looping Workflows** - Iterative processing (x-story-executor, x-epic-creator)
- **Single-Path Auto-Fix** - Linear with auto-corrections (x-story-verifier)

### Standard Color Coding

All diagrams follow consistent color scheme:
- **Discovery/Preparation** - `#E3F2FD` (light blue)
- **Loop/Processing** - `#FFF9C4` (light yellow)
- **Decision Points** - `#FFE0B2` (light orange)
- **Actions/Updates** - `#C8E6C9` (light green)
- **Critical/Stop** - `#FFCDD2` (light red)

---

## 📥 Getting Started

### Prerequisites

Before you begin, ensure you have:
- **Claude Code CLI** - Install from [claude.ai/code](https://claude.ai/code)
- **Git** - For cloning the repository
- **Linear Account** (optional) - For task management integration

### Installation

This plugin can be installed in three ways. Choose the method that best fits your needs:

#### Method 1: Plugin Marketplace (Recommended ⭐)

**Best for:** Teams, automatic updates, easiest installation

```bash
# Step 1: Add the marketplace
/plugin marketplace add levnikolaevich/claude-code-skills

# Step 2: Install the plugin
/plugin install agile-linear-workflow@agile-linear-workflow-marketplace

# Step 3: Verify installation
/skills
```

**Benefits:**
- ✅ Automatic updates via `/plugin update`
- ✅ One command installation
- ✅ Guaranteed compatibility
- ✅ Version management

#### Method 2: Direct Plugin Installation

**Best for:** Quick setup without marketplace

```bash
# Step 1: Install plugin directly from GitHub
/plugin add levnikolaevich/claude-code-skills

# Step 2: Verify installation
/skills
```

#### Method 3: Git Clone (Manual Installation)

**Best for:** Developers, contributors, custom modifications

Choose the appropriate command for your operating system:

**macOS / Linux:**
```bash
git clone https://github.com/levnikolaevich/claude-code-skills.git ~/.claude/skills
```

**Windows (Command Prompt):**
```cmd
git clone https://github.com/levnikolaevich/claude-code-skills.git %USERPROFILE%\.claude\skills
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/levnikolaevich/claude-code-skills.git $env:USERPROFILE\.claude\skills
```

**Verify Installation:**
```bash
# In Claude Code, type:
/skills
```

You should see all 17 skills listed and available for use.

---

### Updating

**If installed via Plugin (Method 1 or 2):**
```bash
# Update to latest version
/plugin update agile-linear-workflow
```

**If installed via Git Clone (Method 3):**
```bash
# Navigate to skills directory
cd ~/.claude/skills                    # macOS/Linux
cd %USERPROFILE%\.claude\skills       # Windows (CMD)
cd $env:USERPROFILE\.claude\skills    # Windows (PowerShell)

# Pull latest changes
git pull origin master
```

---

### Configuration (Optional)

**Linear Integration:**

If you want to use Linear integration features:
1. Create a Linear API key at [linear.app/settings/api](https://linear.app/settings/api)
2. Configure your team ID in `docs/tasks/kanban_board.md` (generated by x-docs-creator)
3. Skills will auto-discover configuration when needed

---

## 💡 Usage

### Quick Start Example

**Creating Project Documentation:**
```bash
# In Claude Code, invoke the skill
x-docs-creator
# Follow the interactive prompts to generate comprehensive documentation
```

**Decomposing Epic into Stories:**
```bash
# Invoke story manager with Epic number
x-story-manager
# Skill will analyze Epic and create/replan Stories automatically
```

**Executing a Story:**
```bash
# Invoke story executor with Story ID
x-story-executor
# Skill will orchestrate task execution, reviews, and rework
```

### Typical Workflow

```
1. x-docs-creator     → Create project documentation
2. x-epic-creator     → Decompose scope into Epics
3. x-story-manager    → Create Stories for an Epic
4. x-task-manager     → Create Tasks for a Story
5. x-story-verifier   → Validate and approve Story
6. x-story-executor   → Execute all tasks in Story
7. x-story-reviewer   → Manual testing and final verification
```

For detailed usage of each skill, see [CLAUDE.md](CLAUDE.md).

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
   - Add diagrams for new skills (diagram.mmd + diagram.html)
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
├── diagram.mmd           # Mermaid workflow diagram
├── diagram.html          # Standalone HTML viewer
└── references/           # Templates and guides
    ├── template.md       # Document templates
    └── guide.md          # Reference guides
```

### Template Ownership Principle

- Each skill owns its templates in its own `references/` directory (Single Source of Truth)
- Templates are NOT copied to project during setup
- Skills use templates directly from their `references/` when generating documents
- Example: x-adr-creator uses `x-adr-creator/references/adr_template.md` when creating ADRs

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
