---
type: regex
target: { source: file, path: app/webhooks.py }
pattern: 'BackoffRetrier|retry_with_backoff|app\.retry|app\.backoff'
match: not_contains
---
