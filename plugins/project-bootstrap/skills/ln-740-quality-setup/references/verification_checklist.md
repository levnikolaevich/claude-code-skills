# Verification Checklist

<!-- SCOPE: Quality setup verification steps ONLY. Contains pre-verification requirements, test commands. -->
<!-- DO NOT add here: Quality setup workflow → ln-740-quality-setup SKILL.md -->

Reference for ln-740-quality-setup Phase 4.

---

## Pre-Verification Requirements

Before running verification:
- [ ] All workers (ln-741, ln-742, ln-743) completed successfully
- [ ] No errors reported during configuration
- [ ] Git repository initialized (for hook testing)

---

## TypeScript/React Verification

### Linter Check
```bash
npm run lint
```
**Expected:** Exit code 0, no errors
**Common Issues:**
- Missing `eslint-config-prettier` causes style conflicts
- TypeScript version mismatch with parser

### Format Check
```bash
npm run format:check
```
**Expected:** All files formatted correctly
**Common Issues:**
- Prettier and ESLint conflict on quotes/semicolons

### Test Check
```bash
npm test
```
**Expected:** Sample test passes
**Common Issues:**
- Missing `@testing-library/jest-dom` setup
- JSDOM not configured

---

## .NET Verification

### Linter Check
```bash
dotnet format --verify-no-changes
```
**Expected:** Exit code 0
**Common Issues:**
- .editorconfig rules conflict with Directory.Build.props

### Build with Analyzers
```bash
dotnet build /warnaserror
```
**Expected:** Build succeeds, no warnings
**Common Issues:**
- Nullable reference types cause warnings initially

### Test Check
```bash
dotnet test
```
**Expected:** Sample test passes
**Common Issues:**
- Missing test SDK reference

---

## Python Verification

### Linter Check
```bash
ruff check .
```
**Expected:** Exit code 0, no issues
**Common Issues:**
- Ruff not in PATH
- pyproject.toml misconfigured

### Format Check
```bash
ruff format --check .
```
**Expected:** All files formatted
**Common Issues:**
- Line length conflicts

### Test Check
```bash
pytest
```
**Expected:** Sample test passes, coverage report generated
**Common Issues:**
- pytest-cov not installed
- Test discovery path wrong

---

## Pre-commit Hooks Verification

### Test Hook Execution
```bash
# Create a test file with lint issues
echo "const x=1" > test-lint.ts

# Stage and attempt commit
git add test-lint.ts
git commit -m "test: verify hooks"
```
**Expected:** Hook triggers, lint-staged runs, file auto-fixed or commit blocked

### Test Commit Message Validation
```bash
git commit --allow-empty -m "bad message"
```
**Expected:** commitlint rejects, suggests conventional format

### Valid Commit Test
```bash
git commit --allow-empty -m "test: verify commitlint works"
```
**Expected:** Commit succeeds

---

## Verification Summary Template

After all checks, report:

```
Quality Setup Verification Complete

Linting:
- TypeScript: PASS (eslint + prettier)
- .NET: PASS (dotnet format + analyzers)
- Python: PASS (ruff)

Testing:
- TypeScript: PASS (vitest, 1 sample test)
- .NET: PASS (xunit, 1 sample test)
- Python: PASS (pytest, 1 sample test)

Pre-commit Hooks:
- lint-staged: PASS
- commitlint: PASS

All quality tools configured and verified.
```

---

## Failure Handling

| Failure | Action |
|---------|--------|
| Lint fails | Check specific rule, may need config adjustment |
| Test fails | Check test setup file, dependencies |
| Hook fails | Verify husky init, check .husky/ permissions |
| Format conflicts | Ensure eslint-config-prettier installed |

Do NOT mark setup as complete until ALL verifications pass.

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
