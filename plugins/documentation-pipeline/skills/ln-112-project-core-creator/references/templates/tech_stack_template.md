# Technology Stack: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}

<!-- DOC_KIND: reference -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need exact technologies, versions, tooling, or external service choices. -->
<!-- SKIP_WHEN: Skip when you only need business scope or runtime procedures. -->
<!-- PRIMARY_SOURCES: package.json, requirements.txt, docker-compose.yml, docs/reference/adrs/ -->

<!-- SCOPE: Technology stack (specific versions, libraries, frameworks), Docker configuration (Dockerfile, docker-compose.yml), development tools, naming conventions ONLY. -->
<!-- DO NOT add here: API endpoints → api_spec.md, Database schema → database_schema.md, Architecture patterns → architecture.md, Requirements → requirements.md, Deployment procedures → runbook.md, Infrastructure inventory → infrastructure.md, Design system → design_guidelines.md -->

## Quick Navigation

- [Docs Hub](../README.md)
- [Requirements](requirements.md)
- [Architecture](architecture.md)
- [ADRs](../reference/adrs/)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Lists the actual stack, versions, tooling, and rationale for selected technologies. |
| Read When | You need exact framework, library, runtime, or tool choices. |
| Skip When | You only need workflow instructions or feature scope. |
| Canonical | Yes |
| Next Docs | [Architecture](architecture.md), [Runbook](runbook.md), [ADRs](../reference/adrs/) |
| Primary Sources | `package.json`, `requirements.txt`, `docker-compose.yml`, `docs/reference/adrs/` |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the technology stack, frameworks, libraries, and tools used in {{PROJECT_NAME}}.

### 1.2 Scope
{{SCOPE}}
<!-- Example: Full-stack web application. IN SCOPE: Frontend (React), Backend (Node.js/Express), Database (PostgreSQL), Cache (Redis), Docker setup. OUT OF SCOPE: Infrastructure provisioning (see runbook.md), API contracts (see api_spec.md) -->

---

## 2. Technology Stack

### 2.1 Stack Overview

| Layer | Technology | Version | Rationale | ADR |
|-------|------------|---------|-----------|-----|
| **Frontend** | {{FRONTEND_FRAMEWORK}} | {{FRONTEND_VERSION}} | {{FRONTEND_RATIONALE}} | {{FRONTEND_ADR_LINK}} |
| **Backend** | {{BACKEND_FRAMEWORK}} | {{BACKEND_VERSION}} | {{BACKEND_RATIONALE}} | {{BACKEND_ADR_LINK}} |
| **Database** | {{DATABASE}} | {{DATABASE_VERSION}} | {{DATABASE_RATIONALE}} | {{DATABASE_ADR_LINK}} |
| **Cache** | {{CACHE}} | {{CACHE_VERSION}} | {{CACHE_RATIONALE}} | {{CACHE_ADR_LINK}} |
| **Message Queue** | {{QUEUE}} | {{QUEUE_VERSION}} | {{QUEUE_RATIONALE}} | {{QUEUE_ADR_LINK}} |
| **Testing** | {{TEST_FRAMEWORK}} | {{TEST_VERSION}} | {{TEST_RATIONALE}} | {{TEST_ADR_LINK}} |
| **DevOps** | {{DEVOPS_TOOLS}} | {{DEVOPS_VERSION}} | {{DEVOPS_RATIONALE}} | {{DEVOPS_ADR_LINK}} |

<!-- Example:
| Frontend | React | 18.2.0 | Component-based UI, large ecosystem, TypeScript support | [ADR-003](../reference/adrs/adr-003-react.md) |
| Backend | Node.js + Express | 20.x + 4.18.x | JavaScript full-stack, async/await, vast npm ecosystem | [ADR-001](../reference/adrs/adr-001-nodejs.md) |
| Database | PostgreSQL | 16.x | ACID compliance, JSON support, mature ecosystem | [ADR-002](../reference/adrs/adr-002-postgresql.md) |
| Cache | Redis | 7.x | In-memory performance, pub/sub, session storage | [ADR-004](../reference/adrs/adr-004-redis.md) |
| Queue | RabbitMQ | 3.12.x | Reliable message delivery, dead letter queues | [ADR-005](../reference/adrs/adr-005-rabbitmq.md) |
| Testing | Jest + Playwright | 29.x + 1.40.x | Unit testing (Jest), E2E testing (Playwright) | [ADR-006](../reference/adrs/adr-006-testing.md) |
| DevOps | Docker + GitHub Actions | 24.x + latest | Containerization, CI/CD automation | [ADR-007](../reference/adrs/adr-007-devops.md) |
-->

### 2.2 Key Libraries & Dependencies

