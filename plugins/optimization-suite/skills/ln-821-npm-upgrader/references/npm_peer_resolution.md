# npm Peer Dependency Resolution

<!-- SCOPE: npm peer dependency conflict resolution ONLY. Contains ERESOLVE solutions, --legacy-peer-deps usage. -->
<!-- DO NOT add here: Upgrade workflow → ln-821-npm-upgrader SKILL.md -->

Guide for handling peer dependency conflicts during upgrades.

---

## Common Scenarios

### ERESOLVE Error

When npm cannot resolve peer dependencies automatically.

| Situation | Solution |
|-----------|----------|
| Minor version mismatch | `npm install --legacy-peer-deps` |
| Major version conflict | Upgrade conflicting package first |
| Last resort | `npm install --force` |

### Warning: peer dep not met

| Situation | Action |
|-----------|--------|
| Dev dependency | Usually safe to ignore |
| Runtime dependency | Must resolve |

---

## Resolution Strategies

### 1. Legacy Peer Deps Mode

```bash
npm install --legacy-peer-deps
```

**When to use:**
- Temporary fix during migration
- Package hasn't updated peer deps yet
- Known false positive

### 2. Upgrade Order

Resolve conflicts by upgrading in correct order:

1. TypeScript / @types/* first
2. Framework (React, Vue) second
3. Build tools (Vite, webpack) third
4. Plugins last

### 3. Force Install

```bash
npm install --force
```

**Warning:** Only use when:
- You understand the incompatibility
- Tests pass after install
- Temporary until proper fix

---

## Debugging

### Check Peer Dependencies

```bash
npm ls <package>
npm explain <package>
```

### View Required Peers

```bash
npm view <package> peerDependencies
```

---

## Package-Specific Issues

### React 18/19 with older plugins

| Package | Issue | Solution |
|---------|-------|----------|
| react-router | Peer dep on React 18 | Wait for update or use --legacy-peer-deps |
| @tanstack/react-query | Version mismatch | Upgrade @tanstack/* together |

### TypeScript with @types

| Issue | Solution |
|-------|----------|
| @types/node version | Match to Node.js version |
| @types/react version | Match to React version |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
