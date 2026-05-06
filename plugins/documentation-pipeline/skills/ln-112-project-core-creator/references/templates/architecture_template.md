# Software Architecture Document: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}
**Architecture Framework:** arc42 (simplified)
**Standard Compliance:** ISO/IEC/IEEE 42010:2022

<!-- DOC_KIND: explanation -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the system model, boundaries, runtime flow, or design rationale. -->
<!-- SKIP_WHEN: Skip when you only need operational steps or API/database lookup details. -->
<!-- PRIMARY_SOURCES: docs/project/requirements.md, docs/project/tech_stack.md, docs/reference/adrs/ -->

<!-- SCOPE: System architecture (arc42 structure), C4 diagrams (Context, Container, Component), runtime scenarios (sequence diagrams), crosscutting concepts (security, error handling, configuration), ADR references ONLY. -->
<!-- DO NOT add here: Deployment procedures → runbook.md, Infrastructure inventory → infrastructure.md, Testing strategy → tests/README.md, Monitoring/Logging operations → runbook.md, Tech stack versions → tech_stack.md, API specs → api_spec.md, Database schema → database_schema.md, Design system → design_guidelines.md, Requirements → requirements.md -->

<!-- NO_CODE_EXAMPLES: Architecture documentation describes DECISIONS and CONTRACTS, not implementations.
     FORBIDDEN: Import statements, DI configuration, function bodies, code blocks > 5 lines
     ALLOWED: Component responsibility tables, Mermaid diagrams, method signatures (1 line), ADR links
     For implementation patterns → docs/reference/guides/
     READ: references/templates/DOCUMENTATION_RULES.md -->

## Quick Navigation

- [Docs Hub](../README.md)
- [Requirements](requirements.md)
- [Tech Stack](tech_stack.md)
- [ADRs](../reference/adrs/)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Explains system structure, boundaries, runtime behavior, and architectural decisions. |
| Read When | You need mental models, component boundaries, or cross-cutting concerns. |
| Skip When | You only need endpoint lists, schema lookup, or deployment commands. |
| Canonical | Yes |
| Next Docs | [Requirements](requirements.md), [Tech Stack](tech_stack.md), [ADRs](../reference/adrs/) |
| Primary Sources | `docs/project/requirements.md`, `docs/project/tech_stack.md`, `docs/reference/adrs/` |

---

## 1. Introduction and Goals

### 1.1 Requirements Overview
{{REQUIREMENTS_OVERVIEW}}
<!-- Example: Brief summary of key functional requirements from Requirements Document and quality goals from Section 1.2 -->

### 1.2 Quality Goals
{{QUALITY_GOALS}}
<!-- Example: 1. Performance: <200ms (p95), 2. Security: GDPR compliance + AES-256, 3. Scalability: 1K→500K users, 4. Reliability: 99.9% uptime, 5. Maintainability: <5% technical debt -->

### 1.3 Stakeholders
{{STAKEHOLDERS_SUMMARY}}
<!-- Example: Product Owner (business direction), Development Team (implementation), DevOps (infrastructure), End Users (consumers), QA (quality assurance) -->

---

## 2. Constraints

### 2.1 Technical Constraints
{{TECHNICAL_CONSTRAINTS}}
<!-- Example: Languages: TypeScript/Node.js (team expertise), Database: PostgreSQL 12 (locked until Q2 2025), Cloud: AWS (company standard), Browser: Chrome/Firefox/Safari last 2 versions -->

### 2.2 Organizational Constraints
{{ORGANIZATIONAL_CONSTRAINTS}}
<!-- Example: Team Size: 11 people (no new hires this quarter), Compliance: GDPR mandatory (EU market), Process: Agile/Scrum 2-week sprints -->

### 2.3 Conventions
{{CONVENTIONS}}
<!-- Example: Code: ESLint+Prettier (CI enforced), Git: GitHub Flow, API: RESTful+JSON+semantic versioning, Testing: Risk-Based (Priority ≥15, Usefulness Criteria) -->

---

## 3. Context and Scope

### 3.1 Business Context
{{BUSINESS_CONTEXT}}
<!-- Example: System provides e-commerce platform connecting Customers (browsing/purchasing) and Admins (managing content) with external services: Payment Gateway (Stripe), Email (SendGrid), Auth (Okta) -->

**Business Context Diagram:**
```mermaid
{{BUSINESS_CONTEXT_DIAGRAM}}
```

**External Interfaces:**
{{EXTERNAL_INTERFACES}}
<!-- Example table: Stripe API | External | HTTPS REST | Payment processing | SendGrid API | External | HTTPS REST | Email notifications -->

### 3.2 Technical Context
{{TECHNICAL_CONTEXT}}
<!-- Example: Web Browser (HTTPS) → API Gateway → Application Server (Node.js) → PostgreSQL Database + Redis Cache + RabbitMQ Queue -->

