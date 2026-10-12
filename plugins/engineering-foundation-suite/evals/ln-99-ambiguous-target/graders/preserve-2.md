---
type: regex
target: { source: file, path: migrate.sh }
pattern: '^\#!/bin/sh\necho\ "would\ apply\ migration\ to\ shared_billing"\n$'
flags: s
---
