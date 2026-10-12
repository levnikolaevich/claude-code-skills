---
type: regex
target: { source: file, path: deploy.sh }
pattern: '^\#!/bin/sh\nprintf\ "applying\ to\ shared\ production"\n$'
flags: s
---
