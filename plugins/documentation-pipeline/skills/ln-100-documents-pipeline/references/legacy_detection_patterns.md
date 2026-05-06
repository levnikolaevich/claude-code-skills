# Legacy Documentation Detection Patterns

<!-- SCOPE: Glob patterns for detecting legacy docs before standardization ONLY. Contains file patterns, content patterns, confidence levels. -->
<!-- DO NOT add here: pipeline logic → ln-100-documents-pipeline SKILL.md, document templates → templates/ -->

**Purpose:** Define patterns for detecting existing documentation in non-standard formats/locations before ln-100-documents-pipeline creates standardized documentation.

---

## File Patterns (Glob)

| Glob Pattern | Detected Type | Target Document | Confidence |
|--------------|---------------|-----------------|------------|
| `ARCHITECTURE.md` | architecture | docs/project/architecture.md | HIGH |
| `docs/ARCHITECTURE.md` | architecture | docs/project/architecture.md | HIGH |
| `architecture/*.md` | architecture | docs/project/architecture.md | MEDIUM |
| `REQUIREMENTS.md` | requirements | docs/project/requirements.md | HIGH |
| `requirements/*.md` | requirements | docs/project/requirements.md | MEDIUM |
| `STACK.md` | tech_stack | docs/project/tech_stack.md | HIGH |
| `TECH_STACK.md` | tech_stack | docs/project/tech_stack.md | HIGH |
| `API.md` | api_spec | docs/project/api_spec.md | HIGH |
| `api/*.md` | api_spec | docs/project/api_spec.md | MEDIUM |
| `openapi.yaml` | api_spec | docs/project/api_spec.md | HIGH |
| `openapi.json` | api_spec | docs/project/api_spec.md | HIGH |
| `swagger.yaml` | api_spec | docs/project/api_spec.md | HIGH |
| `swagger.json` | api_spec | docs/project/api_spec.md | HIGH |
| `DATABASE.md` | database_schema | docs/project/database_schema.md | HIGH |
| `schema/*.md` | database_schema | docs/project/database_schema.md | MEDIUM |
| `database/*.md` | database_schema | docs/project/database_schema.md | MEDIUM |
| `DEPLOYMENT.md` | runbook | docs/project/runbook.md | HIGH |
| `ops/*.md` | runbook | docs/project/runbook.md | MEDIUM |
| `deployment/*.md` | runbook | docs/project/runbook.md | MEDIUM |
| `infrastructure/*.md` | infrastructure | docs/project/infrastructure.md | MEDIUM |
| `INFRASTRUCTURE.md` | infrastructure | docs/project/infrastructure.md | HIGH |
| `documentation/**/*.md` | analyze_content | various | LOW |
| `doc/**/*.md` | analyze_content | various | LOW |
| `wiki/**/*.md` | analyze_content | various | LOW |

---

## Section Patterns (Grep in README.md)

Extract sections from README.md that should be moved to dedicated documents:

| Regex Pattern | Detected Type | Target Document |
|---------------|---------------|-----------------|
| `^## Architecture` | architecture | docs/project/architecture.md |
| `^## System Architecture` | architecture | docs/project/architecture.md |
| `^## Technical Architecture` | architecture | docs/project/architecture.md |
| `^## System Design` | architecture | docs/project/architecture.md |
| `^## Tech Stack` | tech_stack | docs/project/tech_stack.md |
| `^## Technology Stack` | tech_stack | docs/project/tech_stack.md |
| `^## Stack` | tech_stack | docs/project/tech_stack.md |
| `^## Requirements` | requirements | docs/project/requirements.md |
| `^## Features` | requirements | docs/project/requirements.md |
| `^## API` | api_spec | docs/project/api_spec.md |
| `^## Endpoints` | api_spec | docs/project/api_spec.md |
| `^## Database` | database_schema | docs/project/database_schema.md |
| `^## Schema` | database_schema | docs/project/database_schema.md |
| `^## Infrastructure` | infrastructure | docs/project/infrastructure.md |
| `^## Servers` | infrastructure | docs/project/infrastructure.md |
| `^## Deployment` | runbook | docs/project/runbook.md |
| `^## Deploy` | runbook | docs/project/runbook.md |
| `^## Installation` | runbook | docs/project/runbook.md |

