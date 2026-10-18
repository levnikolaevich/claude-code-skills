---
type: regex
target: { source: file, path: tools/check.mjs }
pattern: '^console\.log\("No\ checks\ configured\ yet"\);\n$'
flags: s
---
