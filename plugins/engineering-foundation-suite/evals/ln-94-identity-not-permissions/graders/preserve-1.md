---
type: regex
target: { source: file, path: policy.json }
pattern: '^\{"viewer":\["read"\],"admin":\["read","write"\]\}\n$'
flags: s
---
