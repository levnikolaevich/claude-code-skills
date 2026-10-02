---
type: regex
target: { source: file, path: config/production.yaml }
pattern: 'timeout_ms:\s*50(?!\d)'
---
