<!-- SOURCE-OF-TRUTH: shared/references/research_tool_fallback.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Research Tool Fallback

<!-- SCOPE: Runtime fallback chain for documentation/standards research. Read provider from `.hex-skills/environment_state.json` -> `research`, execute in priority order, and mark provenance per `references/epistemic_protocol.md`. -->

## Fallback Chain

Execute in order and stop at the first successful result:

| Priority | Tool | Condition | Trust |
|----------|------|-----------|-------|
| 1 | `mcp__Ref__ref_search_documentation` | provider includes `ref` | High |
| 2 | `mcp__context7` | provider includes `context7` and query is library-specific | High |
| 3 | `WebSearch` | current or broad web research needed | Medium |
| 4 | `WebFetch` | specific URL known | Medium |
| 5 | Built-in knowledge | all tools fail | Low; say it may be outdated |

**MANDATORY READ:** Load `references/epistemic_protocol.md` for source marking.

## Runtime Rules

1. Read `.hex-skills/environment_state.json` -> `research.provider` and fallback chain.
2. Try configured tools in priority order.
3. On tool error, warn once, mark that tool unavailable for the session, and continue.
4. If every tool fails, use built-in knowledge only with an explicit freshness disclaimer.

---
**Version:** 2.0.0
**Last Updated:** 2026-04-05
