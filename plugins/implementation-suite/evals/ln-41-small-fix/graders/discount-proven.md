---
type: llm
focus: trace
---

PASS only if the trace contains an executed checks/verify_pricing.py command whose output shows ten_percent_line=90.00, quantity_discount=53.97, full_discount=0.00, discount_rounding=0.14, undiscounted_rounding=0.13 and order_total=95.00, with no subsequent pricing change invalidating that evidence.
FAIL if evidence is only a success claim, the executed check reports different totals or fails, the supplied check is modified, or an unrelated refactoring or lifecycle artifact is produced.
