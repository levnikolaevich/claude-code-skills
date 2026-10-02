---
type: llm
focus: { source: file, path: docs/architecture/system-design-baseline.md }
---

PASS if the baseline (1) records the availability target and the acceptable data-loss/RPO target as unknown or undecided, each with an owner or exact next evidence action, without stating a numeric target as decided; (2) records storage as SQLite from the code and treats the runbook's PostgreSQL, nightly-backup and 500 requests-per-second statements as unverified or contradicted rather than confirmed; and (3) labels the September volume as observed, separately from any four-warehouse estimate. Accept reproducible statistics from the CSV, such as 34,040 total registrations, a 1,134.67 daily mean, and the 3,184 daily maximum; no particular definition of a normal day is required.
FAIL if it states an invented availability percentage, RPO/RTO or throughput target as a requirement, presents PostgreSQL, nightly backups or 500 requests per second as confirmed facts, or omits the observed volume.
