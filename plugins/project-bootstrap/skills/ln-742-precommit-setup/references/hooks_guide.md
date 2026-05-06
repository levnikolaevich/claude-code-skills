# Git Hooks Configuration Guide

<!-- SCOPE: Git hooks configuration ONLY. Contains hook types, Husky/lint-staged setup, trigger points. -->
<!-- DO NOT add here: Setup workflow → ln-742-precommit-setup SKILL.md -->

Reference for ln-742-precommit-setup.

---

## How Git Hooks Work

Git hooks are scripts that run at specific points in the Git workflow:

| Hook | Trigger | Use Case |
|------|---------|----------|
| pre-commit | Before commit is created | Lint, format, test |
| commit-msg | After message is written | Validate message format |
| pre-push | Before push to remote | Run full test suite |

---

## Husky vs pre-commit Framework

| Aspect | Husky (Node.js) | pre-commit (Python) |
|--------|-----------------|---------------------|
| Installation | npm package | pip package |
| Config location | `.husky/` directory | `.pre-commit-config.yaml` |
| Hook scripts | Shell scripts | YAML configuration |
| Best for | Node.js projects | Python projects |
| Cross-platform | Good (Git 2.37+) | Excellent |

---

## lint-staged Configuration

lint-staged runs commands only on staged files, making commits fast.

### Pattern Matching

| Pattern | Matches |
|---------|---------|
| `*.ts` | All .ts files |
| `*.{ts,tsx}` | .ts and .tsx files |
| `src/**/*.ts` | .ts files in src/ |
| `!**/test/**` | Exclude test directories |

### Command Arrays

Commands run in order. If any fails, commit is blocked.

```javascript
'*.ts': ['eslint --fix', 'prettier --write']
// 1. ESLint fixes issues
// 2. Prettier formats
// 3. Fixed files auto-staged
```

---

## Conventional Commits Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|------|-------------|
| feat | New feature for users |
| fix | Bug fix for users |
| docs | Documentation changes |
| style | Formatting (no code change) |
| refactor | Code change (no feature/fix) |
| test | Adding/updating tests |
| chore | Maintenance, dependencies |
| ci | CI/CD configuration |
| perf | Performance improvement |
| revert | Reverting a commit |

### Examples

```
feat(auth): add login with Google OAuth
fix(ui): resolve button alignment on mobile
docs: update API documentation
refactor(api): extract validation logic to service
test(auth): add unit tests for login flow
chore: update dependencies to latest versions
```

---

## Troubleshooting

### Hooks Not Running

**Symptom:** Commit succeeds without hook execution.

**Causes:**
1. Husky not initialized: `npx husky init`
2. No prepare script: Add `"prepare": "husky"` to package.json
3. Hooks disabled: Check `core.hooksPath` in git config

### lint-staged Fails

**Symptom:** `lint-staged` command not found.

**Solution:**
```bash
npm install -D lint-staged
```

### Windows Issues

**Symptom:** Shell script errors on Windows.

**Solutions:**
1. Use Git Bash terminal
2. Ensure Git 2.37+ installed
3. Use cross-platform syntax in scripts

### pre-commit Slow First Run

**Symptom:** First `pre-commit run` takes very long.

**Cause:** pre-commit installs hook environments.

**Solution:** Normal behavior. Subsequent runs are fast.

---

## Emergency Bypass

Sometimes you need to commit despite hook failures:

```bash
# Skip ALL hooks
git commit --no-verify -m "emergency: critical hotfix"

# Skip specific hook (Husky only)
HUSKY=0 git commit -m "chore: work in progress"
```

**Warning:** Use sparingly. Document why you bypassed.

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install dependencies
  run: npm ci

- name: Run lint-staged on changed files
  run: npx lint-staged --diff="origin/main...HEAD"
```

### pre-commit in CI

```yaml
- name: Run pre-commit
  uses: pre-commit/action@v3.0.0
```

---

## Updating Hooks

### Husky

Hooks in `.husky/` are regular files. Edit directly.

### pre-commit

```bash
# Update all hooks to latest versions
pre-commit autoupdate

# Update specific hook
pre-commit autoupdate --repo https://github.com/astral-sh/ruff-pre-commit
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
