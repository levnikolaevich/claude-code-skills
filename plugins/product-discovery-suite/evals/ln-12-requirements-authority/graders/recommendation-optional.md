---
type: llm
focus: { source: file, path: docs/product/requirements.md }
---

PASS if the document specifies the overdue-task email from DEC-7 with observable acceptance conditions (overdue timing in the assignee's timezone, at most one email per missed due date, exclusions for completed, unassigned and archived-project tasks, the Settings toggle), and Slack, Microsoft Teams, digests, per-user scheduling, due-soon or mention notifications and manager escalation appear only as optional, proposed, out-of-scope or non-goal items without acceptance criteria that commit them. Requirements REQ-1 to REQ-4 must still be present.
FAIL if any recommendation-only feature is written as a committed or accepted requirement, if the overdue-email rules contradict DEC-7, or if existing requirements were removed or rewritten.
