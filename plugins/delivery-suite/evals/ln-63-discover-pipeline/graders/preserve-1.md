---
type: regex
target: { source: file, path: tools/publish }
pattern: '^\#!/bin/sh\necho\ "Publishing\ requires\ explicit\ execution\ authority"\nexit\ 1\n$'
flags: s
---
