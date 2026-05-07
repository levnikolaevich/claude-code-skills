---
description: "Work on one provider issue selected by hex-relay control plane for ${REPO_SLUG}."
allowed-tools: Bash, Read, Write, Edit, Skill, Glob, Grep
---

# /${DISPATCH_COMMAND_NAME} — work on a selected task

You are running inside the long-lived **${PROJECT_NAME} god-session**. This command is a work-plane continuation for a task selected by hex-relay through `/tasks`; it does not enumerate provider issues by itself.

## Working environment

- `cwd`: `${PROJECT_DIR}`.
- Strict sandbox mode exposes the project folder as writable and installed skills/plugins as read-only.
- Provider secrets, Telegram tokens, relay database files, systemd files, sibling `/opt/*` projects, and shared CLI auth/config are control-plane resources. Shared `$HOME/.claude` and `$HOME/.codex` exist only so Claude/Codex can run and refresh auth; do not inspect, copy, or modify auth/config there unless the operator explicitly asks for auth repair.
- The selected task details are provided in the injected prompt: issue number, title, URL, labels, and body.
- Use `http://127.0.0.1:${RELAY_HOOK_PORT}` only for hex-relay audit endpoints documented below. Do not send Telegram messages directly; final replies are mirrored by hooks.

## Step 1 — Open Dispatch Run

Create a dispatch audit row. Use `trigger="telegram_task"` for `/tasks` handoffs.

```bash
RUN_ID=$(curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/start \
  -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"trigger\":\"telegram_task\",\"issue_number\":<N>,\"issue_title\":\"<title>\"}" \
  | jq -r .run_id)
```

Run `/usage`. If weekly remaining is below 30% or 5h-window remaining is below 20%, close the run with `budget_skip`, explain the budget state in the final reply, and exit.

## Step 2 — Plan First

Do read-only inspection only: task body, project rules, obvious affected files, and relevant tests. Do not edit files, create branches, commit, restart services, or alter provider state before approval.

Return a short plan:

```text
[task #<N>] plan ready
Goal: ...
Areas: ...
Steps: ...
Checks: ...
Risks/rollback: ...
Reply: approve #<N> / делай #<N>
```

Record the approval gate:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"approval\",\"status\":\"waiting_approval\",\"verdict\":\"plan_sent\",\"details\":\"#<N> <title>\"}"
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"run_id\":$RUN_ID,\"status\":\"waiting_approval\",\"error\":\"operator approval required for #<N>\"}"
```

Exit after sending the plan unless the current Telegram turn already contains explicit approval.

## Step 3 — Approval Continuation

Proceed only after explicit approval: `approve #<N>`, `approved #<N>`, `go #<N>`, `делай #<N>`, `одобряю #<N>`, or `утверждаю #<N>`.

If provider state must be changed, report the needed transition in the final answer. Provider issue labels, assignment, PR/MR creation, and token-backed operations belong to the control plane/operator path, not this sandboxed command.

## Step 4 — Pipeline

For each stage, open a phase row before the Skill call and close it with the verdict after.

### Stage 1: ln-300 task decomposition

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"ln-300\",\"status\":\"running\"}"
```

```text
Skill(skill: "agile-workflow:ln-300-task-coordinator", args: <selected task handoff>)
```

On success: close `ln-300` with `status=go`. On error: close current phase with `status=error`, close dispatch with `status=blocked`, explain the blocker, and exit.

### Stage 2: ln-310 validation

```text
Skill(skill: "agile-workflow:ln-310-multi-agent-validator", args: <ln-300 output>)
```

On GO: close `ln-310` with `status=go`. On NO-GO: retry once. Second NO-GO closes dispatch with `status=blocked`.

### Stage 3: ln-400 execution

```text
Skill(skill: "agile-workflow:ln-400-story-executor", args: <validated plan>)
```

Keep all reads and edits inside `${PROJECT_DIR}`. If a command needs cache/temp storage, use project-local paths such as `.cache/`, `.tmp/`, or tool-specific directories under the project.

### Stage 4: ln-500 quality gate

```text
Skill(skill: "agile-workflow:ln-500-story-quality-gate", args: <execution artifact>)
```

PASS or CONCERNS may proceed. FAIL requires one rework pass through ln-400; second FAIL closes dispatch with `status=blocked`.

## Step 5 — Local Git Artifact

Create a local branch and commit only after the approved pipeline has changed files.

```bash
git checkout -b agent/issue-<N>-<slug>
git add -A
git commit -m "<conventional commit summary>"
```

Do not push or open provider PR/MR from the sandbox unless the control plane has explicitly supplied a safe project-scoped mechanism for that operation.

Close the dispatch run:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"run_id\":$RUN_ID,\"status\":\"completed\",\"branch\":\"agent/issue-<N>-<slug>\"}"
```

## Hard Rules

- One selected task per invocation. Never loop and never choose a different issue.
- No implementation before approval.
- Never push to `master` directly.
- Never amend commits. New commits only.
- Never echo secret values to logs, comments, or Telegram.
- Do not enumerate provider issues or configure provider tokens from the work plane.
- Do not call host service managers or inspect VPS control-plane files.
- hex-relay localhost API failures are non-fatal for project work, but must be mentioned in the final answer.
