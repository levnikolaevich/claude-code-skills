---
type: regex
target: { source: file, path: app/permissions.py }
pattern: 'return user\.role == "admin" or can_read\(user, doc\)'
---
