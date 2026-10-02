---
type: llm
---

PASS if the reply reports that `place_order` in store/orders.py commits the order header and each line separately, traces partial persistence when a later line fails, and recommends one transaction with rollback. It must identify `order_history` as N+1, distinguish observed query count from unmeasured latency, and recommend retrieving lines in a bounded batch rather than per order. JOIN, IN, or equivalent batch retrieval is valid; no exact SQL syntax is required. The reply must not claim code changes.
FAIL if the atomicity defect or the N+1 is missing, the performance impact is asserted as measured without evidence, or the reply says files were changed or remediation was performed.
