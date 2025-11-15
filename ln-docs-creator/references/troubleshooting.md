# Troubleshooting Guide

This document provides solutions to common issues when using the x-docs-creator skill.

## Issue 1: User Doesn't Know Answers

**Problem**: User doesn't know answers to some technical questions during Phase 3 discovery.

**Solution**:
- Mark questions as "TBD" and flag for follow-up
- Generate documents with placeholders (e.g., `{{TODO: Define performance requirements}}`)
- Skill can be re-run later to update documentation once answers are available
- Documents remain valid with TBD placeholders for initial planning

## Issue 2: Project Too Small

**Problem**: Project is very small (1-2 person team, simple app) and 19 questions seem excessive.

**Solution**:
- Skip optional questions that don't apply to small projects
- Generate minimal viable technical documentation:
  - Requirements document (simplified FR + critical NFRs only)
  - Simplified Architecture (basic tech stack + deployment diagram)
  - Skip detailed technical specifications and ADRs if not needed
- Focus on Q1-Q8 (requirements + scope) as minimum viable documentation

## Issue 3: Auto-Research Returns Outdated Technologies

**Problem**: Phase 3 Stage 2 auto-research recommends outdated or deprecated technologies.

**Solution**:
- **Verify Research Date**: Skill uses current date (2025) for research
- **Check MCP Ref Results**: Review specific library documentation returned
- **Manually Verify**: Cross-check recommendations with official docs
- **Override if Needed**: Select "Modify" option to override recommendations
- **Report Issue**: If persistent, check skill version and update

---

**Version:** 2.0.0
**Last Updated:** 2025-01-31
