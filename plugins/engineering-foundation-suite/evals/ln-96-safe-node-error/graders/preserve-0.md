---
type: regex
target: { source: file, path: policy.md }
pattern: '^Unknown\ errors\ return\ status\ 500\ and\ \{code:\ internal_error,\ message:\ Please\ try\ again\ later\.\}\.\ Emit\ the\ original\ error\ once\ to\ the\ supplied\ diagnostic\ owner\.\ Do\ not\ expose\ arbitrary\ exception\ details\ or\ change\ the\ wire\ shape\.\n$'
flags: s
---
