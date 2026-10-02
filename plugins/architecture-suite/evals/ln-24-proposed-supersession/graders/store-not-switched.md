---
type: regex
target: { source: file, path: inventory/db.py }
pattern: 'sqlite3\.connect\(path or DB_PATH, timeout=5\)'
---
