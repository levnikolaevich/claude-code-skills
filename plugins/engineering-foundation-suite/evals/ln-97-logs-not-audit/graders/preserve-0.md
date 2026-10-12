---
type: regex
target: { source: file, path: logger.py }
pattern: '^def\ transfer\(db,\ log,\ token\):\n\ \ \ \ log\.info\(\{"event":"transfer\.committed","token":token\}\)\n\ \ \ \ db\.commit\(\)\n$'
flags: s
---
