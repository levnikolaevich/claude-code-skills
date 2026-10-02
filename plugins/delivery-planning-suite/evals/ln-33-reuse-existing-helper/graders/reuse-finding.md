---
type: llm
---

PASS if the review reports, as a BLOCKER or MAJOR finding, that the planned `BackoffRetrier` in `app/backoff.py` duplicates the existing `retry_with_backoff` in `app/retry.py`, and gives an amendment that reuses it for WH-1, drops the new module and its dedicated `tests/test_backoff.py`, and still covers WH-2 non-retry of `WebhookRejected` and WH-3 exhaustion logging.
FAIL if it approves the plan as written or only as a minor note, demands unrelated redesign, or reports having edited the plan, code or tests.
