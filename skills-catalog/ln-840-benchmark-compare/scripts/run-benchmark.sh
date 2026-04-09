#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
MCP_DIR="$REPO_ROOT/mcp/hex-line-mcp"
HOOK_PATH="$MCP_DIR/hook.mjs"
SERVER_PATH="$MCP_DIR/server.mjs"
RESULTS_DIR="$SKILL_DIR/results"
GOALS="${1:-$SKILL_DIR/references/goals.md}"
EXPECTATIONS="${2:-$SKILL_DIR/references/expectations.json}"
DATE=$(date +%Y-%m-%d)
BENCH_DIR="${BENCH_DIR:-d:/tmp}"
PROMPTS_DIR="$RESULTS_DIR/.prompts-$DATE"
MANIFEST_PATH="$PROMPTS_DIR/manifest.json"
EXTRA_SESSION_ID="${EXTRA_SESSION_ID:-}"
EXTRA_SESSION_LABEL="${EXTRA_SESSION_LABEL:-$EXTRA_SESSION_ID}"
EXTRA_MCP_CONFIG="${EXTRA_MCP_CONFIG:-}"
EXTRA_SETTINGS="${EXTRA_SETTINGS:-}"
EXTRA_STRICT_MCP_CONFIG="${EXTRA_STRICT_MCP_CONFIG:-false}"

mkdir -p "$RESULTS_DIR"

cleanup_worktree() {
  local path="$1"
  if [ -d "$path" ]; then
    git -C "$REPO_ROOT" worktree remove --force "$path" >/dev/null 2>&1 || rm -rf "$path"
  fi
}

sync_current_tree() {
  local destination="$1"
  (
    cd "$REPO_ROOT"
    tar \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='skills-catalog/ln-840-benchmark-compare/results' \
      --exclude='mcp/hex-line-mcp/.tmp' \
      -cf - .
  ) | (
    cd "$destination"
    tar -xf -
  )
}

checkpoint_worktree() {
  local path="$1"
  if [ -n "$(git -C "$path" status --porcelain)" ]; then
    git -C "$path" add -A
    git -C "$path" -c user.name='Benchmark Runner' -c user.email='benchmark@example.invalid' \
      commit --quiet --no-gpg-sign --no-verify -m 'benchmark baseline'
  fi
}

hex_json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

echo "=== Prerequisites ==="
claude --version || { echo "ERROR: claude not found"; exit 1; }
git --version > /dev/null || { echo "ERROR: git not found"; exit 1; }
test -f "$GOALS" || { echo "ERROR: Goals file not found: $GOALS"; exit 1; }
test -f "$EXPECTATIONS" || { echo "ERROR: Expectations file not found: $EXPECTATIONS"; exit 1; }
node --check "$SERVER_PATH" > /dev/null || { echo "ERROR: server syntax check failed"; exit 1; }
node --check "$HOOK_PATH" > /dev/null || { echo "ERROR: hook syntax check failed"; exit 1; }
node --check "$SCRIPT_DIR/extract-scenarios.mjs" > /dev/null || { echo "ERROR: extract-scenarios syntax check failed"; exit 1; }
node --check "$SCRIPT_DIR/parse-results.mjs" > /dev/null || { echo "ERROR: parse-results syntax check failed"; exit 1; }

MCP_CFG="$RESULTS_DIR/.mcp-bench-resolved.json"
node -e "console.log(JSON.stringify({
  mcpServers: {
    'hex-line': {
      command: 'node',
      args: [process.argv[1] + '/mcp/hex-line-mcp/server.mjs']
    }
  }
}, null, 2))" "$REPO_ROOT" > "$MCP_CFG"

HOOK_CMD="node $HOOK_PATH"
HEX_SETTINGS=$(node -e "console.log(JSON.stringify({
  outputStyle: 'hex-line',
  hooks: {
    PreToolUse: [{
      matcher: 'Read|Edit|Write|Grep',
      hooks: [{ type: 'command', command: process.argv[1], timeout: 5 }]
    }]
  }
}))" "$HOOK_CMD")

SESSION_START_OUTPUT=$(printf '%s' '{"hook_event_name":"SessionStart"}' | node "$HOOK_PATH")
SESSION_START_OK=false
if printf '%s' "$SESSION_START_OUTPUT" | grep -q "Hex-line MCP available"; then
  SESSION_START_OK=true
fi

cat > "$RESULTS_DIR/${DATE}-hexline.preflight.json" <<EOF
{
  "serverSyntaxOk": true,
  "hookSyntaxOk": true,
  "sessionStartOk": $SESSION_START_OK,
  "sessionStartOutput": $(hex_json_escape "$SESSION_START_OUTPUT")
}
EOF

if [ "$SESSION_START_OK" != "true" ]; then
  echo "ERROR: SessionStart preflight failed"
  exit 1
fi

echo "Goals: $GOALS"
echo "Expectations: $EXPECTATIONS"
echo "Results: $RESULTS_DIR"
if [ -n "$EXTRA_SESSION_ID" ]; then
  echo "Extra session: $EXTRA_SESSION_LABEL ($EXTRA_SESSION_ID)"
fi

mkdir -p "$PROMPTS_DIR"
node "$SCRIPT_DIR/extract-scenarios.mjs" "$GOALS" "$EXPECTATIONS" "$PROMPTS_DIR" > "$MANIFEST_PATH"

