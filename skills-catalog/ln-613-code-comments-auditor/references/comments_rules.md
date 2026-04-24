# Code Comments Rules

<!-- SCOPE: Code comments quality rules ONLY. Contains WHY vs WHAT principle, ratio targets (15-20%), forbidden patterns. -->
<!-- DO NOT add here: Audit workflow → ln-610-code-comments-auditor SKILL.md -->

Quality standards for code comments and docstrings.

## Core Principle: WHY not WHAT

Comments should explain **intent and rationale**, not restate code behavior.

### Good Comments (WHY)

```
// Retry 3 times because external API has occasional timeouts
// Using binary search here for O(log n) instead of O(n) linear scan
// Cache expires after 5 min to balance freshness vs performance
// Skip validation for admin users per security policy SEC-2024
```

### Bad Comments (WHAT)

```
// Increment counter     ← Obvious from code
// Loop through array    ← Restates code
// Return the result     ← Unnecessary
// Set x to 5           ← Just reading code
```

### When to Comment

| Comment | Don't Comment |
|---------|---------------|
| Non-obvious algorithm choice | Simple assignments |
| Business rule rationale | Standard patterns |
| Performance optimization reason | Loop iterations |
| Security constraint explanation | Variable declarations |
| Workaround with context | Obvious conditionals |

---

## Density Guidelines

### Target: 15-20% Comment Ratio

| Ratio | Assessment | Action |
|-------|------------|--------|
| <10% | Under-commented | Add context for complex logic |
| 10-15% | Slightly low | Add WHY comments for non-obvious code |
| **15-20%** | **Optimal** | Maintain quality |
| 20-25% | Slightly high | Review for obvious comments |
| >25% | Over-commented | Remove WHAT comments |

### Calculation

```
Comment Ratio = (comment lines / total lines) × 100
```

Exclude:
- Blank lines
- Import statements
- Boilerplate (license headers)

---

## Forbidden Content

### Never Include in Comments

| Forbidden | Reason | Where It Belongs |
|-----------|--------|------------------|
| Dates ("Updated 2024-01-15") | Git tracks this | Git blame |
| Author names | Git tracks this | Git log |
| Historical notes ("was X, now Y") | Clutters code | CHANGELOG |
| Code examples | Belongs in tests/docs | Documentation |

> **Note:** Task/Epic/Story IDs, ADR references — allowed as **spec/requirement links** (`See API-409`, `Per ADR-003`, `RFC 9457`). Forbidden as **development history** (`EP4_07 added filtering`, `Created in Sprint 5`).

### Detection Patterns

```regex
# Dates in comments
(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])

# Historical language
(was|were|used to|previously|before|changed from|migrated from)

# Author references
(Author:|Written by:|Created by:|@author)
```

---

## Comment Compression

**Principle:** Comments should be as concise as possible while preserving meaning.

### Length Limits

| Comment Type | Max Length | Example |
|--------------|------------|---------|
| Inline comment | 1 line (~80 chars) | `// Retry 3x for flaky API` |
| Block comment | 3 lines | Short explanation of complex logic |
| Docstring (function) | 5 lines | Purpose, params, return |
| Docstring (class/module) | 10 lines | Purpose, usage, key methods |

### Compression Techniques

| Verbose | Concise |
|---------|---------|
| `// This function is used to calculate the total` | `// Calculate total` |
| `// We need to do this because...` | `// Because: [reason]` |
| `// The following code will iterate through...` | (remove, obvious from code) |
| `// TODO: In the future we should consider...` | `// TODO: [specific action]` |

### Structured Docstrings

When documenting >3 parameters, use structured format:

```
Good (structured):
/**
 * @param {string} name - User name
 * @param {number} age - User age
 * @param {boolean} active - Is active
 */

Bad (prose):
/**
 * This function takes a name which is the user's name,
 * an age which represents how old the user is, and
 * a boolean active flag that indicates whether...
 */
```

---

## Docstrings Quality

### Must Match

- Function/method name
- All parameters (name, type, description)
- Return type and description
- Raised exceptions

### Red Flags

| Issue | Problem |
|-------|---------|
| Missing parameter | Docstring incomplete |
| Wrong parameter name | Copy-paste error |
| Missing return type | Unclear contract |
| Outdated description | Code changed, doc didn't |
| Generic description | "Does the thing" - unhelpful |

### Validation Checklist

- [ ] All public functions have docstrings
- [ ] Parameter names match function signature
- [ ] Types accurate (if language supports)
- [ ] Return value described
- [ ] Exceptions listed (if any)
- [ ] Examples are runnable

---

## Actuality Checks

### Comment vs Code Mismatch

When comment says one thing and code does another:

1. **Code is truth** - always
2. Flag comment as stale
3. Suggest: "Update comment to match code behavior"

### Stale Indicators

- References removed variables
- Describes different algorithm than implemented
- Mentions features that don't exist
- Links to deleted files/functions

---

## Legacy Cleanup

### Must Remove

| Pattern | Example | Why Remove |
|---------|---------|------------|
| TODO without context | `// TODO: fix this` | No actionable info |
| Old TODO with dates | `// TODO (2023-01): cleanup` | Clearly abandoned |
| Commented-out code | `// oldFunction()` | Git has history |
| Unsupported notes | `// DEPRECATED: use newFunc` | Should be deleted, not noted |
| "Temporary" markers | `// TEMP: workaround` | Often permanent |

### Keep Only If

- TODO has specific action + owner
- Comment explains current behavior
- Note is genuinely temporary (<7 days old)

---

## Quick Audit Commands

```bash
# Find TODO/FIXME
grep -rn "TODO\|FIXME\|XXX\|HACK" src/

# Find commented-out code (language-specific)
grep -rn "^[[:space:]]*//[[:space:]]*[a-zA-Z]*(" src/  # JS/TS
grep -rn "^[[:space:]]*#[[:space:]]*def " src/         # Python

# Find date patterns in comments
grep -rn "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" src/

# Calculate comment ratio (approximate)
find src/ -name "*.ts" -exec sh -c 'echo $(grep -c "//" "$1") / $(wc -l < "$1")' _ {} \;
```
