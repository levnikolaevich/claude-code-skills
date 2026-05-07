<!-- SOURCE-OF-TRUTH: shared/references/evaluation_parallelism_policy.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Parallelism Policy

Canonical parallelism policy for the evaluation platform.

## Default

Sequential is the default.

Parallelism is allowed only for independent read-only branches.

## Allowed Parallel Lanes

Parallel work may overlap when branches:
- do not mutate shared artifacts
- do not depend on each other's outputs
- do not gate later ordering-sensitive phases individually

Typical allowed overlap:
- external background agents
- research worker
- local findings worker
- domain discovery or inventory reads

## Disallowed Parallel Lanes

Do not parallelize:
- docs generation that mutates shared outputs
- repair/autofix phases
- merge/application phases
- iterative refinement
- approval/status mutation
- final self-check

## Join Barrier Rule

Before aggregation or synthesis:
- all planned workers in the same join group must have recorded summaries
- no worker in that join group may remain inflight

## Required Worker Plan Fields

Every parallelized worker plan entry must define:
- `lane`
- `join_group`
- `depends_on`

Interpretation:
- `lane` describes concurrent execution bucket
- `join_group` describes the barrier to wait on
- `depends_on` must be empty for read-only parallel branches

## Agent Overlap Rule

Background agents may overlap with research and local read-only analysis.

They do not remove the need for join barriers:
- merge may not start until required agents are resolved
- completion may not happen while any required agent or worker is unresolved

**Version:** 1.0.0
**Last Updated:** 2026-04-10
