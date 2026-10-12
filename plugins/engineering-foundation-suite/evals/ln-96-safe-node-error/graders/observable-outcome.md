---
type: llm
focus: trace
---

PASS only if observed files, tool calls and concrete analysis establish the following: The unchanged executed probe observes safe stable public response, one diagnostic event and no canary token exposure. No telemetry infrastructure or retry mechanism is added.
FAIL for unsupported self-reported success, forbidden mutation, or a materially different outcome.
