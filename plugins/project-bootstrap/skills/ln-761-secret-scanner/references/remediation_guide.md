# Secret Remediation Guide

<!-- SCOPE: Secret remediation procedures ONLY. Contains rotation steps, git history cleanup, per-service rotation links. -->
<!-- DO NOT add here: Scanner workflow → ln-761-secret-scanner SKILL.md, detection → detection_patterns.md -->

Procedures for handling discovered secrets. **Critical:** Treat any found secret as already compromised.

---

## Immediate Response Checklist

When a secret is discovered:

1. **Do NOT commit** scan results containing actual secret values
2. **Rotate immediately** - assume secret is compromised
3. **Check git history** - secret may exist in previous commits
4. **Notify team** - if secret was pushed to remote

---

## Rotation Procedures by Secret Type

### AWS Credentials

| Step | Action |
|------|--------|
| 1 | Go to AWS IAM Console |
| 2 | Create new access key for affected user/role |
| 3 | Update all systems using old key |
| 4 | Deactivate old key (wait 24h to verify) |
| 5 | Delete old key after verification |
| 6 | Review CloudTrail for unauthorized access |

### GitHub/GitLab Tokens

| Step | Action |
|------|--------|
| 1 | Go to Settings > Developer settings > Personal access tokens |
| 2 | Revoke compromised token immediately |
| 3 | Generate new token with minimal required scopes |
| 4 | Update CI/CD secrets and local configs |
| 5 | Review audit logs for unauthorized access |

### Database Connection Strings

| Step | Action |
|------|--------|
| 1 | Change database user password |
| 2 | Update connection strings in all environments |
| 3 | Restart affected services |
| 4 | Review database logs for suspicious queries |
| 5 | Consider IP allowlisting if not already enabled |

### API Keys (Generic)

| Step | Action |
|------|--------|
| 1 | Log into service provider dashboard |
| 2 | Regenerate/rotate API key |
| 3 | Update all integrations |
| 4 | Review API logs for unauthorized calls |
| 5 | Set up usage alerts if available |

---

## Removing Secrets from Git History

**Warning:** This rewrites history. Coordinate with team before proceeding.

### Option 1: git-filter-repo (Recommended)

Use for complete removal from all history:
- Install git-filter-repo
- Create backup of repository
- Run filter to remove sensitive file/content
- Force push to all remotes
- All team members must re-clone

### Option 2: BFG Repo Cleaner

Simpler alternative for file removal:
- Download BFG jar
- Run against bare clone
- Push changes
- Team re-clones

### Option 3: Accept and Rotate

If history rewrite is impractical:
- Rotate all affected credentials
- Add to .gitignore going forward
- Document in SECURITY.md

---

## Prevention Measures

### Pre-commit Hooks

Install gitleaks pre-commit hook to prevent future commits:
- Add to `.pre-commit-config.yaml`
- Run `pre-commit install`
- Hook blocks commits with secrets

### Environment Variables

Move secrets to environment:
- Use `.env` files (gitignored)
- Create `.env.example` with placeholders
- Document required variables

### Secret Management Services

For production systems:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

---

## Reporting Template

When reporting a secret finding:

```
Finding ID: [auto-generated]
Severity: [Critical/High/Medium/Low]
File: [path/to/file]
Line: [line number]
Pattern: [what was detected]
Status: [New/In Progress/Remediated]
Remediation: [actions taken]
Verified By: [name/date]
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
