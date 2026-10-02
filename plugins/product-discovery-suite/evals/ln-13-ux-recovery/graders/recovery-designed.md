---
type: llm
focus: { source: file, path: docs/design/payout-account-flow.md }
---

PASS if the design (1) gives actionable field-level error messages without exposing internal codes to the seller, (2) preserves entered values after validation failure and timeout, (3) defines focus movement and error announcements after failed submit, (4) specifies the 15-second timeout, same-submission-key retry, and honest handling of an unknown save outcome, and (5) labels the author's walkthrough as artifact inspection or an untested assumption, naming what needs real user evidence. The fixture guarantees idempotency but does not define result retrieval or key lifetime; identifying that contract gap and marking readiness INCOMPLETE is valid. Proposed result-retrieval behavior must be labeled as conditional rather than an existing capability.
FAIL if any required interaction is missing, the form is cleared on error, retry creates a new submission while the prior outcome is unknown, successful saving is inferred from a timeout, an unsupported retrieval contract is presented as established, or the walkthrough is called user research or usability testing.
