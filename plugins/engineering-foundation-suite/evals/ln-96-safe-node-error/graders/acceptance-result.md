---
type: regex
target: { source: file, path: results/acceptance.json }
pattern: '^\{"body":\ \{"code":\ "internal_error",\ "message":\ "Please\ try\ again\ later\."\},\ "events":\ 1,\ "secret_exposed":\ false,\ "status":\ 500\}\s*$'
---
