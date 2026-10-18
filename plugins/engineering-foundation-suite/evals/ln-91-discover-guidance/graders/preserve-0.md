---
type: regex
target: { source: file, path: package.json }
pattern: '^\{"name":"sample","private":true,"scripts":\{"check":"node\ tools/check\.mjs"\}\}\n$'
flags: s
---
