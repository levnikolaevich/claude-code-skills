# Technical Questions for Project Documentation

<!-- SCOPE: 23 critical technical questions for project documentation ONLY. Contains priority order, auto-discovery rules, category groupings. -->
<!-- DO NOT add here: Question implementation → ln-110-project-docs-coordinator SKILL.md, L3 workers → ln-111 through ln-115 SKILL.md -->

These 23 technical questions MUST be answered before creating project documentation. They are grouped into 6 categories for structured technical discovery.

**Focus**: This document is **purely technical** - no business metrics, stakeholder management, or budget planning. For technical teams documenting architecture, requirements, and implementation details.

## Priority Order: Context First, Questions Last

**CRITICAL**: Interactive questions are the LAST RESORT. Follow this priority order:

1. **Auto-Discovery (Phase 1.2)** - ALWAYS attempt first
   - Search for: package.json, Dockerfile, docker-compose.yml, requirements.txt, pyproject.toml, pom.xml, build.gradle, go.mod, README.md
   - Extract: Q9 (runtime versions), Q12 (frameworks, databases, dependencies)
   - Benefits: Zero user effort, reduces questions by 2-4

2. **User Materials (Phase 1.3)** - MANDATORY question
   - ALWAYS ask: "Do you have existing materials I should review? (design docs, specs, requirements, legacy docs, diagrams, API contracts)"
   - If YES: Read and extract answers for Q1-Q23 from materials
   - Benefits: Can reduce questions by 10-18 depending on material completeness

3. **Best Practices Research (Phase 1.4)** - AUTO research
   - Use MCP Ref to verify 2025 library versions (supplements Q12)
   - Use WebSearch for architectural patterns (supplements Q11)
   - Use WebSearch for integration best practices (supplements Q13)
   - Benefits: Provides current best practices, reduces technical decision questions

4. **Interactive Questions (Phase 2)** - ONLY for remaining questions
   - Ask ONLY questions that could NOT be auto-discovered, extracted from materials, or researched
   - Show progress: "Already gathered X/23 questions, asking Y remaining questions"
   - Benefits: Minimizes user effort, maximizes efficiency

**Example Impact**:
- Optimal scenario (with materials): 18/23 answered automatically → ask only 5 questions
- Typical scenario (no materials): 4/23 answered automatically → ask 19 questions
- Greenfield project: 6/23 answered from materials + research → ask 17 questions

## Question Metadata (3-Stage Discovery)

| Question | Category | Stage | Mode | Research Tools |
|----------|----------|-------|------|----------------|
| Q1-Q3 | Requirements | 1 | interactive | - |
| Q5-Q8 | Scope | 1 | interactive | - |
| Q9 | Tech Stack | 2 | auto-discoverable | package.json, Dockerfile, docker-compose.yml |
| Q10 | Tech Stack | 2 | interactive | - |
| Q11 | Tech Stack | 2 | auto-researchable | WebSearch |
| Q12 | Tech Stack | 2 | auto-discoverable + researchable | package.json + MCP Ref |
| Q13 | Tech Stack | 2 | auto-researchable | WebSearch |
| D1-D6 | Design Guidelines | 2 | interactive | - |
| O1-O3 | Operations | 2 | semi-auto | Dockerfile, docker-compose.yml |
| R1-R2 | Risks | 2 | interactive | - |

**Stage 0 (Context Research - BEFORE asking questions)**: ALWAYS attempt auto-discovery (Q9, Q12 from package.json/Dockerfile), ALWAYS ask for user materials (may answer Q1-Q23), ALWAYS research best practices (Q11, Q13 via MCP Ref/WebSearch). This stage can reduce interactive questions by 20-75%.

**Stage 1 (Understand Requirements)**: Ask REMAINING questions from Q1-Q3, Q5-Q8 that were NOT answered in Stage 0. Skip questions already extracted from materials.

**Stage 2 (Research & Design)**: Ask REMAINING questions from Q10, D1-D6, O1-O3, R1-R2. Questions Q9, Q11, Q12, Q13 likely already answered in Stage 0 (auto-discovery + research).

---

## Category 1: Requirements (3 questions)

### Q1: What are the high-level technical acceptance criteria?
**Why important**: Defines what "done" looks like from a technical perspective.
**Example answer**: "Users can register via JWT auth, search products with <500ms latency, complete checkout with Stripe payment webhook handling"

