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
- **`GIT_PROVIDER=gitlab`**: `~/.git-credentials` carries the Deploy Token (Step 8a-gitlab). `git push/pull/clone` work without further setup. For `glab issue list` / `glab mr create`: `export GITLAB_TOKEN=${GITLAB_API_TOKEN}` (PAT with `api` scope, optional). If `GITLAB_API_TOKEN` is unset, the `queue` step falls back to "manual mode" — see Step 2.
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

## Step 2 — Pick one issue

### GitHub (`GIT_PROVIDER=github`)

```bash
export GH_TOKEN=$(${SERVICE_PREFIX}-mint-gh-token)
gh issue list --repo ${REPO_SLUG} \
  --state open --label status:ready \
  --json number,title,body,labels,createdAt
```

### GitLab (`GIT_PROVIDER=gitlab`) — when `GITLAB_API_TOKEN` is set

```bash
export GITLAB_TOKEN=$GITLAB_API_TOKEN
glab issue list --repo ${REPO_SLUG} \
  --opened --label status:ready \
  --output json
```

### GitLab (`GIT_PROVIDER=gitlab`) — when `GITLAB_API_TOKEN` is unset (manual mode)

The Deploy Token alone has no `api` scope; `glab issue list` would 401. In manual mode, the dispatcher cannot enumerate issues programmatically. Two options:

1. **Skip queue, run only on operator-supplied issue numbers**: if invoked via `/dispatcher run-now` with an explicit issue param, proceed to Step 3 with that number. Otherwise:
2. **Exit with `queue_unsupported`**:

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -d "{\"run_id\":$RUN_ID,\"status\":\"queue_unsupported\",\"error\":\"GITLAB_API_TOKEN not set; cannot enumerate queue. Set token in /etc/${PROJECT_NAME}/secrets.env to enable.\"}"
exit
```

Operator can then either set `GITLAB_API_TOKEN` (recommended) or invoke specific issues manually.

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

## Step 3 — Claim transaction

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

## Step 4 — Pipeline (4 stages, all via Skill())

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

## Step 5 — Commit, push, open PR/MR

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

(If GitLab in manual mode without `GITLAB_API_TOKEN`, the push has succeeded; report the branch URL to the operator and let them open the MR manually.)

### Close the dispatch run

```bash
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/dispatch/end \
  -d "{\"run_id\":$RUN_ID,\"status\":\"pr_opened\",\"pr_number\":$N,\"pr_url\":\"$URL\",\"branch\":\"agent/issue-<N>-<slug>\"}"
```

## Step 6 — Final notification

Send Telegram: `[claude#<N>] PR/MR opened: <url>`. Exit.

## Hard rules

- One Issue per /${DISPATCH_COMMAND_NAME} invocation. Never loop.
- Never push to `master` directly. Only `agent/*` branches.
- Never amend commits. New commits only.
- Never echo `secrets.env` values to logs/comments/Telegram.
- (`GIT_PROVIDER=github`) If `${SERVICE_PREFIX}-mint-gh-token` errors twice within 30s → `dispatch_end failed` + Telegram alert + exit.
- (`GIT_PROVIDER=gitlab`) If `git push` fails twice within 30s → `dispatch_end failed` + Telegram alert + exit. Likely cause: Deploy Token expired/scope changed; check `/etc/${PROJECT_NAME}/secrets.env` `GITLAB_DEPLOY_TOKEN`.
- If Skill() crashes (tool error, not a documented verdict) → close current phase `status=error`, `dispatch_end failed`, revert label appropriately + Telegram alert + exit.
- Telegram or relay-bot localhost API failures are non-fatal — log and continue.
- Conversational replies outside /${DISPATCH_COMMAND_NAME} are auto-mirrored via Stop hook — DO NOT manually curl Telegram for those. Status pings inside this dispatch ARE direct curl (realtime visibility).
