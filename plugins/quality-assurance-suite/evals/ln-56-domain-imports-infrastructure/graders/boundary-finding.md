---
type: llm
---

PASS if the reply cites ADR-0003 and the import of `orders.infrastructure.sqlite_repository` in orders/domain/order.py as a violated accepted rule, traces its consequence through the CLI (orders are saved to a hardcoded `orders.db` while `list` reads the configured `ORDERS_DB`/`var/orders.db`, and domain tests touch a real database), and recommends the smallest repair of passing an `OrderRepository` from the composition root into `place_order`; and it does not claim to have edited code or the ADR.
FAIL if the import is missed, reported only as a style issue without consequence, the reply proposes a rewrite or new pattern instead of the bounded repair, or it says files were changed.
