# Technical Questions for Project Documentation

These 19 technical questions MUST be answered before creating project documentation. They are grouped into 5 categories for structured technical discovery.

**Focus**: This document is **purely technical** - no business metrics, stakeholder management, or budget planning. For technical teams documenting architecture, requirements, and implementation details.

## Question Metadata (2-Stage Discovery)

| Question | Category | Stage | Mode | Research Tools |
|----------|----------|-------|------|----------------|
| Q1-Q4 | Requirements | 1 | interactive | - |
| Q5-Q8 | Scope | 1 | interactive | - |
| Q9 | Tech Stack | 2 | auto-researchable | MCP Ref, WebSearch |
| Q10 | Tech Stack | 2 | interactive | - |
| Q11 | Tech Stack | 2 | auto-researchable | WebSearch |
| Q12 | Tech Stack | 2 | auto-researchable | MCP Ref, WebSearch |
| Q13 | Tech Stack | 2 | auto-researchable | WebSearch |
| Q14-Q17 | Quality | 2 | interactive | - |
| Q18-Q19 | Risks | 2 | interactive | - |

**Stage 1 (Understand Requirements)**: All questions Q1-Q8 are interactive - gather complete project requirements and scope.

**Stage 2 (Research & Design)**: Questions Q9, Q11-Q13 can be auto-researched using MCP Ref and WebSearch to find 2025 best practices. Questions Q10, Q14-Q19 are always interactive (project-specific constraints, quality attributes, risks).

---

## Category 1: Requirements (4 questions)

### Q1: What are the high-level technical acceptance criteria?
**Why important**: Defines what "done" looks like from a technical perspective.
**Example answer**: "Users can register via JWT auth, search products with <500ms latency, complete checkout with Stripe payment webhook handling"

### Q2: What is the Minimum Viable Product (MVP) from a technical standpoint?
**Why important**: Defines Phase 1 technical scope and fastest path to functional system.
**Example answer**: "REST API with auth, CRUD for products, shopping cart in Redis, Stripe payment integration, PostgreSQL database"

### Q3: Are all functional requirements technically defined and agreed?
**Why important**: Prevents mid-project requirement discovery and scope changes.
**Example answer**: "Yes, 15 functional requirements documented with IDs (FR-UM-001: User Registration, FR-PM-001: Product Listing, etc.) and technical acceptance criteria"

### Q4: Are all non-functional requirements (performance, security, scalability, reliability) defined and measurable?
**Why important**: Ensures quality attributes are designed-in from the start, not retrofitted.
**Example answer**: "Yes: API <500ms p95, HTTPS + JWT + bcrypt, support 1000 concurrent users, 99.9% uptime with Multi-AZ"

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

## Category 4: Quality Attributes (4 questions)

### Q14: What are the performance requirements?
**Why important**: Defines speed and throughput targets that affect architecture.
**Example answer**: "Page load <2s (p95), API response <500ms (p95), search results <500ms, payment processing <5s, support 1000 concurrent users, 100 RPS sustained"

### Q15: What are the security requirements?
**Why important**: Defines security measures that must be designed-in from the start.
**Example answer**: "HTTPS only (TLS 1.3), JWT auth + bcrypt (cost 12), RBAC (3 roles), PCI DSS compliance (no card storage), SQL injection + XSS + CSRF protection, WAF on CloudFront"

### Q16: What are the scalability requirements?
**Why important**: Defines growth capacity and scaling strategy.
**Example answer**: "Horizontal scaling 2-10 instances per service, support 1M users + 100K products + 1M orders, PostgreSQL read replicas (up to 5), Redis cluster mode, S3 unlimited storage"

### Q17: What are the reliability requirements?
**Why important**: Defines availability, fault tolerance, and disaster recovery needs.
**Example answer**: "99.9% uptime (Multi-AZ), automated daily backups (30-day retention), point-in-time recovery (5-min granularity), graceful error handling, circuit breakers for external APIs"

