---
type: regex
target: { source: file, path: Dockerfile }
pattern: '^FROM\ private\-runtime:next\nCOPY\ \.\ /app\nCMD\ \["private\-start"\]\n$'
flags: s
---
