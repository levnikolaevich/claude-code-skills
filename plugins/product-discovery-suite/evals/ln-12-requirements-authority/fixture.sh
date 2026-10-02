#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p docs/product docs/decisions docs/discovery src
cat > docs/product/requirements.md <<'MD'
# Taskboard product requirements

Status values: PROPOSED, ACCEPTED, SUPERSEDED.

## Projects

- **REQ-1 (ACCEPTED):** A workspace member can create a project with a unique name inside the workspace.
  - Acceptance: creating a second project with an existing name shows "A project with this name already exists" and creates nothing.
- **REQ-2 (ACCEPTED):** A task has one optional assignee and an optional due date (calendar date, no time).
  - Acceptance: a task saved without a due date never appears in date-filtered views.
- **REQ-3 (ACCEPTED):** Archived projects are read-only; their tasks cannot be edited or reassigned.
  - Acceptance: editing a task in an archived project is rejected with "This project is archived".

## Notifications

- **REQ-4 (ACCEPTED):** Users manage email notification types on Settings > Notifications; each type has an on/off toggle, default on.
MD
cat > docs/decisions/2026-09-24-product-review.md <<'MD'
# Product review - 2026-09-24

Attendees: product owner (decision owner), engineering lead, design lead.

## DEC-7 - Overdue task email (ACCEPTED)

Problem: assignees miss due dates because nothing tells them a task became overdue (support tickets 2026-Q3 tagged "missed deadline": 57).

Decision: when a task with an assignee passes its due date without being completed, send the assignee one email.

- A task is overdue at 00:00 in the assignee's profile timezone on the day after its due date.
- Send at most one overdue email per task; changing the due date to a future date and missing it again allows one new email.
- No email for completed tasks, unassigned tasks, or tasks in archived projects.
- The email names the task, project and due date and links to the task.
- Respect the existing "Overdue tasks" toggle under Settings > Notifications (REQ-4); add the toggle if it does not exist yet.

Success measure: share of overdue tasks completed within 3 days of becoming overdue. Baseline not yet measured.

## Not decided

- The discovery report's multi-channel proposal was discussed and NOT accepted. Revisit after DEC-7 ships and has a baseline.
MD
cat > docs/discovery/notifications-opportunity.md <<'MD'
# Discovery report - notification opportunity

Status: RECOMMENDATION (not reviewed for commitment)

## Recommendation

Build a notification hub:

1. Overdue, due-soon and mention notifications.
2. Delivery to Slack, Microsoft Teams and email.
3. Daily and weekly digest emails with per-user scheduling (choose day and hour).
4. Manager escalation when a task is overdue for more than 2 days.

Rationale: three competitors offer Slack and Teams delivery; 11 of 40 interviewed customers mentioned Slack.
MD
cat > src/notifications.py <<'PY'
"""Notification delivery for Taskboard."""


def send_overdue_email(task, assignee):
    # TODO: overdue notifications are not implemented yet.
    raise NotImplementedError("overdue email delivery")
PY
cat > README.md <<'MD'
# Taskboard

Product requirements live in docs/product/requirements.md. Accepted decisions live in docs/decisions/.
MD
git add -A
git commit -q -m "Taskboard requirements, decisions and discovery report"