### Q2: What is the Minimum Viable Product (MVP) from a technical standpoint?
**Why important**: Defines Phase 1 technical scope and fastest path to functional system.
**Example answer**: "REST API with auth, CRUD for products, shopping cart in Redis, Stripe payment integration, PostgreSQL database"

### Q3: Are all functional requirements technically defined and agreed?
**Why important**: Prevents mid-project requirement discovery and scope changes.
**Example answer**: "Yes, 15 functional requirements documented with IDs (FR-UM-001: User Registration, FR-PM-001: Product Listing, etc.) and technical acceptance criteria"

---

## Category 2: Scope (4 questions)

### Q5: What is technically IN SCOPE?
**Why important**: Defines technical boundaries and prevents misunderstandings about what will be built.
**Example answer**: "Microservices architecture (Product, Order, Payment services), PostgreSQL + Redis, REST API, JWT auth, Stripe integration, AWS ECS deployment"

### Q6: What is technically OUT OF SCOPE?
**Why important**: Manages expectations and prevents technical feature creep.
**Example answer**: "No mobile native apps (web-responsive only), no AI/ML recommendations, no cryptocurrency payments, no GraphQL (REST only), no Kubernetes (ECS Fargate only)"

### Q7: Where are the technical boundaries and integration points?
**Why important**: Clarifies interfaces with external systems and services.
**Example answer**: "External APIs: Stripe (payments), SendGrid (emails), AWS S3 (images). Internal: API Gateway routes to 4 microservices, Redis Pub/Sub for events"

### Q8: Who are the technical user roles and what are their permissions?
**Why important**: Defines authentication and authorization requirements.
**Example answer**: "3 roles: Customer (browse, cart, checkout), Vendor (manage own products, view sales), Admin (platform config, user management)"

---

## Category 3: Technology Stack (5 questions)

### Q9: What technology decisions have already been made?
**Why important**: Identifies constraints and pre-existing technical commitments.
**Example answer**: "Must use: AWS (company standard), PostgreSQL (existing DBA expertise), Node.js (team skillset). Cannot use: MongoDB (no in-house experience)"

### Q10: What are the hard technical constraints?
**Why important**: Defines non-negotiable limitations that affect architecture.
**Example answer**: "Must deploy to AWS us-east-1 (company policy), must comply with PCI DSS Level 1 (no card storage), cannot use Kubernetes (team lacks experience - use ECS Fargate), must integrate with legacy SOAP API (blocking dependency), cannot use serverless (compliance restrictions)"

### Q11: What architectural patterns will be used?
**Why important**: Defines overall system structure and design approach.
**Example answer**: "Microservices architecture (4 services), Event-Driven communication (Redis Pub/Sub), REST API, Stateless services for horizontal scaling"

### Q12: What libraries and frameworks will be used?
**Why important**: Defines technical stack and team training needs.
**Example answer**: "Frontend: React 18 + Next.js 14 + Tailwind CSS. Backend: Node.js 20 + Express + Prisma ORM. Testing: Jest + Supertest + Playwright"

### Q13: What integrations with existing systems are required?
**Why important**: Identifies dependencies and integration complexity.
**Example answer**: "Integrate with: Legacy inventory system (SOAP API), Stripe (REST API), SendGrid (REST API), AWS S3 (SDK), existing user database (read-only PostgreSQL replica)"

---

## Category 4: Design Guidelines (6 questions)

### D1: What typography and color system should be used?
**Why important**: Defines visual consistency and brand identity for frontend projects.
**Example answer**: "Primary font: Inter (body), Poppins (headings). Colors: Primary #FF6B35 (orange), Secondary #004E89 (blue), Accent #1A936F (teal). WCAG 2.1 AA contrast ratios (4.5:1 text)"

### D2: What component library and UI patterns should be implemented?
**Why important**: Ensures consistent user experience and speeds up development.
**Example answer**: "Buttons: Primary/Secondary/Text variants. Forms: Input fields with validation states. Cards: Default/Hover/Interactive. Modals: Backdrop + centered content. Tables: Sortable headers + pagination"

