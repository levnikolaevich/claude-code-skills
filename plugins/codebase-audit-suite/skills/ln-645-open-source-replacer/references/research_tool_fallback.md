# Research Tool Fallback

<!-- SCOPE: Standardized fallback chain for documentation/standards research across MCP tools. Read provider from .hex-skills/environment_state.json → research section, execute in priority order. -->

## Fallback Chain

Execute in order, stop at first successful result:

| Priority | Tool | Condition | Trust | Best For |
|----------|------|-----------|-------|----------|
| 1 | `mcp__Ref__ref_search_documentation` | environment_state research.provider includes `ref` | High | Standards, RFCs, curated docs |
| 2 | `mcp__context7` (`resolve-library-id` → `get-library-docs`) | Provider includes `context7` AND query is library-specific | High | Library/framework docs |
| 3 | `WebSearch` | Always available | Medium | Current info, broad topics |
| 4 | `WebFetch` | Specific URL known | Medium | Reading specific pages |
| 5 | Built-in knowledge | Last resort | Low | Flag: "Based on training data, may be outdated" |

**MANDATORY READ:** Load `references/epistemic_protocol.md` — source marking for all research output.

**Source Attribution:** When using results from any level, mark provenance per epistemic protocol.

## Usage Pattern

```
1. Read .hex-skills/environment_state.json → research section → provider, fallback_chain
2. FOR EACH tool in chain:
   IF tool available (per config):
     TRY tool(query)
     IF success → RETURN result
     IF error → WARN, mark unavailable, continue chain
3. IF all fail → use built-in knowledge with disclaimer
```

## Runtime Error Handling

Same pattern as environment_state_contract.md:
- On first error → WARN user, update config, continue with next in chain
- Do NOT retry failed tool in same session

## Usage in SKILL.md

```markdown
**MANDATORY READ:** Load `references/research_tool_fallback.md`
```

---
**Version:** 2.0.0
**Last Updated:** 2026-04-05
