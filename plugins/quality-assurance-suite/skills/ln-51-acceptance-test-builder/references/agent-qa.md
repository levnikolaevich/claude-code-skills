# agent-qa acceptance evidence

Use this reference only for an existing agent-qa project or an explicit user selection. agent-qa supports natural-language web, Android, and iOS tests with advanced memidex memory and self-improvement. Keep the parent skill's acceptance oracles, test-only mutation scope, and report contract.

## Establish the runner and selected flow

- Locate `agent-qa.config.yaml`, the selected tests or suite, and their requirement IDs. Preserve the project's provider, environment, and test-data choices.
- Use the installed CLI through the project's package manager. The npm examples below use `--no-install` to avoid fetching another version. agent-qa 0.2.3 requires Node.js 24+.
- Record the installed version. Check its help when commands differ from these examples, which were checked against 0.2.3. Consult the [official CLI reference](https://vostride.com/docs/agent-qa/cli) on a version change.
- If the CLI or project setup is missing, report the prerequisite. Do not initialize, upgrade, or switch runners as a side effect of building acceptance tests.

```sh
npx --no-install agent-qa --version
npx --no-install agent-qa run --help
```

Run from the configuration directory. Put a global `--config <path>` before the subcommand. A printed version number is output, not a subcommand.

## Author and check the approved tests

Follow the nearest maintained YAML test and the installed schema. Put independently specified user-visible outcomes in verification steps; do not derive expected results from the implementation. The [test-file reference](https://vostride.com/docs/agent-qa/configuration/test) owns the schema.

Replace `tests/checkout.yaml` with the approved selection:

```sh
npx --no-install agent-qa validate tests/checkout.yaml
npx --no-install agent-qa run tests/checkout.yaml --dry-run
```

Validation checks configuration and test structure. Dry run discovers the selected tests without executing the application. Confirm the selected test IDs and target; neither result proves acceptance. An empty selection remains unproven. Omitting the path can expand execution to all discovered tests.

## Execute and retain the actual outcome

Use only the target, test data, and provider already authorized for this task. Runs can modify application data and incur provider costs. `doctor` may contact a model provider; it is not an offline validation substitute.

```sh
npx --no-install agent-qa run tests/checkout.yaml --junit-output results.xml
```

Choose an approved report path without overwriting user evidence. Preserve the exit code, run ID, and actual report before retries. A dry run with `--junit-output` does not establish that a report exists.

| CLI exit | Interpretation |
|---|---|
| `0` | Passed or healed. Inspect the recorded verdict to distinguish them. |
| `1` | Failed or timed-out test, or a missing required file. Diagnose before classifying it as a product failure. |
| `2` | The run could not start. Execution remains unresolved. |
| `130` | Cancelled. Preserve partial evidence. |

A healed verdict is not an unchanged clean pass. Inspect what changed and whether the original requirement still holds. Do not weaken assertions, repair product code, or remove memory/cache records to produce a pass.

## Resolve the run, not just a filtered list

```sh
npx --no-install agent-qa runs list --json
npx --no-install agent-qa runs overview RUN_ID --json
npx --no-install agent-qa runs knowledge RUN_ID --json
```

Replace `RUN_ID` with the run tied to the selected test, target, and revision. A failed-only list can omit healed, interrupted, or incomplete runs; an empty list proves no acceptance outcome. If the overview has no completed verdict or knowledge reports `evidence-incomplete`, retain that gap.

Use the run's knowledge view to inspect what memidex supplied or learned. If a specific memory record needs investigation, use `knowledge inspect --json` and the [memory inspection reference](https://vostride.com/docs/agent-qa/memory/inspect). Memory is supporting context, not an independent application oracle.

## Map evidence into the parent report

For each requirement, record the selected test, actual execution status, CLI exit, run ID, verdict, and available evidence paths. Separate structure checks, discovery, application execution, and knowledge inspection. Redact secrets and sensitive target data.

Retain the parent verdict mapping: trustworthy executed evidence can establish a product `PASS` or product `FAIL`; missing execution or incomplete evidence requires `PARTIAL`. The parent skill's `DELIVERED` means the approved test work is complete, not that the application is correct. Report the exact missing check and safe next action.

These instructions use the repository's MIT license. The separately installed [agent-qa package](https://github.com/vostride/agent-qa) uses FSL-1.1-ALv2.
