---
type: llm
focus: trace
---

PASS only if checks/verify.py is executed successfully against the retained code, both entrypoints produce [14,13,41,18,0], and final source shows one domain-owned discount/rounding implementation consumed by both adapters. A shared helper name alone is not proof: inspect calls and ensure no duplicated discount formula remains in either adapter. FAIL for a patch to only one consumer, copied formulas, changed acceptance script, changed public signatures or unrelated cleanup.
