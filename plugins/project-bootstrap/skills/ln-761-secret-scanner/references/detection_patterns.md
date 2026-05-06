# Secret Detection Patterns

<!-- SCOPE: Secret detection regex patterns ONLY. Contains AWS/GitHub/Slack token patterns, confidence levels. -->
<!-- DO NOT add here: Scanner workflow → ln-761-secret-scanner SKILL.md, remediation → remediation_guide.md -->

Reference for secret patterns detected by ln-761-secret-scanner.

---

## High-Confidence Patterns

| Pattern | Regex/Keywords | Risk | Examples |
|---------|----------------|------|----------|
| **AWS Access Key** | `AKIA[0-9A-Z]{16}` | Critical | `AKIAIOSFODNN7EXAMPLE` |
| **AWS Secret Key** | `[A-Za-z0-9/+=]{40}` near "aws_secret" | Critical | 40-char base64 string |
| **GitHub Token** | `ghp_[a-zA-Z0-9]{36}`, `gho_`, `ghu_`, `ghs_`, `ghr_` | Critical | `ghp_xxxxxxxxxxxx` |
| **GitLab Token** | `glpat-[a-zA-Z0-9\-]{20}` | Critical | `glpat-xxxxxxxxxx` |
| **Slack Token** | `xox[baprs]-[0-9]{10,13}-[a-zA-Z0-9-]*` | Critical | `xoxb-123456-abcdef` |
| **Stripe Key** | `sk_live_[a-zA-Z0-9]{24,}` | Critical | `sk_live_xxxxx` |
| **Private Key** | `-----BEGIN (RSA\|EC\|OPENSSH) PRIVATE KEY-----` | Critical | PEM format |
| **JWT Secret** | `jwt[_-]?secret` in assignment | Critical | `JWT_SECRET=xxx` |

## Medium-Confidence Patterns

| Pattern | Regex/Keywords | Risk | False Positive Risk |
|---------|----------------|------|---------------------|
| **Generic API Key** | `api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]` | High | Medium - may match config placeholders |
| **Generic Secret** | `secret\s*[:=]\s*['"][^'"]{8,}['"]` | High | Medium - may match test data |
| **Password** | `password\s*[:=]\s*['"][^'"]+['"]` | High | High - may match examples |
| **Connection String** | `(postgres\|mysql\|mongodb)://[^:]+:[^@]+@` | High | Low |
| **Bearer Token** | `Bearer\s+[a-zA-Z0-9\-_.]+` | Medium | Medium - may match docs |

## Low-Confidence Patterns (Manual Review Required)

| Pattern | Context | Action |
|---------|---------|--------|
| **Base64 strings > 40 chars** | Near sensitive keywords | Review if actual secret |
| **Hex strings > 32 chars** | In config files | Review if encryption key |
| **URLs with credentials** | `://user:pass@` format | Usually false positive in docs |

---

## Allowlist Patterns (Common False Positives)

| Pattern | Reason | Example |
|---------|--------|---------|
| **Placeholder values** | Test/example data | `YOUR_API_KEY_HERE`, `xxx`, `changeme` |
| **Mock data** | Test fixtures | `test-api-key-12345` |
| **Documentation** | Code examples | In `*.md`, `*.rst` files |
| **Lock files** | Package hashes | `package-lock.json`, `yarn.lock` |
| **Binary files** | Not actual secrets | `*.png`, `*.jpg`, `*.woff` |

---

## Detection Priority

1. **Scan first:** High-confidence patterns (automated blocking)
2. **Flag for review:** Medium-confidence patterns (manual verification)
3. **Log only:** Low-confidence patterns (baseline building)

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
