<!-- SOURCE-OF-TRUTH: shared/references/documentation_creation.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Documentation Creation

<!-- SCOPE: Standardized documentation creation workflow. Doc types, templates, naming, format rules, output contract. -->
<!-- DO NOT add here: research methodology → research_methodology.md, tool fallback → research_tool_fallback.md -->

Unified documentation creation rules for inline doc generation.

---

## Stack Detection

| Indicator | Stack | Query Prefix | Official Docs |
|-----------|-------|--------------|---------------|
| `*.csproj`, `*.sln` | .NET | "C# ASP.NET Core" | Microsoft docs |
| `package.json` + `tsconfig.json` | Node.js | "TypeScript Node.js" | MDN, npm docs |
| `requirements.txt`, `pyproject.toml` | Python | "Python" | Python docs, PyPI |
| `go.mod` | Go | "Go Golang" | Go docs |
| `Cargo.toml` | Rust | "Rust" | Rust docs |
| `build.gradle`, `pom.xml` | Java | "Java" | Oracle docs, Maven |

---

## Doc Type Workflow

| doc_type | Purpose | Template | Output Path | Naming | Words |
|----------|---------|----------|-------------|--------|-------|
| **guide** | Pattern with Do/Don't/When table | `references/templates/guide_template.md` | `docs/guides/` | `NN-[slug].md` | 300-500 |
| **manual** | API/library reference | `references/templates/manual_template.md` | `docs/manuals/` | `[pkg]-[ver].md` | 300-500 |
| **adr** | Architecture decision | `references/templates/adr_template.md` | `docs/adrs/` | `adr-NNN-[slug].md` | 300-500 |
| **research** | Investigation answering question | `references/templates/research_template.md` | `docs/research/` | `rsh-NNN-[slug].md` | 300-700 |

**Workflow:** Detect number (scan target dir) -> Research -> Generate from template -> Validate -> Save -> Return path

---

## Section Requirements by doc_type

| doc_type | Required Sections |
|----------|-------------------|
| **guide** | Principle, Our Implementation, Patterns table, Sources, Related |
| **manual** | Package info, Overview, Methods table, Config table, Limitations |
| **adr** | Context, Decision, Rationale, Alternatives table, Consequences, Related |
| **research** | Question, Context, Methodology, Findings (tables!), Conclusions, Next Steps, Sources |

---

## Validation Specifics

| doc_type | Validation |
|----------|------------|
| **guide** | Patterns table present |
| **manual** | Version in filename |
| **adr** | ISO date, status field |
| **all** | Sources <=1 year old |

---

## ADR Dialog (5 Questions)

Answer internally before generating ADR content:

1. **Q1:** Title?
2. **Q2:** Category (Strategic / Technical)?
3. **Q3:** Context?
4. **Q4:** Decision + Rationale?
5. **Q5:** Alternatives (2 with pros/cons)?

---

## Mandatory File Creation

- ALL documentation creation MUST end with file creation
- Create target directory if missing (`docs/guides/`, `docs/manuals/`, `docs/adrs/`, `docs/research/`)
- No exceptions — file creation is required for ALL invocations

---

## NO_CODE Rule

| Forbidden | Allowed |
|-----------|---------|
| Code snippets | Tables (params, config, alternatives) |
| Implementation examples | ASCII diagrams, Mermaid diagrams |
| Code blocks >1 line | Method signatures (1 line inline) |
| | Links to official docs |

---

## Format Priority (STRICT)

| Content Type | Format |
|--------------|--------|
| Parameters | Table: Name / Type / Required / Default |
| Configuration | Table: Option / Type / Default / Description |
| Alternatives | Table: Alt / Pros / Cons / Why Rejected |
| Patterns | Table: Do / Don't / When |
| Workflow | ASCII diagram: `A -> B -> C` |

---

## Other Rules

- Research ONCE per invocation; reuse results
- Cite sources with versions/dates (<=1 year old)
- One pattern per guide; one decision per ADR; one package per manual
- Preserve language (EN/RU) from story_context
- Link to stack-appropriate docs (Microsoft for .NET, MDN for JS, etc.)

---

## Output Contract

Each inline documentation creation MUST return:
- `doc_path`: full path to created file
- `doc_type`: guide|manual|adr|research
- `status`: created|existing (skip if doc already exists at target path)
- `numbering_basis`: next sequential number (scan target dir for existing files)

Dedup rule: Glob target dir BEFORE creating. If file with matching slug exists, status=existing, add link only.

---

**Version:** 1.0.0
**Last Updated:** 2026-03-20
