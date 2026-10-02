#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p app tests docs/plans
: > app/__init__.py
: > tests/__init__.py
cat > AGENTS.md <<'MD'
# Repository instructions

- Python 3 standard library only; run tests with `python3 -m unittest`.
- Reuse existing modules in `app/` before adding new ones. Outbound calls share the retry policy in `app/retry.py`.
MD
cat > app/retry.py <<'PY'
import random
import time


def retry_with_backoff(fn, *, attempts=3, base_delay=0.5, max_delay=8.0,
                       retry_on=(ConnectionError, TimeoutError), jitter=True,
                       sleep=time.sleep):
    """Call fn(), retrying exceptions in retry_on with capped exponential backoff.

    Other exceptions propagate immediately. After the last attempt the final
    exception is re-raised.
    """
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except retry_on:
            if attempt == attempts:
                raise
            delay = min(max_delay, base_delay * 2 ** (attempt - 1))
            if jitter:
                delay = random.uniform(0, delay)
            sleep(delay)
PY
cat > app/payments.py <<'PY'
from app.retry import retry_with_backoff


class PaymentsClient:
    def __init__(self, transport):
        self.transport = transport

    def capture(self, payment_id):
        return retry_with_backoff(
            lambda: self.transport.post(f"/payments/{payment_id}/capture", {}),
            attempts=4,
        )
PY
cat > app/webhooks.py <<'PY'
import logging

log = logging.getLogger(__name__)


class WebhookRejected(Exception):
    """The receiver answered with a 4xx status; retrying will not help."""


def send_webhook(transport, url, payload):
    response = transport.post(url, payload)
    if 400 <= response.status < 500:
        raise WebhookRejected(f"{url} answered {response.status}")
    return response
PY
cat > tests/test_retry.py <<'PY'
import unittest

from app.retry import retry_with_backoff


class RetryTest(unittest.TestCase):
    def test_retries_transient_error_then_succeeds(self):
        calls = []

        def flaky():
            calls.append(1)
            if len(calls) < 3:
                raise ConnectionError("reset")
            return "ok"

        self.assertEqual(retry_with_backoff(flaky, attempts=3, sleep=lambda _: None), "ok")
        self.assertEqual(len(calls), 3)

    def test_non_retryable_error_is_not_retried(self):
        calls = []

        def broken():
            calls.append(1)
            raise ValueError("bad")

        with self.assertRaises(ValueError):
            retry_with_backoff(broken, attempts=5, sleep=lambda _: None)
        self.assertEqual(len(calls), 1)

    def test_gives_up_after_attempts(self):
        def down():
            raise TimeoutError("slow")

        with self.assertRaises(TimeoutError):
            retry_with_backoff(down, attempts=2, sleep=lambda _: None)


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/plans/webhook-retries.md <<'MD'
# Plan: retry webhook deliveries

## Requirements

- WH-1: Retry transient delivery failures (ConnectionError, TimeoutError) up to 5 attempts with exponential backoff and jitter.
- WH-2: Never retry a receiver rejection (4xx, `WebhookRejected`).
- WH-3: When all attempts fail, log `webhook.delivery_failed` with the URL and the attempt count, then re-raise.

## Steps

1. Create `app/backoff.py` with a new `BackoffRetrier` class: `max_attempts`, `base_delay`, `max_delay`, `jitter`, a tuple of retryable exceptions, and a `run(fn)` method that sleeps with exponential delays between attempts.
2. In `app/webhooks.py`, wrap `transport.post` in `send_webhook` with `BackoffRetrier(max_attempts=5, retryable=(ConnectionError, TimeoutError))`; keep the 4xx check raising `WebhookRejected` outside the retryable set.
3. Catch the final transient exception in `send_webhook`, log `webhook.delivery_failed` with `url` and `attempts=5`, and re-raise.
4. Tests:
   - `tests/test_backoff.py`: delay sequence, jitter bounds, max attempts and non-retryable propagation for `BackoffRetrier`.
   - `tests/test_webhooks.py`: transient failure then success, 4xx not retried, exhausted retries logged and re-raised.

## Verification

`python3 -m unittest`
MD
git add -A
git commit -q -m "Add webhook sender and retry plan"
