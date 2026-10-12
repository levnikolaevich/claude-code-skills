---
type: regex
target: { source: file, path: connection.json }
pattern: '^\{"environment":"test","database":"shared_billing","host":"shared\.example\.invalid"\}\n$'
flags: s
---
