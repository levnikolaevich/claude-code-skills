# Verification Checklist

<!-- SCOPE: Post-bootstrap verification steps ONLY. Contains build, test, lint verification commands. -->
<!-- DO NOT add here: Bootstrap workflow → ln-700-project-bootstrap SKILL.md -->

Post-bootstrap verification steps for ln-700-project-bootstrap.

---

## Quick Verification (5 min)

Essential checks after bootstrap completion:

### 1. Build Verification

```bash
# Frontend
cd src/frontend && npm run build
# Expected: Exit code 0, dist/ folder created

# Backend (.NET)
cd src/MyApp.Api && dotnet build
# Expected: Exit code 0, no errors
```

### 2. Container Launch

```bash
docker-compose up -d
# Expected: All containers start successfully

docker-compose ps
# Expected: All services "Up"
```

### 3. Health Checks

```bash
# Frontend
curl -f http://localhost:3000
# Expected: 200 OK, HTML response

# Backend health
curl -f http://localhost:5000/health
# Expected: 200 OK, {"status": "Healthy"}

# API docs
curl -f http://localhost:5000/swagger
# Expected: 200 OK, Swagger UI HTML
```

---

## Full Verification (15 min)

Comprehensive checks for production readiness:

### Dependencies

- [ ] All packages upgraded to latest versions
- [ ] No npm audit vulnerabilities (high/critical)
- [ ] No unsupported packages
- [ ] TypeScript compiles without errors

```bash
npm outdated          # Should show no outdated
npm audit             # Should show no high/critical
npm run check         # TypeScript check passes
```

### Structure

- [ ] Frontend in `src/frontend/`
- [ ] Backend projects created:
  - [ ] `src/{Project}.Api/`
  - [ ] `src/{Project}.Domain/`
  - [ ] `src/{Project}.Services/`
  - [ ] `src/{Project}.Repositories/`
  - [ ] `src/{Project}.Shared/`
- [ ] MockData migrated from ORM schemas
- [ ] No orphan files in root

### DevOps

- [ ] `Dockerfile.frontend` exists and builds
- [ ] `Dockerfile.backend` exists and builds
- [ ] `docker-compose.yml` exists and valid
- [ ] `.env.example` created
- [ ] `.github/workflows/ci.yml` exists (if GitHub)

```bash
docker-compose config  # Validates compose file
docker-compose build   # All images build
```

### Quality

- [ ] ESLint configured (`eslint.config.js`)
- [ ] Prettier configured (`.prettierrc`)
- [ ] Husky hooks installed (`.husky/`)
- [ ] lint-staged configured
- [ ] EditorConfig exists (`.editorconfig`)

```bash
npm run lint          # No errors
npm run format:check  # Formatting correct
```

### Commands

- [ ] `.claude/commands/refresh_context.md` exists
- [ ] `.claude/commands/refresh_infrastructure.md` exists
- [ ] `.claude/commands/build-and-test.md` exists
- [ ] Commands contain correct project paths
- [ ] Commands contain correct tech stack info

### Security

- [ ] No hardcoded secrets in code
- [ ] `.gitignore` includes sensitive files
- [ ] `SECURITY.md` created
- [ ] `.env` not committed (in .gitignore)

```bash
# Check for potential secrets
grep -r "password\|secret\|api_key\|token" --include="*.ts" --include="*.cs"
# Should return empty or only variable names
```

### Crosscutting

**Logging:**
- [ ] Serilog/Pino configured
- [ ] JSON format enabled
- [ ] Log levels correct (Debug dev, Info prod)

**Error Handling:**
- [ ] GlobalExceptionMiddleware exists
- [ ] ErrorBoundary component exists (React)
- [ ] Error response format standardized

**CORS:**
- [ ] CORS configured for localhost
- [ ] Env-based origins for production

**Health Checks:**
- [ ] `/health` endpoint responds
- [ ] `/health/ready` checks dependencies
- [ ] `/health/live` for liveness probe

**API Documentation:**
- [ ] Swagger UI accessible
- [ ] All endpoints documented
- [ ] Request/response models shown

---

## Integration Tests

### Frontend → Backend Communication

```bash
# Start containers
docker-compose up -d

# Test API call from frontend perspective
curl -X GET http://localhost:5000/api/health

# Check CORS headers
curl -i -X OPTIONS http://localhost:5000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
# Expected: Access-Control-Allow-Origin: http://localhost:3000
```

### Database Connectivity

```bash
# Check database health via backend
curl http://localhost:5000/health/ready
# Expected: {"status": "Healthy", "checks": {"database": {"status": "Healthy"}}}
```

### Container Networking

```bash
# Check containers can communicate
docker-compose exec backend ping frontend
docker-compose exec backend ping postgres
```

---

## Performance Baseline

After bootstrap, capture baseline metrics:

```bash
# Build times
time npm run build           # Frontend build time
time dotnet build             # Backend build time

# Container startup
time docker-compose up -d     # Container startup time

# Response times
curl -w "@curl-format.txt" http://localhost:3000
curl -w "@curl-format.txt" http://localhost:5000/health
```

Expected baselines:
- Frontend build: < 30s
- Backend build: < 15s
- Container startup: < 30s
- Frontend response: < 100ms
- Backend health: < 50ms

---

## Troubleshooting

### Common Issues

| Issue | Check | Solution |
|-------|-------|----------|
| Build fails | Check console output | Fix TypeScript/C# errors |
| Container won't start | `docker-compose logs` | Fix Dockerfile or deps |
| Health check fails | Container logs | Check app startup |
| CORS errors | Browser console | Add origin to CORS config |
| DB connection fails | Connection string | Check .env and docker network |

### Log Collection

```bash
# All container logs
docker-compose logs > bootstrap-logs.txt

# Specific service
docker-compose logs backend > backend-logs.txt
docker-compose logs frontend > frontend-logs.txt

# Follow logs
docker-compose logs -f
```

### Rollback

If verification fails:

```bash
# Stop containers
docker-compose down -v

# Reset to pre-bootstrap
git checkout .
git clean -fd

# Restore from backup
cp -r .bootstrap-backup/* .
```

---

## Sign-off Checklist

Final checklist before considering bootstrap complete:

```markdown
## Bootstrap Sign-off

**Project:** ________________
**Date:** ________________
**Performed by:** ________________

### Mandatory Checks
- [ ] All builds pass
- [ ] All containers start
- [ ] Health checks respond
- [ ] No high/critical vulnerabilities
- [ ] Secrets properly handled

### Optional Checks
- [ ] Tests pass
- [ ] Linters pass
- [ ] Documentation complete
- [ ] CI/CD pipeline works

### Notes
_______________________________
_______________________________

### Result
[ ] APPROVED - Bootstrap complete
[ ] REJECTED - Issues found (see notes)
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