**Technical Context Diagram:**
```mermaid
{{TECHNICAL_CONTEXT_DIAGRAM}}
```

---

## 4. Solution Strategy

### 4.1 Technology Decisions
{{TECHNOLOGY_DECISIONS}}
<!-- Example table: Frontend | React 18+Next.js 14 | SSR for SEO, team expertise | ADR-001 | Backend | Node.js+Express | JavaScript fullstack, async I/O | ADR-002 | Database | PostgreSQL 15 | ACID, JSON support, mature | ADR-003 -->

### 4.2 Top-Level Decomposition
{{TOP_LEVEL_DECOMPOSITION}}
<!-- Example: Layered Architecture (4 layers): Presentation (Next.js+React) → API (Express REST) → Business Logic (Service classes) → Data (Repositories+PostgreSQL+Redis). Rationale: Separation of concerns, testability, team familiarity -->

### 4.3 Approach to Quality Goals
{{QUALITY_APPROACH}}
<!-- Example table: Performance <200ms | Redis caching, DB indexing, CDN, async I/O | Security GDPR | Encryption at rest/transit, OAuth2, RBAC, audit logging | Scalability 500K | Horizontal scaling (K8s), stateless API, DB read replicas -->

---

## 5. Building Block View

### 5.1 Level 1: System Context (C4 Model)
{{SYSTEM_CONTEXT}}
<!-- Example: Highest level view - System as black box with external actors (Customers, Admins) and external systems (Stripe, SendGrid, Okta) -->

**System Context Diagram:**
```mermaid
{{SYSTEM_CONTEXT_DIAGRAM}}
```

### 5.2 Level 2: Container Diagram (C4 Model)
{{CONTAINER_DIAGRAM}}
<!-- Example: Deployable units - Web App (Next.js), API (Node.js+Express), Background Workers (Node.js), Database (PostgreSQL), Cache (Redis), Queue (RabbitMQ) -->

**Container Diagram:**
```mermaid
{{CONTAINER_DIAGRAM_MERMAID}}
```

### 5.3 Level 3: Component Diagram (C4 Model)
{{COMPONENT_DIAGRAM}}
<!-- Example: API breakdown - Controllers (HTTP endpoints) → Services (business logic) → Repositories (data access) + Middleware (auth, logging, errors) -->

**Components within API Container:**
```mermaid
{{COMPONENT_DIAGRAM_MERMAID}}
```

**Key Components:**
{{KEY_COMPONENTS}}
<!-- Example table: AuthController | Handle login/register endpoints | AuthService, JWTService | ProductService | Product catalog business logic | ProductRepository, CacheService | OrderService | Order processing workflow | OrderRepository, PaymentClient, EmailClient -->

**Infrastructure Layer Components:**
{{INFRASTRUCTURE_COMPONENTS}}
<!-- Example table:
Component | Responsibility | Dependencies
DataAccess/ | EF Core DbContext, Repositories, Migrations | PostgreSQL, Entity Framework
ExternalServices/ | Third-party integrations (Excel, PDF, Email) | ClosedXML, QuestPDF, MailKit
Localization/ | Resource files, culture management | Microsoft.Extensions.Localization
-->

---

## 6. Runtime View

### 6.1 Scenario 1: User Registration
{{SCENARIO_USER_REGISTRATION}}
<!-- Example: User fills form → Web App POST /api/v1/auth/register → API validates + hashes password → DB creates user → Email Service sends verification → User receives success message -->

**Sequence Diagram:**
```mermaid
{{SCENARIO_1_SEQUENCE_DIAGRAM}}
```

### 6.2 Scenario 2: Product Purchase Flow
{{SCENARIO_PURCHASE_FLOW}}
<!-- Example: User clicks Purchase → API creates order → Payment Client calls Stripe → Queue publishes order_created → Background Worker sends confirmation email + updates DB status -->

**Sequence Diagram:**
```mermaid
{{SCENARIO_2_SEQUENCE_DIAGRAM}}
```

### 6.3 [Additional Key Scenarios]
{{ADDITIONAL_SCENARIOS}}
<!-- Example: Add 2-3 more critical scenarios with sequence diagrams (e.g., Password Reset, Search Products, Admin Content Update) -->

---

## 7. Crosscutting Concepts

### 7.1 Security Concept
{{SECURITY_CONCEPT}}
<!-- Example: Auth: JWT (1h expiration) + refresh tokens (30d), Authorization: RBAC (5 roles), Encryption: TLS 1.3 (transit) + AES-256 (at rest for PII), API: Rate limiting (100 req/min), Secrets: AWS Secrets Manager (prod), Audit: All write operations logged -->

### 7.2 Error Handling Concept
{{ERROR_HANDLING_CONCEPT}}
<!-- Example: Custom domain exceptions (PaymentFailedError, UserNotFoundError), Global Express middleware catches all, JSON format {error: {code, message, details}}, Logging with trace_id + stack (Datadog), Sanitized user-facing messages, Retry: Exponential backoff for transient failures -->