### D3: What are the responsive breakpoints?
**Why important**: Defines how UI adapts across devices.
**Example answer**: "Mobile (<768px): 1-column stacked, Tablet (768-1024px): 2-column grid, Desktop (>1024px): 3-column grid + sidebar. Min tap target: 44x44px"

### D4: What accessibility standards must be met?
**Why important**: Ensures inclusive design for users with disabilities.
**Example answer**: "WCAG 2.1 Level AA compliance: Keyboard navigation (all features), Screen reader support (ARIA labels), Color contrast 4.5:1 (text), Focus indicators (ring-2 ring-primary)"

### D5: What branding and imagery guidelines apply?
**Why important**: Maintains consistent brand identity across the platform.
**Example answer**: "Logo: Min 32px height, clear space equals logo height. Hero images: 16:9 aspect ratio, min 1920x1080px. Stock photos: Professional, diverse, authentic (no clichés)"

### D6: What design system or inspiration should be referenced?
**Why important**: Provides design direction and accelerates UI development.
**Example answer**: "Primary reference: Airbnb Design System (professional, user-friendly). Secondary influences: Material Design (components), Tailwind CSS (utility-first), Carbon Design (enterprise patterns)"

---

## Category 5: Operations (3 questions)

### O1: What is the development environment setup?
**Why important**: Defines how developers run the project locally.
**Example answer**: "Docker Compose with 5 services: app (Node.js), db (PostgreSQL), cache (Redis), queue (RabbitMQ), nginx (reverse proxy). Commands: `docker compose up -d`, `docker compose exec app npm run migrate`"

### O2: What are the deployment procedures?
**Why important**: Defines how code reaches production safely.
**Example answer**: "CI/CD: GitHub Actions → Build Docker image → Push to ECR → Deploy to ECS Fargate (rolling update). Environments: Dev (auto-deploy main), Staging (manual approval), Production (manual approval + rollback plan)"

### O3: What monitoring and troubleshooting tools are used?
**Why important**: Enables rapid incident detection and resolution.
**Example answer**: "Logs: CloudWatch Logs (centralized). Metrics: CloudWatch + Grafana dashboards (latency, errors, throughput). Alerts: PagerDuty (>5% error rate, p95 >500ms). SSH: Bastion host access for production debugging"

---

## Category 6: Technical Risks (2 questions)

### R1: What are the key technical risks?
**Why important**: Identifies potential technical failures that need mitigation.
**Example answer**: "Risk 1: Stripe outage blocks transactions (mitigation: retry logic + queue). Risk 2: Database becomes bottleneck (mitigation: read replicas + Redis caching). Risk 3: Microservice network failures (mitigation: circuit breakers + timeouts)"

### R2: What are the critical technical dependencies?
**Why important**: Identifies external factors that could block or delay development.
**Example answer**: "Hard dependencies: AWS account approval (1 week), Stripe merchant account (2 weeks), Legacy API documentation (blocking integration). Team dependencies: 1 senior Node.js dev (key person risk)"

---

## Question Priority Levels

All 23 questions are **MUST-ANSWER** for complete technical documentation. Some questions (D1-D6) are frontend-specific and can be skipped for backend-only or API-only projects.

---

## How to Use This Document

**IMPORTANT**: Follow Priority Order (Context First, Questions Last) defined above.

1. **Stage 0 - Context Research (Phase 1)**:
   - **1.2 Auto-Discovery**: Use Glob to find package.json/Dockerfile/docker-compose.yml → Extract Q9, Q12
   - **1.3 User Materials**: ALWAYS ask "Do you have materials to review?" → Read and extract Q1-Q23
   - **1.4 Research**: Use MCP Ref for Q12 (2025 versions), WebSearch for Q11 (patterns), Q13 (integrations)
   - **Track**: Mark which questions answered in Stage 0

2. **Stage 1-2 - Interactive Questions (Phase 2)**:
   - **Review**: Display "Already gathered: X/23 questions" to user
   - **Ask ONLY remaining**: Skip questions answered in Stage 0
   - **Batch questions**: Show progress "Category X of 6 (asking Y remaining questions)"
   - **Capture Answers**: Record with question IDs for traceability

