# Coordinator Runtime Contract

Shared deterministic runtime model for stateful coordinators.

## Core Model

Every coordinator runtime has:
- `manifest.json` for immutable run inputs
- `state.json` for latest mutable snapshot
- `checkpoints.json` for latest checkpoint per phase plus history
- `history.jsonl` for append-only execution events
- `resume_action` for the next deterministic step
- active pointer indexed by `skill + identifier`

All runtime state is project-scoped and run-scoped.

Runtime code validates:
- manifest shape
- state snapshot shape
- checkpoint entry shape
- history event shape
- active pointer shape

## Required Vocabulary

Required fields:
- `run_id`
- `skill`
- `identifier`
- `phase`
- `complete`
- `paused_reason`
- `pending_decision`
- `final_result`

Rules:
- `DONE` means orchestration completed correctly.
- `PAUSED` means deterministic intervention is required.
- Business failure may still end in `DONE` if follow-up actions were checkpointed correctly.

## Pending Decision Contract

Use one schema across coordinator families:

```json
{
  "kind": "preview_confirmation",
  "question": "Confirm preview?",
  "choices": ["confirm_preview", "cancel"],
  "default_choice": "confirm_preview",
  "context": {},
  "resume_to_phase": "PHASE_6_DELEGATE",
  "blocking": true
}
```

Rules:
- all human approvals are persisted through `PAUSED + pending_decision`
- resume must not depend on chat memory

## Runtime Artifacts vs Public Outputs

Runtime artifacts:
- coordination-only
- run-scoped
- `.hex-skills/runtime-artifacts/runs/{run_id}/{summary_kind}/{identifier}.json`

Public outputs:
- durable project artifacts such as docs, reports, or `.hex-skills/environment_state.json`

These two concerns must never be merged into one file.

## CLI Shape

Each runtime exposes:

```bash
node <runtime>/cli.mjs start ...
node <runtime>/cli.mjs status ...
node <runtime>/cli.mjs checkpoint ...
node <runtime>/cli.mjs advance ...
node <runtime>/cli.mjs pause ...
node <runtime>/cli.mjs complete ...
```

Domain runtimes may add specialized commands such as:
- `record-worker`
- `record-epic`
- `record-plan`
- `record-group`
- `record-cycle`

Status response shape:

```json
{
  "ok": true,
  "active": true,
  "runtime": {
    "skill": "ln-220",
    "identifier": "epic-7",
    "run_id": "ln-220-epic-7-...",
    "phase": "PHASE_6_DELEGATE",
    "complete": false
  },
  "manifest": {},
  "state": {},
  "checkpoints": {},
  "paths": {},
  "resume_action": "Delegate story planning workers"
}
```

Inactive response shape:

```json
{
  "ok": true,
  "active": false,
  "runtime": null
}
```

## Guard Rules

- no transition without a checkpoint for the current phase
- malformed manifest, checkpoint payload, worker summary, or environment state must fail validation before transition
- worker outputs are consumed through machine-readable summaries, never free-text parsing
- `resume_action` must be derivable from state and checkpoints alone
- concurrent runs must not share active pointers or artifact directories

## Relationship to Skill Design

Coordinator `SKILL.md` files should:
- describe the phase map
- describe domain-specific checkpoint payloads
- describe domain-specific guards
- reference this contract as runtime SSOT
- avoid duplicating recovery prose already enforced by the runtime
