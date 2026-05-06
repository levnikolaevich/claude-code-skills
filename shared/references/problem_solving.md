# Problem-Solving: Root Cause First

> **Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

Universal checklist for planning, review, and rework phases.

## Before ANY fix, run this checklist:

### 1. 5 Whys — Chain until root cause

**How:**
- Start: "What broke?" → State symptom
- Ask "Why?" → Immediate cause
- Repeat until config/architecture level

**Stop when:**
- Answer is design decision, not code behavior
- Fix = one-line config change
- You say "system wasn't designed for..."

### 2. Fragility Test

"If this code changes later, will fix silently break?"
- YES → coupling to details → **fragile**
- NO → explicit contracts → **robust**

### 3. Scope Test

"Where else can this symptom appear?"
- List all code paths
- If fix covers one path → wrong abstraction level

### 4. Docs First

Search official docs BEFORE custom solutions.

### 5. Fix Hierarchy (prefer higher)

```
Configuration > Infrastructure > Framework > Application code
```

## Red Flags (stop and rethink)

- Fix requires "remembering" something
- Magic parameters to make it work
- Same issue appeared elsewhere
- Docs don't mention your approach
- Works but can't explain WHY

## Rationalization Table

| Excuse | Reality |
|--------|--------|
| "Issue is simple" | Simple issues have root causes too |
| "Emergency, no time" | Systematic is FASTER than thrashing |
| "Just try this first" | First fix sets the pattern for worse |
| "One more attempt" (after 2+) | 3+ failures = architectural problem, STOP |
| "I know what's wrong" | Then proving it takes 30 seconds |
| "Works on my machine" | Reproduce in target environment first |

**Escalation:** If 3+ fix attempts failed → STOP, question architecture, discuss with user.

---
**Version:** 1.1.0
**Last Updated:** 2026-03-24