3. **Map to Documents**: Use answers (from Stage 0 or Stage 1-2) to populate:
   - `requirements.md` ← Q1, Q3
   - `architecture.md` ← Q5, Q6, Q7, Q9, Q10, Q11, Q12, Q13
   - `tech_stack.md` ← Q9, Q10, Q11, Q12
   - `api_spec.md` ← Q8, Q13
   - `database_schema.md` ← Q9, Q12
   - `design_guidelines.md` ← D1-D6
   - `runbook.md` ← O1-O3

4. **Validate Completeness**: Ensure all relevant questions have clear answers (skip D1-D6 for backend-only projects)
5. **Iterate if Needed**: If answers are unclear or incomplete, ask follow-up questions

---

## Example Discovery Flow (Context-First Approach)

**Stage 0 - Context Research (BEFORE asking questions)**

**Step 1: Auto-Discovery**
```
Assistant: "Starting context research...

✓ Auto-discovered from package.json:
  - Q9: Node.js 20, React 18
  - Q12: Express, Prisma ORM, PostgreSQL, Jest, Tailwind CSS

✓ Auto-discovered from Dockerfile:
  - Q9: Production runtime: Node.js 20 Alpine
```

**Step 2: Request User Materials**
```
Assistant: "Do you have existing materials I should review before asking questions?
Examples: design documents, technical specifications, requirements docs, legacy system documentation, architectural diagrams, API contracts."

User: "Yes, here's our design doc and technical spec."
```

**Step 3: Extract from Materials**
```
Assistant: "Reading materials...

✓ Extracted from design doc:
  - Q1: Acceptance criteria defined (user registration, product search <500ms, Stripe checkout)
  - Q5: In scope (microservices, PostgreSQL, REST API, JWT auth, Stripe, AWS ECS)
  - Q6: Out of scope (no mobile apps, no AI/ML, no cryptocurrency, no GraphQL, no Kubernetes)
  - Q7: Integrations: Stripe (payments), SendGrid (emails), AWS S3 (images)
  - D1-D6: Full design system documented

✓ Extracted from technical spec:
  - Q3: All functional requirements defined with IDs (15 requirements)
  - Q10: Hard constraints (AWS us-east-1, PCI DSS Level 1, no serverless)
  - Q11: Microservices architecture
  - R1-R2: Technical risks and dependencies documented

Total extracted: 18/23 questions"
```

**Step 4: Research Best Practices**
```
Assistant: "Researching 2025 best practices...

✓ Researched via MCP Ref:
  - Q12: Verified 2025 versions (Express 5.0, Prisma 6.0, Jest 30.0, Tailwind 4.0)

✓ Researched via WebSearch:
  - Q11: Microservices best practices {current_year} (event-driven, API Gateway patterns)
  - Q13: Stripe API {current_year} best practices (webhook security, idempotency)

Total gathered in Stage 0: 21/23 questions"
```

**Stage 1-2 - Interactive Questions (ONLY remaining)**

**Batch 1 - Remaining Questions**
```
Assistant: "✓ Context Research complete!

Information already gathered (21/23 questions):
- Auto-discovered: Q9, Q12 (from package.json/Dockerfile)
- Extracted from materials: Q1, Q3, Q5, Q6, Q7, Q10, Q11, D1-D6, R1-R2
- Researched: Q11, Q12, Q13

Remaining questions: 2 questions

Category 1 of 6: Requirements (asking 1 remaining question)
Q2: What is the Minimum Viable Product (MVP) from a technical standpoint?

Category 2 of 6: Scope (asking 1 remaining question)
Q8: Who are the technical user roles and what are their permissions?

Please provide your answers."
```

---

**Key Insight**: Context-first approach reduced interactive questions from 23 → 2 (91% reduction), saving significant user time and ensuring data accuracy from authoritative sources.

---

**Version:** 4.0.0 (MAJOR: Added Priority Order and Stage 0 Context Research)
**Last Updated:** 2025-11-17
**Changes from v3.0.0:**
- Added "Priority Order: Context First, Questions Last" section at top
- Added Stage 0 (Context Research) before Stage 1-2
- Updated "Question Metadata" to "3-Stage Discovery"
- Updated Stage descriptions to emphasize REMAINING questions only
- Updated "How to Use This Document" with Stage 0 workflow
- Updated examples to show context-first approach (91% question reduction)
- Clarified that interactive questions are LAST RESORT