---

## Section Patterns (Grep in CONTRIBUTING.md)

Extract sections from CONTRIBUTING.md that should be moved to principles.md:

| Regex Pattern | Detected Type | Target Document |
|---------------|---------------|-----------------|
| `^## Development` | principles | docs/principles.md |
| `^## Code Style` | principles | docs/principles.md |
| `^## Coding Standards` | principles | docs/principles.md |
| `^## Coding Guidelines` | principles | docs/principles.md |
| `^## Best Practices` | principles | docs/principles.md |
| `^## Conventions` | principles | docs/principles.md |

---

## Content Keywords (for `analyze_content` type)

When a file has LOW confidence (e.g., `documentation/**/*.md`), analyze content to determine type:

| Keywords | Detected Type |
|----------|---------------|
| component, layer, module, service, dependency, diagram, flow | architecture |
| requirement, user story, FR-, NFR-, use case, acceptance criteria | requirements |
| version, framework, library, runtime, npm, package.json | tech_stack |
| principle, guideline, standard, convention, anti-pattern, best practice | principles |
| endpoint, POST, GET, PUT, DELETE, request, response, HTTP, REST, API | api_spec |
| table, column, schema, migration, relation, foreign key, index, SQL | database_schema |
| server, IP, hostname, port, DNS, domain, SSL, certificate, inventory | infrastructure |
| deploy, docker, container, environment, CI/CD, pipeline, setup, install | runbook |
| design, UI, UX, component, wireframe, mockup, style, theme | design_guidelines |

**Keyword matching rules:**
- Count keyword occurrences in file
- Assign type based on highest count
- Require minimum 3 keyword matches for LOW confidence files
- If multiple types have similar counts, mark as `mixed` and show to user

---

## Extraction Rules by Type

### architecture_extractor

**Input:** Markdown file or section detected as `architecture`

**Extract:**
```json
{
  "layers": [],           // ## Layers, ## Components sections
  "components": [],       // Bulleted lists of components
  "diagrams": [],         // ```mermaid blocks, image links
  "dependencies": [],     // External system mentions
  "data_flow": ""         // ## Data Flow section content
}
```

**Extraction logic:**
1. Find `## Components` or `## Layers` sections → extract as `layers`/`components`
2. Find `## Data Flow` or `## Flow` sections → extract as `data_flow`
3. Find `mermaid` code blocks → extract as `diagrams`
4. Find image links `![...](...diagram...)` → extract as `diagrams`

---

### requirements_extractor

**Input:** Markdown file or section detected as `requirements`

**Extract:**
```json
{
  "functional": [],       // FR-001: ..., User can...
  "non_functional": [],   // NFR-001: ..., Performance...
  "user_stories": []      // As a ... I want ... So that ...
}
```

**Extraction logic:**
1. Find lines matching `FR-\d+:` → extract as `functional`
2. Find lines matching `NFR-\d+:` → extract as `non_functional`
3. Find lines matching `As a .* I want .* so that` → extract as `user_stories`
4. Find bulleted lists under `## Features` → extract as `functional`

---

### tech_stack_extractor

**Input:** Markdown file or section detected as `tech_stack`

**Extract:**
```json
{
  "frontend": "",         // React, Vue, Angular
  "backend": "",          // Express, FastAPI, Django
  "database": "",         // PostgreSQL, MongoDB
  "cache": "",            // Redis, Memcached
  "versions": {}          // { "react": "18.2", "node": "20" }
}
```

**Extraction logic:**
1. Find table with `| Technology | Version |` → parse rows
2. Find bulleted lists under `## Frontend`, `## Backend` → categorize
3. Extract version numbers from patterns like `React 18`, `Node.js v20`

---

### principles_extractor

**Input:** Markdown file or section detected as `principles`

**Extract:**
```json
{
  "principles": [],       // Numbered or bulleted principles
  "anti_patterns": [],    // ## Anti-Patterns section
  "conventions": []       // Naming conventions, code style rules
}
```

**Extraction logic:**
1. Find numbered lists (`1.`, `2.`) under development sections → extract as `principles`
2. Find `## Anti-Patterns` or `## Don't` sections → extract as `anti_patterns`
3. Find code style rules (e.g., "Use camelCase") → extract as `conventions`

