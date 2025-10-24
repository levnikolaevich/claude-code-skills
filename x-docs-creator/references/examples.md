# Example Usage

This document provides detailed examples of using the project-documentation-creator skill in different scenarios.

## Example 1: New Project with Materials

**User Request**:
```
"I want to create technical documentation for an existing Node.js e-commerce API"
```

**Skill Response (Phase 1)**:
```
"I'll help you create comprehensive technical documentation.

1. What type of project is this? → web app, API
2. Is this a new project, rewrite, or enhancement? → existing
```

**Skill Response (Phase 2)**:
```
"Do you have project materials to analyze? (files, diagrams, docs, code)"
User: "Yes, I have package.json, Dockerfile, and docker-compose.yml"

"Analyzing project materials..."

✓ Analyzed project materials

**Detected**:
- Runtime: Node.js 20 LTS
- Framework: Express 4.18
- Database: PostgreSQL 15 (from docker-compose.yml)
- Cache: Redis 7.2 (from docker-compose.yml)
- ORM: Prisma 5.6 (from package.json)

**Pre-populated**: Q9 (partial), Q12 (partial)

"Let's proceed to Stage 1: Understanding Requirements."
```

**Skill Response (Phase 3, Stage 1)**:
```
"Stage 1: Understanding Requirements - Category 1 of 2: Requirements

Q1: What are the high-level technical acceptance criteria?
Q2: What is the Minimum Viable Product (MVP) from a technical standpoint?
Q3: Are all functional requirements technically defined?
Q4: Are all non-functional requirements defined?

Please answer these questions."
```

**Skill Response (Phase 3, Stage 2)**:
```
"Stage 1 complete! Research best practices automatically? (Y/N)"
User: "Y"

"Researching 2025 best practices for your e-commerce API...

**Researched Technology Stack**:

**Runtime**: Node.js 20 LTS (detected, confirmed latest)
**Framework**: Express 4.18 → Recommend upgrade to 4.19 (latest stable, security fixes)
**Database**: PostgreSQL 15 → Recommend PostgreSQL 16 (Sep 2023, 5-year support, performance improvements)
**ORM**: Prisma 5.6 → Recommend Prisma 5.7 (latest stable, bug fixes)
**Cache**: Redis 7.2 (confirmed latest stable)

**Architectural Pattern**: RESTful API with Layered Architecture (Controller → Service → Repository)
Rationale: Matches your current Express setup, clear separation of concerns, testable

**Additional Libraries**:
- Validation: Zod 3.22 (type-safe schemas)
- Testing: Jest 29 + Supertest 6 (unit + integration)
- Security: helmet 7 + express-rate-limit 7

Do you accept these recommendations? (Y/N/Modify)"
```

**After All Phases Complete**:
```
"Technical documentation generation complete!

**Generated Files**:
- docs/project/requirements.md (15 FR + 12 NFR)
- docs/project/architecture.md (with C4 diagrams)
- docs/project/technical_specification.md (includes auto-generated Dockerfile + docker-compose.yml)
- docs/project/adrs/ (5 ADRs: Express, PostgreSQL, Prisma, Redis, REST API)

**Next Steps**:
1. Review the generated documentation with your technical team
2. Use these documents as input for epic-creator to start creating Epics

Would you like to review any specific document or make adjustments?"
```

## Example 2: New Project without Materials

**User Request**:
```
"I want to create technical documentation for a new mobile app project"
```

**Skill Response**:
```
"I'll help you create comprehensive technical documentation.

1. What type of project is this? → mobile app
2. Is this a new project, rewrite, or enhancement? → new project

Do you have project materials to analyze? (files, diagrams, docs, code)"
User: "No"

"Let's begin Stage 1: Understanding Requirements."
```

*[Proceeds with fully interactive Q1-Q19 dialog, with automatic research option for Q9, Q11-Q13]*

---

**Version:** 2.0.0
**Last Updated:** 2025-01-31
