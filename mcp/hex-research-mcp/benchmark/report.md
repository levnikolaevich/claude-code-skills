# hex-research-mcp Benchmark Report

Rough deterministic estimate: baseline reads all Markdown/YAML/JSON fixture research files; workflow output is JSON.stringify(structuredContent); estimated tokens = ceil(chars / 4). This is not production tokenizer accuracy.

Baseline: 14 files, 6952 chars, 1738 estimated tokens.

| Workflow | MCP chars | MCP estimated tokens | Estimated savings |
|---|---:|---:|---:|
| Find live hypotheses | 416 | 104 | 94.0% |
| Find pending implementation | 438 | 110 | 93.7% |
| Inspect goal | 2422 | 606 | 65.1% |
| Trace lineage | 2207 | 552 | 68.2% |
| Audit drift/refine gaps | 1535 | 384 | 77.9% |

