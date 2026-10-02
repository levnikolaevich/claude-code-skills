---
type: regex
target: { source: file, path: docs/architecture/diagrams/current-components.md }
pattern: '```mermaid[^`]*(?:AuthService|auth-service|Kafka|Postgre)'
flags: i
match: not_contains
---