### 7.3 Configuration Management Concept
{{CONFIG_MANAGEMENT_CONCEPT}}
<!-- Example: Env vars: .env (dev) + AWS Secrets Manager (prod), Library: dotenv + Joi validation, Environments: Dev (local) + Staging (AWS) + Production (AWS), Secrets: Never in Git, rotated quarterly, Feature Flags: LaunchDarkly or custom Redis-based -->

### 7.4 Data Access Pattern
{{DATA_ACCESS_PATTERN}}
<!-- Example: Repository Pattern (Generic + Specific repositories), Unit of Work via DbContext.SaveChanges(), EF Core code-first migrations, Connection pooling (default 100), Lazy loading disabled (explicit Include()), Query optimization (AsNoTracking() for reads), Transaction management (explicit for multi-repo operations) -->

---

## 8. Architecture Decisions (ADRs)

{{ADR_LIST}}
<!-- Example: List all ADRs with links - [ADR-001](../adrs/adr-001-frontend-framework.md) Use React+Next.js | Accepted | 2024-10-15 -->

**Critical ADRs Summary:**
{{CRITICAL_ADRS_SUMMARY}}
<!-- Example: Brief summary of top 3-5 most impactful decisions (e.g., ADR-001 React+Next.js for SEO requirements, ADR-003 PostgreSQL for ACID compliance, ADR-007 Kubernetes for horizontal scalability) -->

---

## 9. Quality Requirements

### 9.1 Quality Tree
{{QUALITY_TREE}}
<!-- Example: ISO 25010 hierarchy - Performance (Response time <200ms p95, Throughput >10K req/sec), Security (Authentication: OAuth2+JWT, Authorization: RBAC, Encryption: TLS 1.3+AES-256), Scalability (Horizontal: 1K→500K users), Reliability (Uptime: 99.9%, Failover: <60s), Maintainability (Code coverage >80%, Tech debt <5%) -->

### 9.2 Quality Scenarios
{{QUALITY_SCENARIOS}}
<!-- Example table: QS-1 | Performance | User searches "laptop", system returns results | <200ms (p95) | MUST | QS-2 | Scalability | Black Friday spike 1K→50K concurrent users | No degradation | MUST | QS-3 | Security | Attacker SQL injection on login | Attack blocked + logged | MUST -->

---

## 10. Risks and Technical Debt

### 10.1 Known Technical Risks
{{TECHNICAL_RISKS}}
<!-- Example: 1. PostgreSQL 12 EOL approaching (security risk), 2. No database sharding (scalability limit at 5TB), 3. Single region deployment (DR risk), 4. Third-party API dependency (Stripe downtime impact) -->

### 10.2 Technical Debt
{{TECHNICAL_DEBT}}
<!-- Example table: PostgreSQL 12 EOL | Security risk | Upgrade to PG 15 | Q2 2025 | No database sharding | Scalability limit 5TB | Implement sharding | Year 2 | Monolithic deployment | Slow rollouts | Migrate to microservices | Q3 2025 -->

### 10.3 Mitigation Strategies
{{MITIGATION_STRATEGIES}}
<!-- Example: 1. PostgreSQL upgrade: Plan migration window Q2 2025, test on staging first, 2. Sharding: Design partition strategy (by user_id hash), 3. Microservices: Incremental extraction (start with payment service), 4. Stripe dependency: Implement circuit breaker + fallback queue -->

---

## 11. Glossary

| Term | Definition |
|------|------------|
| {{TERM_1}} | {{DEFINITION_1}} |
| Container | Deployable/runnable unit (C4 Model), NOT Docker container |
| Component | Grouping of related functionality within a container |
| SSR | Server-Side Rendering |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |

---

## 12. References

1. arc42 Architecture Template v8.2 - https://arc42.org/
2. C4 Model for Visualizing Software Architecture - https://c4model.com/
3. ISO/IEC/IEEE 42010:2022 - Architecture description
4. Michael Nygard's ADR Format - https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
5. {{PROJECT_NAME}} Requirements Document
6. {{PROJECT_NAME}} ADRs Directory

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New architectural decisions (create new ADR, update Section 8)
- New microservices or containers added (update C4 Container diagram)
- New components in existing services (update C4 Component diagram)
- New external systems or integrations (update Context diagram)
- Major refactoring affecting system structure
- Changes to quality requirements or scenarios

**Verification:**
- [ ] All C4 diagrams (Context, Container, Component) are consistent
- [ ] All ADRs referenced in Section 8 exist in adrs/ directory
- [ ] Runtime view scenarios cover main use cases
- [ ] All external systems documented in Technical Context
- [ ] All placeholders replaced with actual content

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {{DATE}} | {{AUTHOR}} | Initial version |

---
