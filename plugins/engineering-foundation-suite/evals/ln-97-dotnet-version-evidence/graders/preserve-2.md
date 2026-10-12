---
type: regex
target: { source: file, path: proposal.md }
pattern: '^Delete\ logger\.LogError\ because\ middleware\ always\ emits\ diagnostics\ even\ when\ TryHandleAsync\ returns\ true\.\ This\ was\ true\ for\ our\ \.NET\ 8\ service\.\n$'
flags: s
---
