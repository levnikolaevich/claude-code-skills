# SECURITY.md Template

<!-- SCOPE: SECURITY.md file template ONLY. Contains vulnerability reporting, supported versions sections. -->
<!-- DO NOT add here: Setup workflow → ln-760-security-setup SKILL.md -->

Template for generating project SECURITY.md file.

---

## Template Content

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| {LATEST_VERSION}   | :white_check_mark: |
| < {MIN_SUPPORTED}  | :x:                |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:
- Email: {SECURITY_EMAIL}
- GitHub Security Advisories: {REPO_URL}/security/advisories/new

Please include:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting)
- Full paths of source file(s) related to the issue
- Location of affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Measures

This project implements the following security practices:

### Automated Scanning
- **Secret scanning**: Pre-commit hooks detect hardcoded credentials
- **Dependency audit**: Weekly vulnerability scans for all dependencies
- **SAST**: Static analysis on every pull request

### Development Practices
- All dependencies are pinned to specific versions
- Security updates are prioritized and applied within 48 hours for critical issues
- Code reviews required for all changes

## Response Timeline

| Severity | Initial Response | Resolution Target |
|----------|------------------|-------------------|
| Critical | 24 hours | 48 hours |
| High | 48 hours | 1 week |
| Medium | 1 week | 2 weeks |
| Low | 2 weeks | Next release |

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve our security.
```

---

## Variable Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{LATEST_VERSION}` | Current stable version | `1.x`, `2.0.x` |
| `{MIN_SUPPORTED}` | Minimum supported version | `1.0` |
| `{SECURITY_EMAIL}` | Security contact email | `security@example.com` |
| `{REPO_URL}` | GitHub repository URL | `https://github.com/org/repo` |

---

## Usage Notes

- Replace all placeholders before committing
- Adjust supported versions table based on actual release policy
- Update response timeline based on team capacity
- Add project-specific security measures

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
