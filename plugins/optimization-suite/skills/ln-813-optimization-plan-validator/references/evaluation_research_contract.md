# Evaluation Research Contract

Canonical research contract for every evaluation and audit run.

## Mandatory Rule

Research is mandatory for every evaluation/audit run.

No evaluator or auditor may:
- skip research because the artifact looks strong
- disable MCP Ref in fast-track mode
- treat official-doc lookup as optional

## Required Source Order

Each run must collect evidence from:
1. official documentation and standards
2. MCP Ref
3. Context7 when a concrete library/framework is involved
4. web search for current best practices

The coordinator may overlap these lookups with external-agent review, but may not omit them.

## Minimal Completed Research

If the stack is small or the claim surface is narrow, produce a minimal completed research set:
- at least one official-doc or standard source
- at least one MCP Ref lookup
- at least one best-practice web lookup

Status stays `completed_minimal`, not `skipped`.

## Required Output Shape

Research workers should return compact evidence cards with:
- `topic`
- `source_type`
- `source_ref`
- `claim`
- `verdict`
- `impact`
- `actionability`
- `confidence_tier` — one of:
  - `tier_1` — official documentation, language spec, RFC (max confidence)
  - `tier_2` — established best-practice guide, reputable blog, conference talk
  - `tier_3` — community discussion, Stack Overflow, AI-generated content

## Actionability Gate

Before converting research into a finding or edit, ask:
- what concrete defect or risk in the current artifact does this source-backed claim address?

If none, keep it informational and do not inflate issue severity.

## Token Discipline

- gather research once per run when possible
- share normalized evidence to workers through context artifacts
- keep summaries compact and structured
- avoid duplicating long quotations or long prose dumps

**Version:** 1.0.0
**Last Updated:** 2026-04-10
