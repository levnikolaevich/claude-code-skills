---
description: "Process one open ${REPO_SLUG} Issue end-to-end through the agile pipeline (ln-300 → ln-310 → ln-400 → ln-500) and open a PR (GitHub) or MR (GitLab). Triggered by ${SERVICE_PREFIX}-dispatch.timer (hourly :07) or manually."
allowed-tools: Bash, Read, Write, Edit, Skill, Glob, Grep
---

# /${DISPATCH_COMMAND_NAME} — process one Issue end-to-end

You are running inside the long-lived **${PROJECT_NAME} god-session**. Your job for this invocation: pick **one** open issue, claim it, drive it through the full agile pipeline (4 stages), open a PR (GitHub) or Merge Request (GitLab), and exit. Do not loop. Do not start a second issue. `${SERVICE_PREFIX}-dispatch.timer` will fire you again at the next `:07`.

## Working environment

- `cwd`: `${PROJECT_DIR}` (clean clone of the repo).
- `secrets.env` is sourced — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and (depending on provider) `GITHUB_*` or `GITLAB_*` are in env. Do not echo their values.
- **Git provider**: this project uses `${GIT_PROVIDER}` (either `github` or `gitlab`). All git/issue commands below branch on this.
- **`GIT_PROVIDER=github`**: `${SERVICE_PREFIX}-mint-gh-token` mints fresh GitHub App installation tokens. `git credential.helper` is wired to it for `git push`. Before first `gh` call: `export GH_TOKEN=$(${SERVICE_PREFIX}-mint-gh-token)`.
- **`GIT_PROVIDER=gitlab`**: `~/.git-credentials` carries this project's `GITLAB_GIT_USERNAME` + `GITLAB_GIT_TOKEN` for clone/pull/push. For `glab issue list` / `glab mr create`: `export GITLAB_TOKEN=${GITLAB_API_TOKEN}`. Missing provider tokens are configuration errors; stop and alert.
- **claude-relay-bot HTTP API at `http://127.0.0.1:${RELAY_HOOK_PORT}`** — used below for dispatch tracking (durable audit in SQLite). Conversational replies to operator are auto-mirrored via Stop hook; `/${DISPATCH_COMMAND_NAME}` status pings still go via direct curl as before for realtime visibility.

## Telegram outbound (curl pattern, for realtime status pings)

```bash
curl -fsS -X POST \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=<message>" \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" >/dev/null || true
```

## Step 1 — Open dispatch run + budget gate

```bash
RUN_ID=$(curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/start \
  -H 'Content-Type: application/json' \
  -d '{"trigger":"cron"}' | jq -r .run_id)
```

Run `/usage`. If weekly remaining < 30% OR 5h-window remaining < 20%:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -H 'Content-Type: application/json' \
  -d "{\"run_id\":$RUN_ID,\"status\":\"budget_skip\",\"error\":\"weekly=<X>%,5h=<Y>%\"}"
# send Telegram throttled message, then exit
```

Before selecting a new issue, inspect recent dispatch runs. If any run for a `status:ready` issue has `status=waiting_approval`, send one Telegram reminder and exit. Do not pick or claim another issue while approval is pending.

## Step 2 — Pick one issue for planning only

### GitHub (`GIT_PROVIDER=github`)

```bash
export GH_TOKEN=$(${SERVICE_PREFIX}-mint-gh-token)
gh issue list --repo ${REPO_SLUG} \
  --state open --label status:ready \
  --json number,title,body,labels,createdAt
```

### GitLab (`GIT_PROVIDER=gitlab`)

```bash
export GITLAB_TOKEN=$GITLAB_API_TOKEN
test -n "$GITLAB_TOKEN" || { echo "GITLAB_API_TOKEN missing"; exit 1; }
glab issue list --repo ${REPO_SLUG} \
  --opened --label status:ready \
  --output json
```

### Sort + queue-empty handling (all providers)

Sort: `priority:p1` > `priority:p2` > `priority:p3`; oldest `createdAt` (GitHub) / `created_at` (GitLab) wins ties.

If queue is empty:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -d "{\"run_id\":$RUN_ID,\"status\":\"queue_empty\"}"
# Telegram: [claude] queue empty, idle
exit
```

