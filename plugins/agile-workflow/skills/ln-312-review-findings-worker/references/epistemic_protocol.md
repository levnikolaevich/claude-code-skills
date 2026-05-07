<!-- SOURCE-OF-TRUTH: shared/references/epistemic_protocol.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Epistemic Protocol

<!-- SCOPE: Source attribution and anti-hallucination rules for ALL fact-sensitive skill outputs. Covers versions, APIs, standards, market data, performance claims. -->

Universal source marking protocol for research outputs. When producing factual claims, mark provenance so consumers can assess trust level.

## A. Source Hierarchy

| Priority | Source | Trust | Mark Format |
|----------|--------|-------|-------------|
| 1 | Project files (package.json, lockfiles, *.csproj) | Authoritative | `(project: {file})` |
| 2 | MCP tools (Ref, Context7) | High | `(verified via Ref/Context7)` |
| 3 | WebSearch / WebFetch results | Medium | `(web: {date})` |
| 4 | Training data | Low | `(from training, verify)` |
| 5 | No source available | None | `(UNCERTAIN)` |

Higher priority overrides lower. If project manifest says `v5.2.0` and Context7 says `v5.3.0`, trust the manifest (Priority 1).

## B. Mandatory Verification Triggers

Do NOT rely on training data alone for these claim types. Use MCP tools or flag explicitly.

| Trigger | Examples | Required Action |
|---------|----------|-----------------|
| Version numbers | "v5.2.0", "latest stable" | Context7 or project manifest |
| API signatures | Method names, parameters, return types | Ref or Context7 docs |
| Unsupported API claims | "X unsupported", "Y replaced Z" | MCP Ref for current status |
| Existence claims | "Library X exists", "Library X has method Y" | Context7 docs or WebSearch |
| Security standards | OWASP rule numbers, CVE IDs | MCP Ref |
| Market data | Market size, shares, trends | WebSearch required |
| Performance characteristics | "Handles N ops/sec", "O(1) lookup" | Benchmark source or docs |

## C. Anti-Hallucination Rules

1. Do NOT "correct" modern code syntax to older patterns familiar from training
2. Do NOT claim "X does not exist" without MCP tool verification
3. Do NOT fabricate version numbers or metrics -- use `(UNCERTAIN)` if tools unavailable
4. Do NOT mix verified and unverified data without marking each claim
5. Do NOT substitute factual data (market, performance) with "reasonable assumptions"
6. PERMITTED: say `(UNCERTAIN -- tool verification needed)` instead of guessing

## D. Output Marking Convention

Where to place source marks depending on output context:

| Context | Mark Placement |
|---------|---------------|
| Library Research table | Source column: `Context7` / `Ref` / `training` |
| Technical Notes inline | Parenthetical: `v5.2.0 (verified via Context7)` |
| Research documents (rsh-NNN) | Methodology section + per-finding source |
| Market/competitor claims | `(WebSearch: {date})` or `(UNCERTAIN)` |
| Performance claims | `(benchmark: {source})` or `(static analysis only)` |
| Standards compliance | `RFC 7231 (verified via Ref)` |

## E. Fallback Behavior

Extends Level 5 of `research_tool_fallback.md`.

`(UNCERTAIN)` is valid ONLY after exhausting the ENTIRE fallback chain (Ref -> Context7 -> WebSearch -> WebFetch). If WebSearch is available but was not attempted, use it before marking `(UNCERTAIN)`.

When ALL tools in the chain are unavailable or returned no results:
- Mark each claim: `(from training, verify)`
- If claim matches a trigger from Section B: append `-- VERIFY before implementation`
- Do NOT present training-sourced claims as verified fact

---
**Version:** 1.0.0
**Last Updated:** 2026-03-18
