---
type: regex
target: { source: file, path: auth.py }
pattern: '^def\ actor\(header,\ session,\ validate\):\n\ \ \ \ if\ header:\n\ \ \ \ \ \ \ \ result\ =\ validate\(header\)\n\ \ \ \ \ \ \ \ if\ result:\n\ \ \ \ \ \ \ \ \ \ \ \ return\ result\n\ \ \ \ return\ session\.get\("actor"\)\n$'
flags: s
---