mapfile -t SCENARIOS < <(node -e '
const manifest = require(process.argv[1]);
for (const scenario of manifest.scenarios) {
  process.stdout.write(scenario.id + "|" + scenario.promptFile + "|" + scenario.title + "\n");
}
' "$MANIFEST_PATH")

for row in "${SCENARIOS[@]}"; do
  IFS='|' read -r SCENARIO_ID PROMPT_FILE SCENARIO_TITLE <<< "$row"
  BUILTIN_WT="$BENCH_DIR/bench-${SCENARIO_ID}-builtin"
  HEXLINE_WT="$BENCH_DIR/bench-${SCENARIO_ID}-hexline"
  EXTRA_WT="$BENCH_DIR/bench-${SCENARIO_ID}-${EXTRA_SESSION_ID}"

  echo ""
  echo "=== Scenario: $SCENARIO_TITLE ($SCENARIO_ID) ==="
  cleanup_worktree "$BUILTIN_WT"
  cleanup_worktree "$HEXLINE_WT"
  if [ -n "$EXTRA_SESSION_ID" ]; then
    cleanup_worktree "$EXTRA_WT"
  fi
  git -C "$REPO_ROOT" worktree add "$BUILTIN_WT" HEAD >/dev/null
  git -C "$REPO_ROOT" worktree add "$HEXLINE_WT" HEAD >/dev/null
  if [ -n "$EXTRA_SESSION_ID" ]; then
    git -C "$REPO_ROOT" worktree add "$EXTRA_WT" HEAD >/dev/null
  fi
  sync_current_tree "$BUILTIN_WT"
  sync_current_tree "$HEXLINE_WT"
  if [ -n "$EXTRA_SESSION_ID" ]; then
    sync_current_tree "$EXTRA_WT"
  fi
  checkpoint_worktree "$BUILTIN_WT"
  checkpoint_worktree "$HEXLINE_WT"
  if [ -n "$EXTRA_SESSION_ID" ]; then
    checkpoint_worktree "$EXTRA_WT"
  fi

  (
    cd "$BUILTIN_WT/mcp/hex-line-mcp"
    claude -p \
      --verbose \
      --strict-mcp-config \
      --settings '{"disableAllHooks":true}' \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --max-turns 50 \
      < "$PROMPT_FILE" \
      > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-builtin.jsonl" 2>&1
  ) &
  PID_A=$!

  (
    cd "$HEXLINE_WT/mcp/hex-line-mcp"
    claude -p \
      --verbose \
      --mcp-config "$MCP_CFG" \
      --settings "$HEX_SETTINGS" \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --max-turns 50 \
      < "$PROMPT_FILE" \
      > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-hexline.jsonl" 2>&1
  ) &
  PID_B=$!

  if [ -n "$EXTRA_SESSION_ID" ]; then
    (
      cd "$EXTRA_WT/mcp/hex-line-mcp"
      EXTRA_ARGS=(
        -p
        --verbose
        --dangerously-skip-permissions
        --output-format stream-json
        --max-turns 50
      )
      if [ -n "$EXTRA_MCP_CONFIG" ]; then
        EXTRA_ARGS+=(--mcp-config "$EXTRA_MCP_CONFIG")
      fi
      if [ "$EXTRA_STRICT_MCP_CONFIG" = "true" ]; then
        EXTRA_ARGS+=(--strict-mcp-config)
      fi
      if [ -n "$EXTRA_SETTINGS" ]; then
        EXTRA_ARGS+=(--settings "$EXTRA_SETTINGS")
      fi
      claude "${EXTRA_ARGS[@]}" \
        < "$PROMPT_FILE" \
        > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-${EXTRA_SESSION_ID}.jsonl" 2>&1
    ) &
    PID_C=$!
  fi

  set +e
  wait $PID_A; STATUS_A=$?
  wait $PID_B; STATUS_B=$?
  if [ -n "$EXTRA_SESSION_ID" ]; then
    wait $PID_C; STATUS_C=$?
  fi
  set -e
  if [ -n "$EXTRA_SESSION_ID" ]; then
    echo "Built-in exit: $STATUS_A | Hex-line exit: $STATUS_B | $EXTRA_SESSION_LABEL exit: $STATUS_C"
  else
    echo "Built-in exit: $STATUS_A | Hex-line exit: $STATUS_B"
  fi

  git -C "$BUILTIN_WT" diff --no-ext-diff --stat --patch > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-builtin.diff.txt" || true
  git -C "$HEXLINE_WT" diff --no-ext-diff --stat --patch > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-hexline.diff.txt" || true
  if [ -n "$EXTRA_SESSION_ID" ]; then
    git -C "$EXTRA_WT" diff --no-ext-diff --stat --patch > "$RESULTS_DIR/${DATE}-${SCENARIO_ID}-${EXTRA_SESSION_ID}.diff.txt" || true
  fi
  cleanup_worktree "$BUILTIN_WT"
  cleanup_worktree "$HEXLINE_WT"
  if [ -n "$EXTRA_SESSION_ID" ]; then
    cleanup_worktree "$EXTRA_WT"
  fi
done

echo ""
echo "=== Parsing results ==="
node "$SCRIPT_DIR/parse-results.mjs" \
  "$RESULTS_DIR" \
  "$EXPECTATIONS" \
  "$DATE" \
  "$RESULTS_DIR/${DATE}-comparison.md" \
  "$EXTRA_SESSION_ID" \
  "$EXTRA_SESSION_LABEL"

echo ""
echo "=== Done ==="
echo "Report: $RESULTS_DIR/${DATE}-comparison.md"