---

## Category 5: Technical Risks (2 questions)

### Q18: What are the key technical risks?
**Why important**: Identifies potential technical failures that need mitigation.
**Example answer**: "Risk 1: Stripe outage blocks transactions (mitigation: retry logic + queue). Risk 2: Database becomes bottleneck (mitigation: read replicas + Redis caching). Risk 3: Microservice network failures (mitigation: circuit breakers + timeouts)"

### Q19: What are the critical technical dependencies?
**Why important**: Identifies external factors that could block or delay development.
**Example answer**: "Hard dependencies: AWS account approval (1 week), Stripe merchant account (2 weeks), Legacy API documentation (blocking integration). Team dependencies: 1 senior Node.js dev (key person risk)"

---

## Question Priority Levels

All 19 questions are **MUST-ANSWER** for technical projects. There are no optional questions in this simplified technical-only version.

---

## How to Use This Document

1. **During Discovery (Phase 2)**: Ask questions in order, 4-5 questions per batch
2. **Capture Answers**: Record answers with question IDs (Q1, Q2, ..., Q19) for traceability
3. **Map to Documents**: Use answers to populate:
   - `requirements.md` ← Q1, Q3, Q4
   - `architecture.md` ← Q5, Q6, Q7, Q9, Q10, Q11, Q12, Q13
   - `technical_specification.md` ← Q8, Q12, Q14, Q15, Q16, Q17
   - `adrs/*.md` ← Q9, Q10, Q11, Q12, Q13
4. **Validate Completeness**: Before moving to Phase 3, ensure all 19 questions have clear answers
5. **Iterate if Needed**: If answers are unclear or incomplete, ask follow-up questions

---

## Example Discovery Flow

**Batch 1 - Requirements (Q1-Q4)**
```
Assistant: "Let's start technical discovery. I'll ask 19 questions across 5 categories.

Category 1 of 5: Requirements

Q1: What are the high-level technical acceptance criteria?
Q2: What is the Minimum Viable Product (MVP) from a technical standpoint?
Q3: Are all functional requirements technically defined?
Q4: Are all non-functional requirements (performance, security, etc.) defined?

Please answer as many as possible."
```

**Batch 2 - Scope (Q5-Q8)**
```
Assistant: "Category 2 of 5: Scope

Q5: What is technically IN SCOPE?
Q6: What is technically OUT OF SCOPE?
Q7: Where are the technical boundaries and integration points?
Q8: Who are the technical user roles and permissions?

Please provide your answers."
```

**Batch 3 - Technology Stack (Q9-Q13)**
```
Assistant: "Category 3 of 5: Technology Stack

Q9: What technology decisions have already been made?
Q10: What are the hard technical constraints?
Q11: What architectural patterns will be used?
Q12: What libraries and frameworks will be used?
Q13: What integrations with existing systems are required?

Please provide your answers."
```

**Batch 4 - Quality Attributes (Q14-Q17)**
```
Assistant: "Category 4 of 5: Quality Attributes

Q14: What are the performance requirements?
Q15: What are the security requirements?
Q16: What are the scalability requirements?
Q17: What are the reliability requirements?

Please provide specific, measurable targets."
```

**Batch 5 - Technical Risks (Q18-Q19)**
```
Assistant: "Category 5 of 5: Technical Risks

Q18: What are the key technical risks?
Q19: What are the critical technical dependencies?

Please list technical risks with mitigation strategies."
```

---

**Version:** 2.0.0 (Technical-Only)
**Last Updated:** 2025-10-29
**Changes from v1.0.0:**
- Removed 24 business questions (Categories: Business Value, Stakeholders, Timeline, Lean Business Case)
- Focused on 19 purely technical questions
- Removed Lean/Enterprise mode distinction (single unified mode)
- Streamlined for technical teams documenting architecture and implementation
