# Security Audit Guide

<!-- SCOPE: Pre-upgrade security audit commands ONLY. Contains npm/pip/nuget audit commands, CVE checks. -->
<!-- DO NOT add here: Upgrade workflow → ln-820-dependency-optimization-coordinator SKILL.md -->

Pre-upgrade security checks for all package managers.

---

## Overview

Before upgrading dependencies, run security audits to:
1. Identify existing vulnerabilities
2. Block upgrades to packages with critical CVEs
3. Enforce minimum release age (14 days default)

---

## npm / yarn / pnpm

### Commands

| Manager | Audit Command | Output |
|---------|---------------|--------|
| npm | `npm audit --audit-level=high` | JSON or text |
| yarn | `yarn audit --level high` | JSON or text |
| pnpm | `pnpm audit --audit-level high` | JSON or text |

### Severity Levels

| Level | Action |
|-------|--------|
| critical | Block upgrade, require manual review |
| high | Warn, continue with caution |
| moderate | Log for awareness |
| low | Log only |

### Fix Commands

| Manager | Command |
|---------|---------|
| npm | `npm audit fix` |
| npm (breaking) | `npm audit fix --force` |
| yarn | `yarn audit --fix` (if available) |
| pnpm | `pnpm audit --fix` |

---

## .NET / NuGet

### Commands

| Check | Command |
|-------|---------|
| Vulnerable packages | `dotnet list package --vulnerable` |
| Outdated + vulnerable | `dotnet list package --vulnerable --include-transitive` |

### NuGet Audit

Enable in `.csproj`:

```xml
<PropertyGroup>
  <NuGetAudit>true</NuGetAudit>
  <NuGetAuditLevel>high</NuGetAuditLevel>
</PropertyGroup>
```

---

## Python / pip

### Commands

| Tool | Command |
|------|---------|
| pip-audit | `pip-audit --json` |
| safety | `safety check --json` |
| pipenv | `pipenv check` |
| poetry | `poetry audit` (via plugin) |

### Install pip-audit

```bash
pip install pip-audit
```

---

## Release Age Check

### Rationale

Per Renovate best practices: waiting 14 days before upgrading third-party dependencies gives registries time to pull malicious packages.

### Implementation

| Option | Default | Description |
|--------|---------|-------------|
| minimumReleaseAge | 14 days | Skip packages released recently |
| ignoreReleaseAge | false | Override for urgent patches |

### Check Release Date

| Manager | Method |
|---------|--------|
| npm | `npm view <package> time` |
| nuget | NuGet API query |
| pip | PyPI JSON API |

---

## Decision Matrix

| Severity | Age < 14 days | Action |
|----------|---------------|--------|
| Critical | Any | Block, require manual review |
| High | Yes | Warn, suggest waiting |
| High | No | Proceed with caution |
| Moderate/Low | Any | Proceed normally |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
