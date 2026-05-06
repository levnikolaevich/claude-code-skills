# DevOps Documentation Questions (Q46-Q55)

<!-- SCOPE: Interactive questions for runbook.md and infrastructure.md ONLY. Conditional: runbook requires hasDocker, infrastructure is always. Contains deployment, monitoring, troubleshooting, infrastructure questions. -->
<!-- DO NOT add here: question logic → ln-115-devops-docs-creator SKILL.md, other doc questions → questions_backend.md, questions_frontend.md -->

**Purpose:** Validation questions for runbook.md and infrastructure.md with conditional content support.

---

## Table of Contents

| Document | Questions | Auto-Discovery | Condition |
|----------|-----------|----------------|-----------|
| [runbook.md](#docsprojectrunbookmd) | 6 | High | hasDocker |
| [infrastructure.md](#docsprojectinfrastructuremd) | 4 | Medium | Always |

---

<!-- DOCUMENT_START: docs/project/runbook.md -->
## docs/project/runbook.md

**File:** docs/project/runbook.md (operations guide)
**Rules:** Step-by-step instructions, env vars documented, troubleshooting

---

<!-- QUESTION_START: 46 -->
### Question 46: How do I set up the project locally?

**Expected Answer:** Prerequisites, installation steps, run commands
**Target Section:** ## Local Development Setup

**Validation Heuristics:**
- Lists prerequisites with versions
- Has numbered installation steps
- Has run commands for development

**Auto-Discovery:**
- Check: package.json -> "engines" for versions
- Check: package.json -> "scripts" (dev, start, build)
- Check: README.md for setup instructions
- Check: Dockerfile for runtime requirements
<!-- QUESTION_END: 46 -->

---

<!-- QUESTION_START: 47 -->
### Question 47: How is the application deployed?

**Expected Answer:** Deployment target, build commands, env vars, deploy steps
**Target Section:** ## Deployment

**Validation Heuristics:**
- Mentions deployment platform
- Has build commands
- Lists required env vars
- Shows deployment steps or CI/CD pipeline

**Auto-Discovery:**
- Check: package.json -> "scripts" -> "build"
- Check: .env.example for env vars
- Check: Dockerfile, vercel.json, .platform.app.yaml
- Check: .github/workflows/ for CI/CD
<!-- QUESTION_END: 47 -->

---

<!-- QUESTION_START: 48 -->
### Question 48: How do I troubleshoot common issues?

**Expected Answer:** Common errors, debugging techniques, log locations
**Target Section:** ## Troubleshooting

**Validation Heuristics:**
- Lists common errors and solutions
- Mentions debugging techniques
- Shows log locations or commands

**Auto-Discovery:**
- Check: package.json for logging libraries (winston, pino)
- Scan: README.md for troubleshooting section
<!-- QUESTION_END: 48 -->

---

<!-- QUESTION_START: 49 -->
### Question 49: What deployment scale is this project designed for?

**Expected Answer:** Single instance / Multi-instance / Auto-scaling / GPU-based
**Target Section:** ## Architecture (or inferred from docker-compose)
**Impact:** Include/exclude scaling sections in runbook

**Validation Heuristics:**
- If "single" or "single-GPU": EXCLUDE multi-instance scaling sections
- If "multi" or "multi-GPU": INCLUDE scaling and load balancer sections

**Auto-Discovery:**
- Check: docker-compose.yml for "deploy.replicas" or "scale" directives
- Check: docker-compose.yml services for GPU-related config (runtime: nvidia)
- Check: README.md for scaling mentions
- **DEFAULT if not found:** "single" (exclude scaling sections)
<!-- QUESTION_END: 49 -->

---

<!-- QUESTION_START: 50 -->
### Question 50: Who are the DevOps/Tech leads for this project?

**Expected Answer:** Name, email, role, availability (or TBD)
**Target Section:** ## Key Contacts
**Impact:** Fill {{KEY_CONTACTS}} with real data, NOT placeholders

**Validation Heuristics:**
- Has real contact info (not "John Doe", "configure", "TBD")
- OR explicitly marked [TBD: Ask user for DevOps contacts]

**Auto-Discovery:**
- Check: CODEOWNERS file for maintainers
- Check: package.json -> "author", "contributors"
- Check: git log for frequent committers
- **If not found:** Mark section as [TBD: Provide DevOps team contacts]
<!-- QUESTION_END: 50 -->

---

<!-- QUESTION_START: 51 -->
### Question 51: What external services does this project use?

**Expected Answer:** List of services from docker-compose.yml
**Target Section:** ## Service Dependencies
**Impact:** Include ONLY relevant service dependency sections

**Validation Heuristics:**
- Lists only services that exist in docker-compose.yml
- NO generic examples (Redis, RabbitMQ) if not actually used

**Auto-Discovery:**
- **Parse:** docker-compose.yml -> services section
- Extract: service names, images, ports
- **If service not in docker-compose:** DO NOT include in runbook
<!-- QUESTION_END: 51 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has setup, deployment, troubleshooting sections
- All env vars from .env.example documented

<!-- DOCUMENT_END: docs/project/runbook.md -->

---

<!-- DOCUMENT_START: docs/project/infrastructure.md -->
## docs/project/infrastructure.md

**File:** docs/project/infrastructure.md (infrastructure inventory)
**Rules:** Declarative tables, no procedural content, inventory of WHAT is deployed WHERE

---

<!-- QUESTION_START: 52 -->
### Question 52: What servers/hosts are in the infrastructure?

**Expected Answer:** Server roles, IPs, hostnames, SSH access, hardware specs
**Target Section:** ## 1. Server Inventory

**Validation Heuristics:**
- At least 1 server with IP/hostname
- SSH access documented
- Hardware specs (CPU, RAM, disk) listed

**Auto-Discovery:**
- Check: `~/.ssh/config` for SSH aliases and hostnames
- Check: CI/CD deploy targets (deploy scripts, .gitlab-ci.yml deploy stages)
- Check: docker-compose `deploy.placement` constraints
- Check: Dockerfile `FROM` for base image hints
- **If not found:** Mark as `[TBD: Document server inventory]`
<!-- QUESTION_END: 52 -->

---

<!-- QUESTION_START: 53 -->
### Question 53: What domains/DNS are configured?

**Expected Answer:** Domain names, targets, purpose, reverse proxy config
**Target Section:** ## 2. Domain & DNS

**Validation Heuristics:**
- At least 1 domain with target and purpose
- SSL/TLS configuration mentioned

**Auto-Discovery:**
- Check: docker-compose env vars `VIRTUAL_HOST`, `LETSENCRYPT_HOST`
- Check: nginx/apache configs in project
- Check: `.env.example` for domain-related vars (BASE_URL, API_URL)
- **If not found:** Mark as `[TBD: Document domain configuration]`
<!-- QUESTION_END: 53 -->

---

<!-- QUESTION_START: 54 -->
### Question 54: What artifact repositories are used?

**Expected Answer:** Registry URLs, repository names, credential management
**Target Section:** ## 5. Artifact Repository

**Validation Heuristics:**
- Registry URL specified
- Credential management described (not plaintext passwords)

**Auto-Discovery:**
- Check: `.env.example` for registry URLs (NEXUS_URL, REGISTRY_URL)
- Check: docker-compose image prefixes (private registry indicators)
- Check: `.npmrc`, `pip.conf`, `nuget.config` for registry configs
- Check: `.docker/config.json` for auth references
- **If not found:** Mark as `[TBD: Configure artifact registry]`
<!-- QUESTION_END: 54 -->

---

<!-- QUESTION_START: 55 -->
### Question 55: What are minimum host resource requirements?

**Expected Answer:** RAM, disk, CPU minimums with notes
**Target Section:** ## 7. Host Requirements

**Validation Heuristics:**
- At least RAM and disk minimums specified
- GPU requirements if HAS_GPU

**Auto-Discovery:**
- Check: docker-compose `deploy.resources.limits` and `reservations`
- Check: Dockerfile memory/CPU hints
- Check: README.md for system requirements section
- **If not found:** Estimate from docker-compose service count and resource patterns
<!-- QUESTION_END: 55 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has server inventory, port allocation, deployed services sections
- No procedural content (belongs in runbook.md)
- Tables used for all inventory data

<!-- DOCUMENT_END: docs/project/infrastructure.md -->

---

**Total Questions:** 10
**Total Documents:** 2

---
**Version:** 2.0.0
**Last Updated:** 2025-01-12
