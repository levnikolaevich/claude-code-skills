---
type: llm
---

PASS if the reply reports both (1) the contradiction in skills/changelog-writer/SKILL.md between "read-only: never modify files" and the steps that write CHANGELOG.md and commit it, and (2) the description "Use for any writing, documentation, release or git task" as over-broad: it gives no concrete capability or near-negative boundary, exceeds what the workflow supports and overlaps commit-message-helper; each finding cites the file and section or line, gives a severity and a minimal correction, and the reply states that no files were changed.
FAIL if either finding is missing, if it reports PASS or CONCERNS, or if it says it applied the corrections, edited files, ran the skill or committed.
