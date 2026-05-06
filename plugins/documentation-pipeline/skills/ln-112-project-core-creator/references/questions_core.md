# Project Core Documentation Questions (Q23-Q38)

<!-- SCOPE: Interactive questions for 3 core docs (requirements.md, architecture.md, tech_stack.md) ONLY. -->
<!-- DO NOT add here: question logic → ln-112-project-core-creator SKILL.md, other doc questions → questions_root.md, questions_backend.md -->

**Purpose:** Validation questions for 3 core project documentation files.

**Format:** Document -> Rules -> Questions -> Validation Heuristics -> Auto-Discovery

---

## Table of Contents

| Document | Questions | Auto-Discovery | Priority |
|----------|-----------|----------------|----------|
| [requirements.md](#docsprojectrequirementsmd) | 1 | Low | Critical |
| [architecture.md](#docsprojectarchitecturemd) | 11 | High | Critical |
| [tech_stack.md](#docsprojecttechstackmd) | 4 | High | High |

---

<!-- DOCUMENT_START: docs/project/requirements.md -->
## docs/project/requirements.md

**File:** docs/project/requirements.md (functional requirements ONLY)
**Target Sections:** Functional Requirements

**Rules:**
- ISO/IEC/IEEE 29148:2018 compliant
- FR-XXX-NNN identifiers for all requirements
- MoSCoW prioritization (MUST/SHOULD/COULD/WONT)
- User stories or acceptance criteria format
- **NO NFR content** (availability, latency, SLA, SLO, throughput, uptime) - requirements describe WHAT, not HOW WELL

---

<!-- QUESTION_START: 23 -->
### Question 23: What functionality must the system provide?

**Expected Answer:** Numbered list with FR-XXX-NNN identifiers, MoSCoW priorities, user stories
**Target Section:** ## Functional Requirements

**Validation Heuristics:**
- Has FR-XXX identifiers (e.g., FR-001, FR-USR-001)
- Has MoSCoW labels (MUST/SHOULD/COULD/WONT)
- Length > 100 words
- Has numbered list or table

**Auto-Discovery:**
- Check: package.json -> "description"
- Check: README.md for feature mentions
- Check: existing docs for use case descriptions

**MCP Ref Hints:**
- Research: "functional requirements best practices"
- Research: "MoSCoW prioritization method"
<!-- QUESTION_END: 23 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has FR-XXX identifiers
- Has MoSCoW labels
- **NO NFR terminology:** "availability", "uptime", "latency", "SLA", "SLO", "p95", "p99", "throughput", "99.9%"

<!-- DOCUMENT_END: docs/project/requirements.md -->

---

<!-- DOCUMENT_START: docs/project/architecture.md -->
## docs/project/architecture.md

**File:** docs/project/architecture.md (arc42 framework with C4 Model)
**Target Sections:** 11 arc42 sections

**Rules:**
- ISO/IEC/IEEE 42010:2022 compliant
- arc42 framework structure (11 sections)
- C4 Model diagrams (Context, Container, Component)
- Mermaid syntax for all diagrams

---

<!-- QUESTION_START: 24 -->
### Question 24: What are the key quality goals and stakeholders?

**Expected Answer:** Requirements overview, 5 quality goals with metrics, stakeholders table
**Target Section:** ## 1. Introduction and Goals

**Validation Heuristics:**
- Has subsections 1.1, 1.2, 1.3
- Quality goals have measurable metrics
- Stakeholders table has roles and expectations
- References requirements.md

**Auto-Discovery:**
- Check: package.json -> "author" for stakeholder hints

**MCP Ref Hints:**
- Research: "arc42 quality goals"
- Research: "ISO 25010 quality attributes"
<!-- QUESTION_END: 24 -->

---

<!-- QUESTION_START: 25 -->
### Question 25: What technical and organizational constraints exist?

**Expected Answer:** Technical constraints, organizational constraints, conventions
**Target Section:** ## 2. Constraints

**Validation Heuristics:**
- Has subsections 2.1 (Technical), 2.2 (Organizational), 2.3 (Conventions)
- Mentions specific technologies
- Lists compliance requirements (GDPR, HIPAA, etc.)

**Auto-Discovery:**
- Check: package.json -> "dependencies"
- Check: .eslintrc, .prettierrc for code style
- Check: tsconfig.json for conventions
<!-- QUESTION_END: 25 -->

---

<!-- QUESTION_START: 26 -->
### Question 26: What are the system boundaries and external interfaces?

**Expected Answer:** Business context, technical context, C4 Context diagram
**Target Section:** ## 3. Context and Scope

**Validation Heuristics:**
- Has subsections 3.1 (Business), 3.2 (Technical)
- Has Mermaid C4 Context diagram
- Lists external systems and protocols

**Auto-Discovery:**
- Check: package.json for external service clients (stripe, aws-sdk)
- Check: .env.example for API_URL, DATABASE_URL
<!-- QUESTION_END: 26 -->

---

<!-- QUESTION_START: 27 -->
### Question 27: What are the top-level architectural decisions?

**Expected Answer:** Technology decisions table, decomposition approach, ADR links
**Target Section:** ## 4. Solution Strategy

**Validation Heuristics:**
- Has subsections 4.1, 4.2, 4.3
- Technology table references ADRs
- Explains architecture pattern choice

**Auto-Discovery:**
- Check: package.json for frameworks
- Check: src/ structure for pattern
<!-- QUESTION_END: 27 -->

---

<!-- QUESTION_START: 28 -->
### Question 28: How is the system decomposed into components?

**Expected Answer:** C4 diagrams (Level 1, 2, 3), components table
**Target Section:** ## 5. Building Block View

**Validation Heuristics:**
- Has subsections 5.1 (L1), 5.2 (L2), 5.3 (L3)
- Has 3 Mermaid C4 diagrams
- Has components table with responsibilities

**Auto-Discovery:**
- Scan: src/ for folders (controllers, services, repositories)
- Check: package.json -> "main"
<!-- QUESTION_END: 28 -->

---

<!-- QUESTION_START: 29 -->
### Question 29: What are the critical runtime scenarios?

**Expected Answer:** 3-5 scenarios with sequence diagrams
**Target Section:** ## 6. Runtime View

**Validation Heuristics:**
- Has 3+ subsections (6.1, 6.2, 6.3)
- Each has Mermaid sequence diagram
- Scenarios align with requirements

**Auto-Discovery:**
- Check: requirements.md for use cases
- Check: api_spec.md for endpoint flows
<!-- QUESTION_END: 29 -->

---

<!-- QUESTION_START: 30 -->
### Question 30: What concepts apply across the system?

**Expected Answer:** Security, Error Handling, Configuration, Data Access patterns
**Target Section:** ## 7. Crosscutting Concepts

**Validation Heuristics:**
- Has subsections 7.1 (Security), 7.2 (Error), 7.3 (Config), 7.4 (Data)
- Each > 50 words
- References specific libraries

**Auto-Discovery:**
- Check: package.json for auth libraries (passport, jwt)
- Check: .env.example for configuration
- Check: src/models for data access
<!-- QUESTION_END: 30 -->

---

<!-- QUESTION_START: 31 -->
### Question 31: What are key architecture decisions?

**Expected Answer:** ADR list, critical ADRs summary
**Target Section:** ## 8. Architecture Decisions (ADRs)

**Validation Heuristics:**
- Has ADR links or {{ADR_LIST}} placeholder
- Has "Critical ADRs Summary" subsection
- Links to docs/reference/adrs/

**Auto-Discovery:**
- Scan: docs/reference/adrs/*.md
- Read: ADR titles from files
<!-- QUESTION_END: 31 -->

---

<!-- QUESTION_START: 32 -->
### Question 32: What are quality scenarios and metrics?

**Expected Answer:** Quality tree (ISO 25010), quality scenarios table
**Target Section:** ## 9. Quality Requirements

**Validation Heuristics:**
- Has subsections 9.1 (Tree), 9.2 (Scenarios)
- Scenarios have testable criteria
- References ISO 25010

**Auto-Discovery:**
- Check: Section 1.2 Quality Goals
<!-- QUESTION_END: 32 -->

---

<!-- QUESTION_START: 33 -->
### Question 33: What are known risks and technical debt?

**Expected Answer:** Risks list, technical debt table, mitigations
**Target Section:** ## 10. Risks and Technical Debt

**Validation Heuristics:**
- Has subsections 10.1, 10.2, 10.3
- Technical debt has timeline
- Risks have likelihood/impact

**Auto-Discovery:**
- Check: package.json for outdated deps
- Scan: TODO/FIXME comments
<!-- QUESTION_END: 33 -->

---

<!-- QUESTION_START: 34 -->
### Question 34: What domain terms need definition?

**Expected Answer:** Terms table with definitions
**Target Section:** ## 11. Glossary

**Validation Heuristics:**
- Has table with Term | Definition
- Contains C4/architecture terms
- Includes domain-specific terms

**Auto-Discovery:**
- Scan: docs for domain terms
- Extract: technical acronyms
<!-- QUESTION_END: 34 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has 11 numbered sections
- Has C4 diagrams in Mermaid
- References arc42/ISO/IEC/IEEE 42010

<!-- DOCUMENT_END: docs/project/architecture.md -->

---

<!-- DOCUMENT_START: docs/project/tech_stack.md -->
## docs/project/tech_stack.md

**File:** docs/project/tech_stack.md (technology stack)
**Target Sections:** Frontend, Backend, Database, Additional

**Rules:**
- Technology table with Name, Version, Rationale, ADR Link
- Docker configuration if applicable
- Version pinning and upgrade strategy

---

<!-- QUESTION_START: 35 -->
### Question 35: What frontend technologies are used?

**Expected Answer:** Framework, version, rationale, key libraries
**Target Section:** ## Frontend Technologies

**Validation Heuristics:**
- Mentions framework (React, Vue, Angular, Svelte)
- Has version number
- Has rationale explanation
- Lists key libraries

**Auto-Discovery:**
- Check: package.json for react, vue, @angular/core, svelte
- Extract: version numbers
<!-- QUESTION_END: 35 -->

---

<!-- QUESTION_START: 36 -->
### Question 36: What backend technologies are used?

**Expected Answer:** Runtime, framework, version, rationale
**Target Section:** ## Backend Technologies

**Validation Heuristics:**
- Mentions runtime + framework
- Has version numbers
- Has rationale

**Auto-Discovery:**
- Check: package.json (express, fastify, nestjs)
- Check: requirements.txt (fastapi, django)
- Check: go.mod (gin, echo)
<!-- QUESTION_END: 36 -->

---

<!-- QUESTION_START: 37 -->
### Question 37: What database technologies are used?

**Expected Answer:** Database type, version, rationale
**Target Section:** ## Database

**Validation Heuristics:**
- Mentions database name
- Has version
- Has rationale (ACID, performance)

**Auto-Discovery:**
- Check: package.json (pg, mongoose, mysql2)
- Check: docker-compose.yml for database services
<!-- QUESTION_END: 37 -->

---

<!-- QUESTION_START: 38 -->
### Question 38: What other key technologies are used?

**Expected Answer:** Caching, message queue, search, file storage
**Target Section:** ## Additional Technologies

**Validation Heuristics:**
- Lists categories with technologies
- Each has version and rationale

**Auto-Discovery:**
- Check: package.json (redis, amqplib, kafkajs)
- Check: docker-compose.yml for services
<!-- QUESTION_END: 38 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has technology tables with versions
- Has rationale for each choice

<!-- DOCUMENT_END: docs/project/tech_stack.md -->

---

**Total Questions:** 16
**Total Documents:** 3

---
**Version:** 1.0.0
**Last Updated:** 2025-12-19
