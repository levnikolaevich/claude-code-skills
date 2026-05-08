# hex-research-mcp Benchmark Report

Rough deterministic estimate: baseline reads all Markdown/YAML/JSON fixture research files; workflow output is JSON.stringify(structuredContent); estimated tokens = ceil(chars / 4). This is not production tokenizer accuracy.

Baseline: 15 files, 7115 chars, 1779 estimated tokens.

| Workflow | MCP chars | MCP estimated tokens | Estimated savings |
|---|---:|---:|---:|
| Find live hypotheses | 607 | 152 | 91.5% |
| Find pending implementation | 620 | 155 | 91.3% |
| Inspect goal | 2999 | 750 | 57.8% |
| Trace lineage | 2207 | 552 | 69.0% |
| Audit drift/refine gaps | 1337 | 335 | 81.2% |

