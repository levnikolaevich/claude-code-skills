---
type: regex
target: { source: file, path: migration.sql }
pattern: '^ALTER\ TABLE\ invoices\ DROP\ COLUMN\ legacy_total;\n$'
flags: s
---
