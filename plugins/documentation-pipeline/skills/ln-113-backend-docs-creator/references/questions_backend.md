# Backend Documentation Questions (Q39-Q42)

<!-- SCOPE: Interactive questions for 2 backend docs (api_spec.md, database_schema.md) ONLY. Conditional: hasBackend, hasDatabase. -->
<!-- DO NOT add here: question logic → ln-113-backend-docs-creator SKILL.md, other doc questions → questions_frontend.md, questions_devops.md -->

**Purpose:** Validation questions for 2 backend documentation files.

---

## Table of Contents

| Document | Questions | Auto-Discovery | Condition |
|----------|-----------|----------------|-----------|
| [api_spec.md](#docsprojectapispecmd) | 2 | Medium | hasBackend |
| [database_schema.md](#docsprojectdatabaseschemamd) | 2 | High | hasDatabase |

---

<!-- DOCUMENT_START: docs/project/api_spec.md -->
## docs/project/api_spec.md

**File:** docs/project/api_spec.md (API specification - Backend only)
**Rules:** OpenAPI 3.0 compatible, RESTful/GraphQL/gRPC patterns

---

<!-- QUESTION_START: 39 -->
### Question 39: What is the API architecture and authentication?

**Expected Answer:** API type, base URL, versioning, authentication
**Target Section:** ## API Overview

**Validation Heuristics:**
- Mentions API type (REST, GraphQL, gRPC)
- Has base URL or pattern
- Describes auth method (JWT, OAuth2, API keys)
- Explains versioning strategy

**Auto-Discovery:**
- Check: package.json (express, @apollo/server, @grpc/grpc-js)
- Scan: src/routes/ for endpoint patterns
- Check: .env.example for API_BASE_URL, JWT_SECRET
<!-- QUESTION_END: 39 -->

---

<!-- QUESTION_START: 40 -->
### Question 40: What are the available API endpoints?

**Expected Answer:** Endpoints table, request/response examples, error codes
**Target Section:** ## Endpoints

**Validation Heuristics:**
- Has endpoint table (Method | Path | Description)
- Has request/response examples
- Documents error codes (400, 401, 403, 404, 500)

**Auto-Discovery:**
- Scan: src/routes/*.js, src/routes/*.ts
- Check: openapi.yaml, swagger.json if exists
<!-- QUESTION_END: 40 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has endpoint documentation
- Has authentication section

<!-- DOCUMENT_END: docs/project/api_spec.md -->

---

<!-- DOCUMENT_START: docs/project/database_schema.md -->
## docs/project/database_schema.md

**File:** docs/project/database_schema.md (database schema - conditional)
**Rules:** ER diagrams in Mermaid, data dictionary

---

<!-- QUESTION_START: 41 -->
### Question 41: What is the database structure?

**Expected Answer:** Database type, ER diagram, table list
**Target Section:** ## Schema Overview

**Validation Heuristics:**
- Has Mermaid ERD diagram
- Lists all tables/collections
- Shows relationships

**Auto-Discovery:**
- Check: migrations/ or schema/ directory
- Check: src/models/ for entity definitions
- Scan: migration files for CREATE TABLE
<!-- QUESTION_END: 41 -->

---

<!-- QUESTION_START: 42 -->
### Question 42: What are the table structures and relationships?

**Expected Answer:** Columns, types, constraints, relationships
**Target Section:** ## Tables/Collections

**Validation Heuristics:**
- Has table definitions with columns
- Describes relationships (1:1, 1:N, N:M)
- Documents constraints (PK, FK, UNIQUE, NOT NULL)

**Auto-Discovery:**
- Read: migration files for column definitions
- Read: model files for schema definitions
<!-- QUESTION_END: 42 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has ER diagram in Mermaid format
- Has table definitions

<!-- DOCUMENT_END: docs/project/database_schema.md -->

---

**Total Questions:** 4
**Total Documents:** 2

---
**Version:** 1.0.0
**Last Updated:** 2025-12-19