If picked an issue:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"issue_pick\",\"status\":\"go\",\"details\":\"#$N $TITLE\"}"
```

## Step 3 — Send plan and wait for approval

Do read-only inspection only: issue body, labels, existing project rules, obvious affected files, and relevant tests. Do not edit files, create branches, change tracker labels, commit, push, restart services, or open PR/MR.

Send Telegram a short plan:

```text
[claude#<N>] plan ready
Goal: ...
Areas: ...
Steps: ...
Checks: ...
Risks/rollback: ...
Reply: approve #<N> / делай #<N>
```

Record the gate and end this invocation:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"approval\",\"status\":\"waiting_approval\",\"verdict\":\"plan_sent\",\"details\":\"#$N $TITLE\"}"
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -d "{\"run_id\":$RUN_ID,\"status\":\"waiting_approval\",\"error\":\"operator approval required for #$N\"}"
exit
```

## Step 4 — Approval continuation and claim transaction

Run this section only after explicit operator approval: `approve #<N>`, `approved #<N>`, `go #<N>`, `делай #<N>`, `одобряю #<N>`, or `утверждаю #<N>`. Verify `/dispatch/recent` contains a matching `waiting_approval` run for issue `#<N>`. If not, stop and ask the operator to rerun `/${DISPATCH_COMMAND_NAME}`.

### GitHub

```bash
gh issue edit <N> --repo ${REPO_SLUG} \
  --remove-label status:ready --add-label status:in-progress
```

### GitLab

```bash
glab issue update <N> --repo ${REPO_SLUG} \
  --unlabel status:ready --label status:in-progress
```

If it fails: `dispatch_end status="failed"`, exit.

Send Telegram: `[claude#<N>] starting pipeline on <title>`.

## Step 5 — Pipeline (4 stages, all via Skill())

For each stage: open a phase row before the Skill() call, close it with the verdict after.

For each Skill call, pass the input as a YAML/Markdown block containing:

- `input_story`: number, title, labels, priority, body (the issue verbatim).
- `constraints`: branch convention `agent/issue-<N>-<slug>`, target master, never push to master directly, prefer naturalized prose in PR/MR bodies. (Project may add more — see project's `CLAUDE.md` and `.claude/rules/`.)
- `mandatory_bindings`: project-specific policy/rule files. Discover via `ls .claude/rules/ SAFETY.md skills-catalog/TEMPLATE.md 2>/dev/null` and bind whatever is present.
- `task_provider`: `file` (no Linear in this project unless configured).

### Stage 0: ln-300 task decomposition

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"ln-300\",\"status\":\"running\"}"
```

```text
Skill(skill: "agile-workflow:ln-300-task-coordinator", args: <handoff>)
```

On success: `dispatch_phase ln-300 status=go verdict="$TASK_COUNT tasks"` + Telegram.
On error: `dispatch_phase ln-300 status=error` + `dispatch_end status=blocked` + label + exit.

### Stage 1: ln-310 validation

```text
Skill(skill: "agile-workflow:ln-310-multi-agent-validator", args: <ln-300 output>)
```

On GO: `dispatch_phase ln-310 status=go verdict=GO`. On NO-GO: retry once. Second NO-GO: `status=no_go verdict="NO_GO x2"` + `dispatch_end blocked` + exit.

### Stage 2: ln-400 execution

```text
Skill(skill: "agile-workflow:ln-400-story-executor", args: <validated plan>)
```

On success: `dispatch_phase ln-400 status=go`. On error: `dispatch_phase ln-400 status=error` + `dispatch_end blocked` + exit.

### Stage 3: ln-500 quality gate

```text
Skill(skill: "agile-workflow:ln-500-story-quality-gate", args: <execution artifact>)
```

PASS / CONCERNS → proceed to Step 5. FAIL → rework via ln-400 once; second FAIL → `dispatch_end blocked`. WAIVED — only if issue body explicitly authorizes; otherwise treat as FAIL.

## Step 6 — Commit, push, open PR/MR

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/phase \
  -d "{\"run_id\":$RUN_ID,\"phase\":\"pr_create\",\"status\":\"running\"}"

git checkout -b agent/issue-<N>-<slug>
git add -A
git commit -m "<conventional commit summary>"
git push -u origin agent/issue-<N>-<slug>
```

### GitHub — open PR

```bash
gh pr create --repo ${REPO_SLUG} --base master --head agent/issue-<N>-<slug> \
  --title "<concise title>" --body "Closes #<N> ..."
```

### GitLab — open MR

```bash
glab mr create --repo ${REPO_SLUG} --target-branch master --source-branch agent/issue-<N>-<slug> \
  --title "<concise title>" --description "Closes #<N> ..."
```

### Close the dispatch run

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -d "{\"run_id\":$RUN_ID,\"status\":\"pr_opened\",\"pr_number\":$N,\"pr_url\":\"$URL\",\"branch\":\"agent/issue-<N>-<slug>\"}"
```

## Step 7 — Final notification

Send Telegram: `[claude#<N>] PR/MR opened: <url>`. Exit.

## Hard rules

- One Issue per /${DISPATCH_COMMAND_NAME} invocation. Never loop.
- No implementation before approval. Before explicit `approve #N` / `делай #N`, only read issue/project context, send the plan, record `waiting_approval`, and exit.
- Never push to `master` directly. Only `agent/*` branches.
- Never amend commits. New commits only.
- Never echo `secrets.env` values to logs/comments/Telegram.
- (`GIT_PROVIDER=github`) If `${SERVICE_PREFIX}-mint-gh-token` errors twice within 30s → `dispatch_end failed` + Telegram alert + exit.
- (`GIT_PROVIDER=gitlab`) If `git push` or `glab` fails twice within 30s → `dispatch_end failed` + Telegram alert + exit. Likely cause: `GITLAB_GIT_TOKEN` or `GITLAB_API_TOKEN` expired/scope changed in `/etc/${PROJECT_NAME}/secrets.env`.
- If Skill() crashes (tool error, not a documented verdict) → close current phase `status=error`, `dispatch_end failed`, revert label appropriately + Telegram alert + exit.
- Telegram or relay-bot localhost API failures are non-fatal — log and continue.
- Conversational replies outside /${DISPATCH_COMMAND_NAME} are auto-mirrored via Stop hook — DO NOT manually curl Telegram for those. Status pings inside this dispatch ARE direct curl (realtime visibility).
