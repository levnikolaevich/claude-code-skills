---
type: llm
focus: trace
---

PASS only if the trace shows a check exercising the discount defect (the supplied checks/verify_pricing.py or an added regression test) failing on the original implementation because of that defect and passing with the same assertions on the retained implementation, and a later executed checks/verify_pricing.py command on the retained implementation whose output shows ten_percent_line=90.00, quantity_discount=53.97, full_discount=0.00, discount_rounding=0.14, undiscounted_rounding=0.13 and order_total=95.00, with no subsequent pricing change invalidating that evidence.
FAIL if evidence is only a success claim, no pre-fix failure caused by the defect is shown, the final executed check reports different totals or fails, the supplied check is modified, or an unrelated refactoring or lifecycle artifact is produced.
