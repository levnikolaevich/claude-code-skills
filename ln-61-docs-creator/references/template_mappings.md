# Template Mappings Reference

This document details how collected answers from Phase 3 (Technical Discovery) map to specific sections in generated documentation templates.

## Document 1: requirements.md

**Template File**: `references/requirements_template.md`

**Structure**:
- Functional Requirements (FR) organized by feature groups
- 7 Non-Functional Requirements (NFR) categories
- Each requirement includes: ID, Description, Priority (MoSCoW), Acceptance Criteria

**Key Mappings**:

| Template Section | Source Questions | Notes |
|-----------------|------------------|-------|
| FR by feature groups | Q1, Q2 | Organize functional requirements by user-facing features |
| Performance NFR | Q14 | Response times, throughput, latency targets |
| Security NFR | Q15 | Authentication, authorization, encryption, compliance |
| Scalability NFR | Q16 | Load handling, horizontal/vertical scaling strategies |
| Reliability NFR | Q17 | Uptime targets, fault tolerance, disaster recovery |

**Format Example**:
```markdown
### FR-AUTH-001: User Registration
**Priority**: MUST
**Description**: Users can register with email and password
**Acceptance Criteria**:
- Email validation (RFC 5322)
- Password strength requirements (min 12 chars, uppercase, lowercase, number, symbol)
- Confirmation email sent within 5 seconds
```

---

## Document 2: architecture.md

**Template File**: `references/architecture_template.md`

**Structure**:
- 11 sections following arc42 (simplified) + C4 Model
- Includes Mermaid diagrams (C4 Context, Container, Component, Deployment)

**Key Mappings**:

| Template Section | Source Questions | Notes |
|-----------------|------------------|-------|
| Technology Stack | Q9, Q11, Q12 | Languages, frameworks, databases, infrastructure |
| Architecture Pattern | Q11 | Layered, microservices, event-driven, etc. |
| Quality Goals | Q14-Q17 | Top 3-5 quality attributes from NFRs |
| Constraints | Q10 | Hard constraints (compliance, technology lock-in) |
| Integrations | Q13 | External systems, APIs, third-party services |

**Diagram Mappings**:

| Diagram Type | Generated From | Purpose |
|-------------|---------------|---------|
| C4 Context | Q7 (boundaries), Q13 (integrations) | System + external actors/systems |
| C4 Container | Q11 (architecture), Q9 (database/cache) | Frontend, Backend, Database, Cache, Queue |
| C4 Component | Q11 (pattern), Q12 (frameworks) | API application breakdown (controllers, services, repositories) |
| Deployment | Q9 (cloud provider), Q11 (orchestration) | Infrastructure diagram (AWS/Azure/GCP) |

---

## Document 3: technical_specification.md

**Template File**: `references/technical_spec_template.md`

**Structure**:
- 12 sections covering implementation details
- Includes Mermaid ER diagrams, API spec tables
- Docker section with auto-generated Dockerfile and docker-compose.yml

**Key Mappings**:

| Template Section | Source Questions | Notes |
|-----------------|------------------|-------|
| Tech Stack Table | Q9, Q11, Q12 | Detailed version table with rationale and ADR links |
| Docker Environment | Q12 (runtime/framework) | Auto-generated from researched stack |
| Database Schema | Q3 (derived) | ER diagram + data dictionary from entity analysis |
| API Endpoints | Q1, Q4 (derived) | RESTful endpoints derived from functional requirements |
| Security Implementation | Q15 | Authentication/authorization/encryption details |
| Integrations | Q13 | External API integration specifications |

**Tech Stack Table Format**:
```markdown
| Layer | Category | Technology | Version | Rationale | ADR |
|-------|----------|----------|---------|-----------|-----|
| Frontend | Framework | Next.js | 14.0 | SSR for SEO, team expertise | ADR-001 |
| Backend | Language | Node.js | 20 LTS | JavaScript fullstack, async I/O | ADR-002 |
| Database | Primary | PostgreSQL | 16 | ACID, JSON support, maturity | ADR-003 |
```

**Docker Section**: Auto-generated based on Phase 3 Stage 2 research results:
- Multi-stage Dockerfile (dev + prod)
- docker-compose.yml with all services (app, db, cache, queue)
- Uses latest stable versions from research

---

## Document 4: adrs/ Folder

**Template File**: `references/adr_template.md`

**Structure**:
- 3-5 ADRs generated automatically
- Michael Nygard's ADR format
- Each ADR includes: Context, Decision, Rationale, Consequences, Alternatives Considered

**Generated ADRs**:

| ADR | Title | Source Questions | When Generated |
|-----|-------|------------------|---------------|
| ADR-001 | Frontend Framework Choice | Q11, Q12 | If frontend framework specified |
| ADR-002 | Backend Framework Choice | Q11, Q12 | Always (every project has backend) |
| ADR-003 | Database Choice | Q9 | Always (every project has database) |
| ADR-004 | Additional Technology 1 | Q12 | If significant library chosen (ORM, cache, queue) |
| ADR-005 | Additional Technology 2 | Q12 | If multiple significant choices made |

**ADR Format Example**:
```markdown
# ADR-003: Database Choice - PostgreSQL

**Status**: Accepted

**Context**:
We need a relational database for our e-commerce API to store users, products, orders, and payments with ACID guarantees and complex querying capabilities.

**Decision**:
We will use PostgreSQL 16 as our primary database.

**Rationale**:
- ACID compliance for transactional integrity
- JSON/JSONB support for flexible schema fields
- Mature ecosystem with wide tooling support
- Team has 5+ years PostgreSQL experience
- 5-year support lifecycle (until 2028)

**Consequences**:

*Positive*:
- Strong data integrity guarantees
- Excellent performance for complex queries
- Rich extension ecosystem (PostGIS, pg_cron, etc.)
- Native JSON support reduces need for separate document store

*Negative*:
- Higher complexity than NoSQL for simple key-value operations
- Requires careful index management for performance
- Vertical scaling has limits (need read replicas for high load)

*Technical Debt*:
- Must implement connection pooling (PgBouncer) for scaling
- Need monitoring for slow queries and index usage

**Alternatives Considered**:

1. **MySQL 8.0**
   - Pros: Simpler setup, good for read-heavy workloads
   - Cons: Weaker JSON support, less advanced features
   - Rejected: PostgreSQL JSON capabilities better fit our needs

2. **MongoDB**
   - Pros: Flexible schema, horizontal scaling
   - Cons: No ACID transactions (until 4.0), team inexperience
   - Rejected: Need strong transactional guarantees for payments
```

---

## Template Placeholder Format

All templates use explicit placeholder mapping with comments:

```markdown
**Technology Stack:** {{TECHNOLOGY_STACK}}
<!-- From Q9: What database technology will you use? -->

**Architecture Pattern:** {{ARCHITECTURE_PATTERN}}
<!-- From Q11: What architectural patterns will be used? -->
```

This format allows clear traceability from questions to documentation sections.

---

**Version:** 1.0.0
**Last Updated:** 2025-10-29
