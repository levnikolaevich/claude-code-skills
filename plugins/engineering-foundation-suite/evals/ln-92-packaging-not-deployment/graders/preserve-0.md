---
type: regex
target: { source: file, path: Dockerfile }
pattern: '^FROM\ python:3\.12\-slim\nARG\ API_KEY\nENV\ API_KEY=\$API_KEY\nCOPY\ app\.py\ /app\.py\nCMD\ \["python",\ "/app\.py"\]\n$'
flags: s
---
