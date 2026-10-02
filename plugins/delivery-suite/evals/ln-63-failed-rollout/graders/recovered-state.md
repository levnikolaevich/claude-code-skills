---
type: regex
target: { source: file, path: .fixture/envs/staging.state }
pattern: '^current=2\.4\.1\ndigest=sha256:9f8e7d6c[0-9a-f]*\nprevious=2\.5\.0$'
flags: m
---
