# Reference Documentation

**Version:** {{VERSION}}
**Last Updated:** {{DATE}}

<!-- SCOPE: Reference documentation hub (ADRs, Guides, Manuals) with links to subdirectories -->
<!-- DO NOT add here: ADR/Guide/Manual content → specific files, Project details → project/README.md -->
<!-- DOC_KIND: index -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need to route to ADRs, guides, manuals, or research notes. -->
<!-- SKIP_WHEN: Skip when you already know the exact reference document to open. -->
<!-- PRIMARY_SOURCES: docs/reference/, docs/project/architecture.md, docs/project/tech_stack.md -->

## Quick Navigation

- [Docs Hub](../README.md)
- [ADRs](adrs/)
- [Guides](guides/)
- [Manuals](manuals/)
- [Research](research/)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Routes agents and humans to the canonical reference artifacts for decisions and reusable knowledge. |
| Read When | You need the right ADR, guide, manual, or research note. |
| Skip When | You already know the exact file you need. |
| Canonical | Yes |
| Next Docs | [ADRs](adrs/), [Guides](guides/), [Manuals](manuals/), [Research](research/) |
| Primary Sources | `docs/reference/`, `docs/project/architecture.md`, `docs/project/tech_stack.md` |

---

## Overview

This directory contains reusable knowledge base and architecture decisions:

- **Architecture Decision Records (ADRs)** - Key technical decisions
- **Project Guides** - Reusable patterns and best practices
- **Package Manuals** - API reference for external libraries
- **Research** - Investigation documents answering specific questions

---

## Architecture Decision Records (ADRs)

<!-- Example: [ADR-001: Use React+Next.js](adrs/adr-001-frontend-framework.md) | Accepted | 2024-10-15 -->

{{ADR_LIST}}

---

## Project Guides

<!-- Example: [01-Repository Pattern](guides/01-repository-pattern.md) | 2024-11-10 -->

{{GUIDE_LIST}}

---

## Package Manuals

<!-- Example: [Axios 1.6](manuals/axios-1.6.md) | 2024-10-20 -->

{{MANUAL_LIST}}

---

## Research

<!-- Example: [RSH-001: WebSocket vs SSE](research/rsh-001-websocket-vs-sse.md) | 2025-01-20 -->

{{RESEARCH_LIST}}

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New ADRs added to adrs/ directory
- New guides added to guides/ directory
- New manuals added to manuals/ directory
- New research added to research/ directory

**Verification:**
- [ ] All ADR links in registry are valid
- [ ] All guide links in registry are valid
- [ ] All manual links in registry are valid
- [ ] All research links in registry are valid
- [ ] Placeholders {{ADR_LIST}}, {{GUIDE_LIST}}, {{MANUAL_LIST}}, {{RESEARCH_LIST}} synced with files

---