**Frontend:**
{{FRONTEND_LIBRARIES}}
<!-- Example: React Router (6.x) - routing, Tailwind CSS (3.x) - styling, Axios (1.x) - HTTP client, React Query (5.x) - data fetching -->

**Backend:**
{{BACKEND_LIBRARIES}}
<!-- Example: Prisma (5.x) - ORM, bcrypt (5.x) - password hashing, jsonwebtoken (9.x) - JWT auth, winston (3.x) - logging -->

**Common:**
{{COMMON_LIBRARIES}}
<!-- Example: TypeScript (5.x) - type safety, ESLint (8.x) - linting, Prettier (3.x) - code formatting -->

---

## 3. Docker Development Environment

### 3.1 Dockerfile

```dockerfile
{{DOCKERFILE_CONTENT}}
```

<!-- Example:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```
-->

### 3.2 docker-compose.yml (Development)

```yaml
{{DOCKER_COMPOSE_DEV}}
```

<!-- Example:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/myapp
      REDIS_URL: redis://cache:6379
    depends_on:
      - db
      - cache

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```
-->

### 3.3 docker-compose.test.yml (Testing)

```yaml
{{DOCKER_COMPOSE_TEST}}
```

<!-- Example:
```yaml
version: '3.8'

services:
  test:
    build: .
    command: npm run test
    environment:
      DATABASE_URL: postgresql://user:password@db-test:5432/myapp_test
    depends_on:
      - db-test
    tmpfs:
      - /app/coverage

  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp_test
```
-->

---

## 4. Development Tools

### 4.1 Required Tools

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| Node.js | {{NODE_VERSION}} | Runtime environment | https://nodejs.org/ |
| Docker | 24.0+ | Container runtime | https://docs.docker.com/get-docker/ |
| Git | 2.40+ | Version control | https://git-scm.com/ |
| {{IDE}} | Latest | Code editor | {{IDE_LINK}} |

<!-- Example:
| Node.js | 20.x LTS | Runtime environment | https://nodejs.org/ |
| Docker | 24.0+ | Container runtime | https://docs.docker.com/get-docker/ |
| Git | 2.40+ | Version control | https://git-scm.com/ |
| VS Code | Latest | Code editor | https://code.visualstudio.com/ |
-->

### 4.2 VS Code Extensions (Recommended)

{{VSCODE_EXTENSIONS}}
<!-- Example: ESLint, Prettier, Docker, Prisma, Tailwind CSS IntelliSense -->

### 4.3 Linters & Code Quality Tools

| Tool | Version | Purpose | Command | Config File |
|------|---------|---------|---------|-------------|
| {{LINTER_1}} | {{VERSION_1}} | {{PURPOSE_1}} | {{COMMAND_1}} | {{CONFIG_1}} |

<!-- Example:
| ESLint | 9.x | JavaScript/TypeScript linting | `npm run lint` | .eslintrc.js |
| Prettier | 3.x | Code formatting | `npm run format:check` | .prettierrc |
| TypeScript | 5.x | Type checking | `tsc --noEmit` | tsconfig.json |
| Ruff | 0.4.x | Python linting | `ruff check .` | pyproject.toml |
| Stylelint | 16.x | CSS/SCSS linting | `npm run lint:css` | .stylelintrc |
-->

**CI/CD Integration:**
{{CI_LINT_INTEGRATION}}
<!-- Example:
- Pre-commit hook: `npm run lint && npm run format:check`
- GitHub Actions: `npm run lint` in CI workflow
- Required for merge: All linters must pass (0 errors)
-->

**Run All Quality Checks:**
```bash
{{LINT_ALL_COMMAND}}
```
<!-- Example: npm run lint && npm run format:check && tsc --noEmit -->

---

## 5. Naming Conventions

### 5.1 File Naming
{{FILE_NAMING}}
<!-- Example: Components: PascalCase (UserProfile.tsx), Utilities: camelCase (formatDate.ts), Constants: UPPER_SNAKE_CASE (API_ENDPOINTS.ts) -->

### 5.2 Variable Naming
{{VARIABLE_NAMING}}
<!-- Example: camelCase for variables/functions, PascalCase for classes/components, UPPER_SNAKE_CASE for constants -->

### 5.3 Database Naming
{{DATABASE_NAMING}}
<!-- Example: Tables: snake_case plural (user_profiles), Columns: snake_case (first_name), Indexes: idx_table_column -->

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- Technology version upgrade (major/minor releases)
- New library added to dependencies
- Docker configuration changes
- Development tool updates

**Verification:**
- [ ] All versions match package.json/Dockerfile
- [ ] ADR links valid and point to correct decisions
- [ ] Docker compose files tested and working
- [ ] All listed tools accessible with installation links

---
