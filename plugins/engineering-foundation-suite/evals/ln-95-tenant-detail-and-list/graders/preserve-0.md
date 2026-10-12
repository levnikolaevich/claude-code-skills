---
type: regex
target: { source: file, path: policy.md }
pattern: '^Trusted\ actor\ has\ company\ and\ permissions\.\ A\ read\ requires\ read\ permission\ AND\ matching\ company\.\ Foreign\ and\ nonexistent\ IDs\ return\ None\.\ Lists\ return\ only\ authorized\ rows\.\ Do\ not\ change\ actor\ grants\ or\ add\ authentication\.\n$'
flags: s
---
