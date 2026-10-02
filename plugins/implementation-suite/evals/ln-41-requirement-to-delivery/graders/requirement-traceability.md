---
type: llm
---

PASS if the reply maps REQ-PROMO-01 to an executed passing check showing the 10% discount (total 72.00 for subtotal 80.00) and REQ-PROMO-02 to an executed passing check in which the expired code is rejected with PROMO_EXPIRED while the order discount, total and promo code stay unchanged.
FAIL if either requirement ID is missing or renamed, the rejection case is only described rather than executed, success is claimed without executed tests, or the reply reports out-of-scope work such as code stacking, code removal, UI or persistence.
