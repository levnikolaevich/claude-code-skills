# Operations Runbook: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}

<!-- DOC_KIND: how-to -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need setup, deploy, restart, troubleshoot, or recovery procedures. -->
<!-- SKIP_WHEN: Skip when you only need static infrastructure inventory or architectural rationale. -->
<!-- PRIMARY_SOURCES: package.json, docker-compose.yml, scripts/, docs/project/infrastructure.md -->

<!-- SCOPE: ALL operational procedures (local development setup, Docker commands, environment variables, testing commands, build/deployment, production operations, troubleshooting, SSH access, logs, restart procedures) ONLY. -->
<!-- DO NOT add here: Infrastructure inventory → infrastructure.md, Architecture patterns → architecture.md, Tech stack versions → tech_stack.md, Database schema → database_schema.md, API endpoints → api_spec.md, Testing strategy → tests/README.md, Design system → design_guidelines.md, Requirements → requirements.md -->

## Quick Navigation

- [Docs Hub](../README.md)
- [Infrastructure](infrastructure.md)
- [Architecture](architecture.md)
- [Tech Stack](tech_stack.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Provides executable operational procedures for local, staging, and production work. |
| Read When | You need commands, setup steps, deployments, troubleshooting, or recovery actions. |
| Skip When | You only need static topology or design rationale. |
| Canonical | Yes |
| Next Docs | [Infrastructure](infrastructure.md), [Architecture](architecture.md), [Tech Stack](tech_stack.md) |
| Primary Sources | `package.json`, `docker-compose.yml`, `scripts/`, `docs/project/infrastructure.md` |

---

## 1. Overview

### 1.1 Purpose
This runbook provides step-by-step operational procedures for {{PROJECT_NAME}} across all environments: local development, testing, and production.

### 1.2 Quick Links
- Architecture: {{ARCHITECTURE_LINK}}
- Tech Stack: {{TECH_STACK_LINK}}
- API Spec: {{API_SPEC_LINK}}
- Database Schema: {{DATABASE_SCHEMA_LINK}}

### 1.3 Key Contacts
{{KEY_CONTACTS}}
<!--
NOTE: Do NOT use placeholder names (John Doe, Jane Smith).
Use auto-discovery (CODEOWNERS, package.json author, git log) or write an explicit empty-state note if ownership cannot be derived.
See Q50 in questions_devops.md for validation rules.
-->

---

## 2. Prerequisites

### 2.1 Required Tools
{{REQUIRED_TOOLS}}
<!-- Example:
| Tool | Version | Installation |
|------|---------|--------------|
| Docker | 24.0+ | https://docs.docker.com/get-docker/ |
| Docker Compose | 2.20+ | Included with Docker Desktop |
| Node.js | 20.x LTS | https://nodejs.org/ (for local npm scripts) |
| Git | 2.40+ | https://git-scm.com/ |
-->

### 2.2 Access Requirements
{{ACCESS_REQUIREMENTS}}
<!-- Example:
- GitHub repository access (read for development, write for deployment)
- Production SSH keys (request from DevOps lead)
- Database credentials (stored in 1Password vault "ProjectName")
- AWS Console access (IAM role: Developer)
- VPN access for production (if required)
-->

### 2.3 Environment Variables
See [Appendix A: Environment Variables](#appendix-a-environment-variables-reference) for complete reference.

---

## 3. Local Development

### 3.1 Initial Setup

```bash
# Clone repository
git clone https://github.com/org/{{PROJECT_NAME}}.git
cd {{PROJECT_NAME}}

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# See Appendix A for required variables

# Build and start services
docker compose up -d

# Wait for services to be ready (check logs)
docker compose logs -f app
```

**Expected output:**
```
app-1  | Server started on port 3000
db-1   | database system is ready to accept connections
```

### 3.2 Docker Commands

**Start all services:**
```bash
docker compose up -d
```

**Stop all services:**
```bash
docker compose down
```

**Rebuild after code changes:**
```bash
docker compose down
docker compose build --no-cache app
docker compose up -d
```

**View logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app

# Last 100 lines
docker compose logs --tail 100 app
```

**Exec into running container:**
```bash
docker compose exec app sh
# or
docker compose exec app bash
```

**Restart specific service:**
```bash
docker compose restart app
```

### 3.3 Database Operations (Local)

**Run migrations:**
```bash
docker compose exec app npm run migrate

# Or using Prisma
docker compose exec app npx prisma migrate dev
```

**Seed database:**
```bash
docker compose exec app npm run seed
```

**Reset database (⚠️ DESTRUCTIVE):**
```bash
docker compose down
docker volume rm {{PROJECT_NAME}}_postgres_data
docker compose up -d
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

**Database shell:**
```bash
# PostgreSQL
docker compose exec db psql -U {{DB_USER}} -d {{DB_NAME}}

# MySQL
docker compose exec db mysql -u {{DB_USER}} -p{{DB_PASSWORD}} {{DB_NAME}}
```

### 3.4 Common Development Tasks

**Install dependencies (after package.json changes):**
```bash
docker compose down
docker compose build app
docker compose up -d
```

**Run linter:**
```bash
docker compose exec app npm run lint

# Fix automatically
docker compose exec app npm run lint:fix
```

**Format code:**
```bash
docker compose exec app npm run format
```

**Check syntax (TypeScript):**
```bash
docker compose exec app npm run type-check
```

---

## 4. Testing

### 4.1 Run All Tests

```bash
# Using docker-compose.test.yml
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

### 4.2 Run Specific Test Types

**Unit tests:**
```bash
docker compose exec app npm run test:unit

# Watch mode
docker compose exec app npm run test:unit:watch
```

**Integration tests:**
```bash
docker compose exec app npm run test:integration
```

**E2E tests:**
```bash
# Start app first
docker compose up -d

# Run E2E
docker compose exec app npm run test:e2e
```

### 4.3 Test Coverage

```bash
docker compose exec app npm run test:coverage

# Open coverage report
open coverage/index.html
```

### 4.4 Debug Tests

```bash
# Run single test file
docker compose exec app npm test -- path/to/test.spec.ts

# Run with debugging
docker compose exec app node --inspect-brk=0.0.0.0:9229 node_modules/.bin/jest
```

---

## 5. Build & Deployment

### 5.1 Build for Production

```bash
# Build production image
docker build -t {{PROJECT_NAME}}:{{VERSION}} .

# Test production build locally
docker run -p 3000:3000 --env-file .env.production {{PROJECT_NAME}}:{{VERSION}}
```

### 5.2 Deployment to Production

{{DEPLOYMENT_PROCEDURE}}
<!-- Example:

**Prerequisites:**
- [ ] All tests passing (CI/CD green)
- [ ] Code reviewed and approved
- [ ] Database migrations tested in staging
- [ ] Backup created

**Deployment steps:**

```bash
# 1. SSH to production server
ssh production-server

# 2. Navigate to project directory
cd /opt/{{PROJECT_NAME}}

# 3. Pull latest code
git pull origin main

# 4. Backup database
./scripts/backup-db.sh

# 5. Stop services
docker compose down

# 6. Rebuild images
docker compose build --no-cache

# 7. Run migrations
docker compose run --rm app npm run migrate

# 8. Start services
docker compose up -d

# 9. Verify deployment
docker compose logs -f app
curl http://localhost:3000/health
```

**Rollback procedure (if deployment fails):**
```bash
# 1. Rollback code
git reset --hard HEAD~1

# 2. Restore database (if migrations ran)
./scripts/restore-db.sh {{BACKUP_FILE}}

# 3. Restart services
docker compose down && docker compose up -d
```
-->

---

## 6. Production Operations

### 6.1 SSH Access

**SSH to production server:**
```bash
ssh {{PRODUCTION_USER}}@{{PRODUCTION_HOST}}

# Or with SSH key
ssh -i ~/.ssh/{{PROJECT_NAME}}_prod.pem {{PRODUCTION_USER}}@{{PRODUCTION_HOST}}
```

**SSH via jump host (if behind VPN):**
```bash
ssh -J {{JUMP_HOST}} {{PRODUCTION_USER}}@{{PRODUCTION_HOST}}
```

### 6.2 Health Checks

**Check application status:**
```bash
# Health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status": "ok", "uptime": 123456, "timestamp": "2024-01-01T00:00:00Z"}
```

**Check service status:**
```bash
docker compose ps

# Expected output:
# NAME                STATUS              PORTS
# app-1               Up 5 minutes        0.0.0.0:3000->3000/tcp
# db-1                Up 5 minutes        5432/tcp
# cache-1             Up 5 minutes        6379/tcp
```

**Check resource usage:**
```bash
docker stats

# Or specific container
docker stats app-1
```

### 6.3 Monitoring & Logs

**View logs:**
```bash
# Real-time logs (all services)
docker compose logs -f

# Last 500 lines from app
docker compose logs --tail 500 app

# Logs from specific time
docker compose logs --since 2024-01-01T00:00:00 app

# Save logs to file
docker compose logs --no-color app > app-logs-$(date +%Y%m%d).log
```

**Search logs:**
```bash
# Find errors
docker compose logs app | grep ERROR

# Find specific request
docker compose logs app | grep "request_id=123"
```

**Log rotation:**
{{LOG_ROTATION}}
<!-- Example: Docker logs automatically rotate at 100MB, keep last 3 files. Manual rotation: `docker compose down && docker compose up -d` -->

### 6.4 Common Maintenance Tasks

**Restart application (zero downtime):**
```bash
docker compose up -d --no-deps --force-recreate app
```

**Clear cache:**
```bash
docker compose exec cache redis-cli FLUSHALL
```

**Database backup:**
```bash
# PostgreSQL
docker compose exec db pg_dump -U {{DB_USER}} {{DB_NAME}} > backup-$(date +%Y%m%d-%H%M%S).sql

# MySQL
docker compose exec db mysqldump -u {{DB_USER}} -p{{DB_PASSWORD}} {{DB_NAME}} > backup-$(date +%Y%m%d-%H%M%S).sql
```

**Database restore:**
```bash
# PostgreSQL
cat backup-20240101-120000.sql | docker compose exec -T db psql -U {{DB_USER}} {{DB_NAME}}

# MySQL
cat backup-20240101-120000.sql | docker compose exec -T db mysql -u {{DB_USER}} -p{{DB_PASSWORD}} {{DB_NAME}}
```

**Update dependencies:**
```bash
# Update package.json
docker compose exec app npm update

# Rebuild image
docker compose down
docker compose build --no-cache app
docker compose up -d
```

---

## 7. Troubleshooting

### 7.1 Common Issues

#### Issue 1: Application won't start

**Symptoms:**
```
app-1  | Error: Cannot connect to database
app-1  | Error: ECONNREFUSED
```

**Diagnosis:**
```bash
# Check if database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test database connection
docker compose exec app nc -zv db 5432
```

**Resolution:**
```bash
# Restart database
docker compose restart db

# Wait for database to be ready
docker compose logs -f db
# Look for: "database system is ready to accept connections"

# Restart app
docker compose restart app
```

---

#### Issue 2: Out of disk space

**Symptoms:**
```
Error: no space left on device
```

**Diagnosis:**
```bash
df -h
docker system df
```

**Resolution:**
```bash
# Remove unused Docker resources
docker system prune -a

# Remove specific volumes (⚠️ DESTRUCTIVE)
docker volume rm {{PROJECT_NAME}}_postgres_data

# Remove old log files
find /var/log -name "*.log" -mtime +30 -delete
```

---

#### Issue 3: {{ISSUE_3_NAME}}
{{ISSUE_3_TROUBLESHOOTING}}
<!-- Add project-specific common issues -->

---

### 7.2 Emergency Procedures

**Production outage:**
```bash
# 1. Check health status
curl http://localhost:3000/health

# 2. Check logs for errors
docker compose logs --tail 200 app | grep ERROR

# 3. Restart services
docker compose restart

# 4. If restart fails, rollback
git reset --hard HEAD~1
docker compose down && docker compose up -d

# 5. Notify team (Slack/PagerDuty)
```

**Database corruption:**
```bash
# 1. Stop application
docker compose stop app

# 2. Restore from latest backup
./scripts/restore-db.sh {{LATEST_BACKUP}}

# 3. Verify data integrity
docker compose exec db psql -U {{DB_USER}} -d {{DB_NAME}} -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
docker compose start app
```

---

## 8. Appendices

### Appendix A: Environment Variables Reference

**Required variables:**

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@db:5432/myapp` | Database connection string |
| `REDIS_URL` | `redis://cache:6379` | Cache connection string |
| `API_KEY` | `sk_live_abc123...` | External API key (e.g., Stripe) |
| `JWT_SECRET` | `random_secret_key` | JWT signing secret |
| `NODE_ENV` | `development` or `production` | Environment mode |

**Optional variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Application port |
| `LOG_LEVEL` | `info` | Logging verbosity (debug/info/warn/error) |
| `RATE_LIMIT` | `100` | API rate limit (requests/minute) |

---

### Appendix B: Service Dependencies

{{SERVICE_DEPENDENCIES}}
<!--
NOTE: Populate ONLY from docker-compose.yml services section.
Do NOT include generic examples (Redis, RabbitMQ) if not actually used.
See Q51 in questions_devops.md for auto-discovery rules.
-->

---

### Appendix C: Port Mapping

{{PORT_MAPPING}}
<!--
NOTE: Extract ONLY from docker-compose.yml ports section.
Do NOT include services not in docker-compose (e.g., no Redis if not used).
-->

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New deployment procedures
- Infrastructure changes (new services, ports)
- New operational commands
- Troubleshooting scenarios discovered
- Environment variable changes
- SSH access changes

**Verification:**
- [ ] All commands tested in staging
- [ ] SSH access verified
- [ ] Health check procedures validated
- [ ] Backup/restore procedures tested
- [ ] Emergency procedures reviewed
- [ ] Contact information current

---
