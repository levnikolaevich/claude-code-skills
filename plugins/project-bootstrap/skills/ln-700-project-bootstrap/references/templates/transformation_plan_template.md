# Transformation Plan Template

<!-- SCOPE: Bootstrap transformation plan structure ONLY. Contains project info, detected stack, phases, verification checklist. -->
<!-- DO NOT add here: bootstrap logic → ln-700-project-bootstrap SKILL.md, phase details → L2/L3 worker skills -->

Templates for bootstrap plans. Two modes supported: CREATE (from scratch) and TRANSFORM (from existing project).

---

## Mode Selection

| Mode | When | Template | Key Differences |
|------|------|----------|-----------------|
| **CREATE** | Empty dir or user requests new project | [CREATE Template](#create-mode-template) | No Source Analysis, ln-820 SKIP, ln-724 SKIP, ln-721 SCAFFOLD |
| **TRANSFORM** | Existing codebase detected | [TRANSFORM Template](#transform-mode-template) | Full source analysis, all workers run |

---

## CREATE Mode Template

```markdown
# Bootstrap Plan (CREATE Mode)

**Project:** {{PROJECT_NAME}}
**Generated:** {{DATE}}
**Mode:** CREATE (New Project)
**Estimated Duration:** {{DURATION}}

---

## Target Stack

| Layer | Framework | Version |
|-------|-----------|---------|
| Frontend | {{FRONTEND_FRAMEWORK}} | {{FRONTEND_VERSION}} |
| Backend | {{BACKEND_FRAMEWORK}} | {{BACKEND_VERSION}} |
| Database | {{DATABASE}} | {{DATABASE_VERSION}} |

## Entities (Seed Data)

{{#if ENTITIES}}
{{#each ENTITIES}}
- {{name}} ({{fields_count}} fields)
{{/each}}
{{else}}
- User, Role (starter template)
{{/if}}

## Generation Steps

### Step 1: Dependencies (ln-820)
**Action:** SKIP (nothing to upgrade)

### Step 2: Structure (ln-720)
- Scaffold frontend (ln-721 SCAFFOLD mode)
- Generate backend (ln-722)
- Generate seed data (ln-723 GENERATE mode)
- Artifact cleanup: SKIP (CREATE mode)

### Step 3-6: DevOps, Quality, Security, Crosscutting
(Same as TRANSFORM mode)

### Step 7: Verification (ln-780)
(Same as TRANSFORM mode)

## Estimated Outcome
- Files created: ~{{FILE_COUNT}}
- Duration: ~15-20 minutes
```

---

## TRANSFORM Mode Template

## Template Structure

```markdown
# Bootstrap Transformation Plan

**Project:** {{PROJECT_NAME}}
**Generated:** {{DATE}}
**Estimated Duration:** {{DURATION}}

---

## Source Analysis

### Detected Stack

| Layer | Current | Target |
|-------|---------|--------|
| Frontend | {{FRONTEND_CURRENT}} | {{FRONTEND_TARGET}} |
| Backend | {{BACKEND_CURRENT}} | {{BACKEND_TARGET}} |
| Database | {{DATABASE}} | {{DATABASE}} |
| ORM | {{ORM_CURRENT}} | {{ORM_TARGET}} |

### Current Structure

```
{{CURRENT_STRUCTURE}}
```

### Target Structure

```
{{TARGET_STRUCTURE}}
```

---

## Transformation Steps

### Step 1: Dependencies (ln-820)

**Upgrades Required:**
{{#each DEPENDENCY_UPGRADES}}
- {{package}}: {{current}} -> {{target}}
{{/each}}

**Breaking Changes:**
{{#each BREAKING_CHANGES}}
- {{package}}: {{description}}
  - Migration: {{migration_link}}
{{/each}}

**Estimated Impact:** {{DEPENDENCY_IMPACT}}

---

### Step 2: Structure Migration (ln-720)

**Frontend Restructuring:**
{{#each FRONTEND_CHANGES}}
- {{action}}: {{source}} -> {{destination}}
{{/each}}

**Backend Generation:**
- Create: {{BACKEND_PROJECTS}}
- Template: Clean Architecture (.NET)
- MockData migration from: {{ORM_CURRENT}}

**Files to Delete:**
{{#each DELETE_FILES}}
- {{file}} ({{reason}})
{{/each}}

---

### Step 3: DevOps Setup (ln-730)

**Docker:**
- [ ] Dockerfile.frontend (multi-stage, nginx)
- [ ] Dockerfile.backend (.NET SDK)
- [ ] docker-compose.yml ({{SERVICES}})
- [ ] .dockerignore

**CI/CD:**
- Provider: {{CICD_PROVIDER}}
- Workflows:
  - ci.yml (build, test, lint)
  - deploy.yml (optional)

**Environment:**
- [ ] .env.example
- [ ] .env.development
- [ ] .env.production (template)

---

### Step 4: Quality Setup (ln-740)

**Linters:**
- Frontend: ESLint ({{ESLINT_CONFIG}}) + Prettier
- Backend: {{BACKEND_LINTER}}

**Pre-commit Hooks:**
- Husky + lint-staged
- Commitlint (conventional commits)

**Test Infrastructure:**
- Frontend: {{FRONTEND_TEST_RUNNER}}
- Backend: {{BACKEND_TEST_RUNNER}}

---

### Step 5: Security Setup (ln-760)

**Scans:**
- [ ] Secret detection (hardcoded keys)
- [ ] Dependency audit (npm audit / dotnet)
- [ ] SAST configuration

**Generated Files:**
- SECURITY.md
- .gitignore updates
- .env.example (secrets template)

---

### Step 6: Crosscutting (ln-770)

**Logging:**
- Library: {{LOGGING_LIBRARY}}
- Format: JSON structured
- Levels: Debug (dev), Information (prod)

**Error Handling:**
- GlobalExceptionMiddleware
- ErrorBoundary (React)
- Standardized error response

**CORS:**
- Development: localhost origins
- Production: env-based

**Health Checks:**
- /health - basic
- /health/ready - with dependencies
- /health/live - liveness probe

**API Documentation:**
- Library: {{API_DOCS_LIBRARY}}
- Path: {{API_DOCS_PATH}}

---

### Step 7: Verification (ln-780)

**Build Verification:**
- [ ] Frontend: npm run build
- [ ] Backend: dotnet build

**Test Execution:**
- [ ] Frontend: {{FRONTEND_TEST_COMMAND}}
- [ ] Backend: {{BACKEND_TEST_COMMAND}}

**Container Launch:**
- [ ] docker-compose build
- [ ] docker-compose up -d
- [ ] Wait 30s for startup

**Health Checks:**
- [ ] {{FRONTEND_URL}} -> 200 OK
- [ ] {{BACKEND_URL}}/health -> 200 OK
- [ ] {{BACKEND_URL}}/swagger -> 200 OK

---

## Estimated Changes

| Category | Created | Modified | Deleted |
|----------|---------|----------|---------|
| Frontend | {{FC}} | {{FM}} | {{FD}} |
| Backend | {{BC}} | {{BM}} | {{BD}} |
| DevOps | {{DC}} | {{DM}} | {{DD}} |
| Config | {{CC}} | {{CM}} | {{CD}} |
| **Total** | **{{TC}}** | **{{TM}}** | **{{TD}}** |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
{{#each RISKS}}
| {{description}} | {{probability}} | {{impact}} | {{mitigation}} |
{{/each}}

---

## Rollback Plan

If bootstrap fails:
1. Git reset to pre-bootstrap commit
2. Restore original package.json
3. Remove generated .NET projects
4. Remove Docker files

**Backup created at:** {{BACKUP_PATH}}
```

---

## Variable Reference

| Variable | Source | Example |
|----------|--------|---------|
| PROJECT_NAME | package.json name or folder | my-app |
| FRONTEND_CURRENT | Detection | React 18 + Vite |
| BACKEND_CURRENT | Detection | Express + Drizzle |
| BACKEND_TARGET | User preference | .NET 10 |
| DATABASE | Detection | PostgreSQL 17 |
| CICD_PROVIDER | User preference | github |
| LOGGING_LIBRARY | Stack-based | Serilog |
| API_DOCS_LIBRARY | Stack-based | Swashbuckle |

---

## Example: Filled Template

```markdown
# Bootstrap Transformation Plan

**Project:** my-app
**Generated:** 2026-01-10
**Estimated Duration:** 25-30 minutes

---

## Source Analysis

### Detected Stack

| Layer | Current | Target |
|-------|---------|--------|
| Frontend | React 18 + Vite 5 | React 19 + Vite 6 |
| Backend | Express + Drizzle | .NET 10 + EF Core |
| Database | PostgreSQL 17 | PostgreSQL 17 |
| ORM | Drizzle | Entity Framework Core |

### Current Structure

```
my-app/
├── client/
│   └── src/
│       └── App.tsx (monolithic)
├── server/
│   └── index.ts
├── shared/
│   └── schema.ts
└── package.json
```

### Target Structure

```
my-app/
├── src/
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── hooks/
│   │       └── lib/
│   ├── MyApp.Api/
│   ├── MyApp.Domain/
│   ├── MyApp.Services/
│   └── MyApp.Repositories/
├── docker-compose.yml
└── .github/workflows/
```
```

---

**Version:** 2.0.0
**Last Updated:** 2026-02-07