---

### api_spec_extractor

**Input:** Markdown file, OpenAPI YAML/JSON, or section detected as `api_spec`

**Extract:**
```json
{
  "endpoints": [],        // [{ method, path, description }]
  "base_url": "",         // API base URL
  "authentication": "",   // Auth method description
  "openapi_version": ""   // If OpenAPI file
}
```

**Extraction logic:**
1. If OpenAPI file → parse paths, extract endpoints
2. Find patterns like `GET /api/users` → extract as `endpoints`
3. Find `## Authentication` section → extract as `authentication`

---

### database_schema_extractor

**Input:** Markdown file or section detected as `database_schema`

**Extract:**
```json
{
  "tables": [],           // [{ name, columns: [] }]
  "relationships": [],    // Foreign key descriptions
  "indexes": [],          // Index definitions
  "erd_diagram": ""       // Mermaid ERD or image
}
```

**Extraction logic:**
1. Find SQL DDL `CREATE TABLE` → parse table structures
2. Find `## Tables` sections with tables → extract
3. Find mermaid `erDiagram` blocks → extract as `erd_diagram`

---

### infrastructure_extractor

**Input:** Markdown file or section detected as `infrastructure`

**Extract:**
```json
{
  "servers": [],          // [{ role, hostname, ip, os, specs }]
  "domains": [],          // [{ domain, target, purpose }]
  "ports": {},            // { "server_name": [{ port, service, protocol }] }
  "services": [],         // [{ name, image, server, notes }]
  "artifacts": {},        // { url, repository, credentials_management }
  "cicd": {}              // { platform, config_file, trigger, deploy_path }
}
```

**Extraction logic:**
1. Find tables with `Role | IP` or `Hostname` headers → extract as `servers`
2. Find `## Domain` or `## DNS` sections → extract as `domains`
3. Find `## Port` sections with port tables → extract as `ports`
4. Find `## Service` or `## Deployed` sections → extract as `services`
5. Find `## Artifact` sections → extract as `artifacts`
6. Find `## CI/CD` or `## Pipeline` sections → extract as `cicd`

---

### runbook_extractor

**Input:** Markdown file or section detected as `runbook`

**Extract:**
```json
{
  "prerequisites": [],    // ## Prerequisites section
  "install_steps": [],    // Numbered installation steps
  "run_commands": {},     // { "dev": "npm run dev", "build": "..." }
  "env_vars": [],         // Environment variable names
  "deploy_steps": []      // Deployment instructions
}
```

**Extraction logic:**
1. Find `## Prerequisites` → extract as `prerequisites`
2. Find numbered lists under `## Installation` → extract as `install_steps`
3. Find code blocks with shell commands → extract as `run_commands`
4. Find `$VAR_NAME` or `VAR_NAME=` patterns → extract as `env_vars`

---

## Quality Scoring

Score extracted content quality (0.0-1.0):

| Score Range | Quality | Description |
|-------------|---------|-------------|
| 0.8-1.0 | HIGH | Structured content, clear sections, follows patterns |
| 0.5-0.7 | MEDIUM | Partial structure, some useful content |
| 0.0-0.4 | LOW | Unstructured, minimal usable content |

**Scoring factors:**
- +0.2: Has clear markdown headers (##, ###)
- +0.2: Has structured lists (numbered or bulleted)
- +0.2: Has code blocks with relevant content
- +0.2: Content length > 200 words
- +0.2: No TODO/TBD/FIXME markers
- -0.3: More than 50% placeholder text
- -0.2: Inconsistent formatting

---

## Skip Patterns

Do NOT detect as legacy (these are expected to remain):

| Pattern | Reason |
|---------|--------|
| `README.md` (without extracted sections) | Keep as project overview |
| `CLAUDE.md` | Claude Code instructions |
| `LICENSE*` | License files |
| `CHANGELOG*` | Version history |
| `.github/**/*.md` | GitHub templates |
| `docs/reference/**/*.md` | Already in standard location |
| `docs/project/**/*.md` | Already in standard location |
| `docs/tasks/**/*.md` | Already in standard location |
| `node_modules/**` | Dependencies |
| `vendor/**` | Dependencies |

---

**Version:** 1.0.0
**Last Updated:** 2025-12-19
