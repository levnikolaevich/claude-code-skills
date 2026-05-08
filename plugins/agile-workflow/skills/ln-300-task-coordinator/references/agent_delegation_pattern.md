<!-- SOURCE-OF-TRUTH: shared/references/agent_delegation_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Agent Delegation Pattern

Core pattern for launching a non-host external CLI advisor through `references/agents/agent_runner.mjs`. Use it only when independent model review or long-running isolated analysis is worth the overhead.

## Use When

- A second model can catch plan, review, or validation gaps.
- Work can run independently while the host continues local evidence collection.
- The host remains the decision maker and verifies every advisor claim.

Do not launch advisors for trivial checks, purely mechanical edits, or work the host can verify directly with tests/tools.

## Invocation

Use prompt files for non-trivial context and metadata files for deterministic runtime bookkeeping.

```bash
node references/agents/agent_runner.mjs --agent {advisor_agent} --prompt-file prompt.md --output-file result.md --metadata-file result.meta.json --cwd /project
node references/agents/agent_runner.mjs --health-check --json --host-agent {claude|codex}
node references/agents/agent_runner.mjs --agent {advisor_agent} --resume-session {session_id} --prompt-file followup.md --output-file result.md --cwd /project
```

## Output Contract

Stdout is JSON with at least:

```json
{
  "success": true,
  "agent": "advisor",
  "response": "...",
  "session_id": "optional",
  "pid": 12345,
  "log_file": "...log",
  "output_file": "...result.md",
  "exit_code": 0,
  "error": null
}
```

When `--output-file` is used, the runner wraps the result with `AGENT_REVIEW_RESULT` metadata markers. Skills read the result file and metadata; they must not rewrite runner-owned result files.

## Prompt Rules

- State the exact review goal and required output shape.
- Keep scope narrow: one review task per call.
- Pass file paths, URLs, or artifacts; let the advisor read needed source material.
- Include confidence/filtering rules so the host can reject unsupported claims.
- Require markdown findings plus a structured JSON block when the result is consumed programmatically.

## Fallback Rules

- Health check fails or no advisor available -> record skipped reason and use host self-review when that is acceptable for the skill.
- Advisor crashes, times out, or returns transport/auth/tool errors -> treat as transport evidence, not as a domain finding.
- Advisor claims require host verification before merge, repair, approval, or verdict changes.
- Long-running lifecycle, liveness, retry, and refinement rules live in `references/agent_review_workflow.md`; load that file only for skills that actually run an agent review loop.

---
**Version:** 2.0.0
**Last Updated:** 2026-03-26
