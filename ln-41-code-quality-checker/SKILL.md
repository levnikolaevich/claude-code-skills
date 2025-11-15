---
name: ln-41-code-quality-checker
description: Analyzes code quality for DRY/KISS/YAGNI/Architecture/guide violations in Done implementation tasks. Reports structured issues. Worker skill - does NOT create tasks or change statuses.
---

# Code Quality Checker Skill

Analyze code quality of Done implementation tasks to identify DRY, KISS, YAGNI, architecture violations, and guide compliance issues.

## When to Use This Skill

This skill should be used when:
- Need to verify code quality before manual testing
- Part of Story Review (Phase 4 Step 1 in ln-30-story-executor - FIRST quality gate)
- All implementation tasks are Done (before regression/manual testing)
- Want to catch refactoring opportunities early (Fail Fast principle)

**Note:** This is an atomic worker skill with single responsibility - it ONLY analyzes code quality and reports issues. It does NOT create refactoring tasks, change Story/Task statuses, or make workflow decisions.

## Workflow

### Phase 1: Discovery

Auto-discovers project configuration and loads Story details.

**Steps:**
1. Load Story from Linear via `mcp__linear-server__get_issue(id=Story.id)`
2. Extract Story.id (UUID) for parentId filter
3. Read `docs/guides/` directory to discover available guides
4. Parse Story Technical Notes section to extract guide links

**Output:**
- Story object with full details
- Story.id (UUID)
- List of available guides in project
- List of guide links from Story (for guide compliance check)

### Phase 2: Load Done Implementation Tasks

Load all Done implementation tasks for Story (excluding test tasks).

**Steps:**
1. Query Linear for Story's child tasks:
   ```javascript
   mcp__linear-server__list_issues({
     parentId: Story.id,  // UUID, not short ID
     state: "Done"
   })
   ```
2. Filter OUT test tasks (label "tests" or title contains "test")
3. For each implementation task:
   - Load full description from Linear
   - Extract git branch/commit from task comments (if available)
   - Identify affected files from task "Affected Components" section

**Output:**
- Array of Done implementation tasks (excluding test tasks)
- Total implementation tasks count
- List of affected files per task

### Phase 3: Analyze Code & Check Violations

Analyze git diff for each implementation task and check for 5 violation types.

**Step 1: Analyze Code Changes**

**Process:**
1. For each task:
   - If branch mentioned in task → `git diff main...[branch]`
   - If no branch → `git log --oneline --since="[task created date]" --until="[task completed date]"`
   - Extract affected files from git diff
2. For each affected file:
   - Read file content via Read tool
   - Parse AST (Abstract Syntax Tree) for code structure
   - Identify: functions, classes, imports, complexity metrics
3. Build code analysis data structure

**Output:**
- Array of code changes per task
- File contents
- AST metadata (functions, classes, imports)

**Step 2: Check 5 Violation Types**

The skill checks code for the following violations (DRY, KISS, YAGNI, Architecture, Guide Compliance):

**1. DRY Violations (Don't Repeat Yourself)**

**Detection:**
- Duplicate function/method signatures (same name, params, logic)
- Duplicate code blocks (similarity >80%)
- Duplicate validation logic
- Duplicate error handling patterns

**Example violation:**
```python
# auth/service.py
def validate_email(email):
    if not email or '@' not in email:
        raise ValueError("Invalid email")

# users/service.py
def validate_email(email):  # DUPLICATE!
    if not email or '@' not in email:
        raise ValueError("Invalid email")
```

**Suggestion:** Extract to shared validator module

**Severity:** HIGH if >2 duplicates, MEDIUM if 2 duplicates

**2. KISS Violations (Keep It Simple)**

**Detection:**
- High cyclomatic complexity (>10 for function)
- Deep nesting (>4 levels)
- Long functions (>50 lines)
- Complex boolean expressions (>3 conditions)

**Example violation:**
```python
def process_user(user):
    if user:
        if user.active:
            if user.role == 'admin':
                if user.permissions:
                    if 'delete' in user.permissions:  # 5 levels deep!
                        return True
    return False
```

**Suggestion:** Simplify with early returns or guard clauses

**Severity:** HIGH if complexity >15, MEDIUM if complexity >10

**3. YAGNI Violations (You Aren't Gonna Need It)**

**Detection:**
- Unused functions/classes (defined but never called)
- Premature abstraction (interface with single implementation)
- Over-engineered solutions (design patterns for simple problems)
- Feature toggles for features not in AC

**Example violation:**
```python
# Premature abstraction
class UserRepositoryInterface:  # Only one implementation exists!
    def get_user(self, id): pass

class UserRepository(UserRepositoryInterface):
    def get_user(self, id):
        return db.query(User).get(id)
```

**Suggestion:** Remove interface until second implementation needed

**Severity:** MEDIUM (doesn't break functionality, but adds maintenance burden)

**4. Architecture Violations**

**Detection:**
- Layer violations (e.g., controller imports repository directly, skipping service)
- Circular dependencies (module A imports B, B imports A)
- Domain logic in controllers/views
- Business logic in models (should be in services)

**Example violation:**
```python
# controllers/user_controller.py
from repositories.user_repository import UserRepository  # VIOLATION!
# Should import from services/, not repositories/

def get_user(user_id):
    user_repo = UserRepository()  # Domain logic in controller
    return user_repo.get(user_id)
```

**Suggestion:** Follow layer hierarchy: Controller → Service → Repository

**Severity:** HIGH (breaks architecture, creates coupling)

**5. Guide Compliance**

**Detection:**
- Story Technical Notes lists guide links
- Code doesn't use recommended patterns from guides
- Code uses deprecated/discouraged patterns

**Steps:**
1. Load guides from `docs/guides/` mentioned in Story Technical Notes
2. Parse guide "Recommended Solution" and "Implementation Pattern" sections
3. Check if code follows patterns:
   - Uses recommended library/framework
   - Follows recommended structure
   - Uses recommended API methods

**Example violation:**
Story links Guide 01: OAuth 2.0 Implementation (recommends authlib v1.3+)

```python
# Code uses custom JWT implementation instead!  # VIOLATION!
import jwt
token = jwt.encode({'user_id': 123}, 'secret', algorithm='HS256')
```

**Suggestion:** Use authlib as recommended in Guide 01

**Severity:** HIGH if security/critical pattern, MEDIUM otherwise

---

### Phase 4: Report Results

Report violations to Linear and return JSON verdict.

**Steps:**
1. Categorize issues by severity:
   - HIGH: Architecture violations, security issues, guide non-compliance (critical)
   - MEDIUM: DRY/KISS violations, YAGNI with >3 occurrences
   - LOW: Minor YAGNI, code style issues
2. Determine verdict:
   - `PASS`: No HIGH or MEDIUM severity issues
   - `ISSUES_FOUND`: At least one HIGH or MEDIUM issue
3. Format Linear comment with categorized issues
4. Add comment to Story via Linear MCP
5. Return JSON verdict

**Output:**
- Linear comment ID
- JSON verdict (see Output Specification below)

## Input/Output Specification

### Input

**Required:**
- Story ID (e.g., "US001" or "API-42")

**Optional:**
- Severity threshold (default: MEDIUM - report MEDIUM and HIGH)
- Check types (default: all 5 - can disable specific checks)

### Output Format

Returns JSON object:

```json
{
  "verdict": "PASS" | "ISSUES_FOUND",
  "story_id": "US001",
  "tasks_analyzed": 3,
  "issues": [
    {
      "type": "DRY",
      "severity": "HIGH",
      "file": "src/auth/service.py",
      "line": 42,
      "description": "Duplicate validation logic in 3 places",
      "suggestion": "Extract to shared validator function in src/utils/validators.py"
    },
    {
      "type": "KISS",
      "severity": "MEDIUM",
      "file": "src/api/controller.py",
      "line": 78,
      "description": "Cyclomatic complexity 12 (threshold 10)",
      "suggestion": "Simplify with early returns or extract helper functions"
    },
    {
      "type": "Architecture",
      "severity": "HIGH",
      "file": "src/controllers/user_controller.py",
      "line": 15,
      "description": "Controller imports Repository directly (skips Service layer)",
      "suggestion": "Import from src/services/user_service.py instead"
    },
    {
      "type": "Guide Compliance",
      "severity": "HIGH",
      "file": "src/auth/jwt.py",
      "line": 23,
      "description": "Custom JWT implementation instead of authlib (Guide 01)",
      "suggestion": "Use authlib v1.3+ as recommended in Guide 01: OAuth 2.0"
    }
  ],
  "summary": {
    "dry_violations": 2,
    "kiss_violations": 1,
    "yagni_violations": 0,
    "architecture_violations": 1,
    "guide_violations": 1,
    "total_issues": 5,
    "high_severity": 3,
    "medium_severity": 2,
    "low_severity": 0
  },
  "linear_comment_id": "abc123"
}
```

**Fields:**
- `verdict`: "PASS" if no HIGH/MEDIUM issues, else "ISSUES_FOUND"
- `story_id`: Story identifier
- `tasks_analyzed`: Number of Done implementation tasks analyzed
- `issues`: Array of violation objects (sorted by severity HIGH → MEDIUM → LOW)
- `summary`: Aggregated statistics
- `linear_comment_id`: ID of Linear comment with formatted issues

## Technical Details

### AST Analysis Techniques

**Python (using ast module):**
```python
import ast

tree = ast.parse(file_content)

# Find functions
functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]

# Calculate cyclomatic complexity
def complexity(node):
    count = 1  # Base complexity
    for child in ast.walk(node):
        if isinstance(child, (ast.If, ast.For, ast.While, ast.And, ast.Or)):
            count += 1
    return count
```

**JavaScript (using @babel/parser):**
```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ast = parser.parse(code, { sourceType: 'module' });

// Find functions
traverse(ast, {
  FunctionDeclaration(path) {
    // Analyze function
  }
});
```

### Duplicate Code Detection

**Approach: Token-based similarity**
1. Tokenize code blocks (remove whitespace, comments)
2. Calculate similarity score using Jaccard index
3. If similarity >80% → Flag as duplicate

**Example:**
```python
def similarity(code1, code2):
    tokens1 = set(tokenize(code1))
    tokens2 = set(tokenize(code2))
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2
    return len(intersection) / len(union)

if similarity(func1, func2) > 0.8:
    report_dry_violation()
```

### Complexity Metrics

**Cyclomatic Complexity:**
- Formula: `CC = E - N + 2P`
  - E = edges in control flow graph
  - N = nodes
  - P = connected components (usually 1)
- Simplified: Count decision points (if, for, while, and, or) + 1

**Thresholds:**
- 1-5: Simple, low risk
- 6-10: Moderate complexity
- 11-15: Complex, needs refactoring (MEDIUM severity)
- 16+: Very complex, high risk (HIGH severity)

### Layer Detection

**Convention-based detection:**
```
controllers/ or routes/  → Controller layer
services/               → Service layer
repositories/ or models/ → Data access layer
utils/                  → Utilities (no business logic)
```

**Violation patterns:**
- Controller imports Repository (should go through Service)
- Service imports Controller (circular dependency)
- Model contains business logic (should be in Service)

### Linear Comment Format

```markdown
## 🔎 Code Quality Check Results

**Verdict:** ✅ PASS | ⚠️ ISSUES FOUND
**Tasks Analyzed:** 3 implementation tasks
**Total Issues:** 5 (3 HIGH, 2 MEDIUM, 0 LOW)

### HIGH Severity (3)

**1. Architecture Violation**
- **File:** `src/controllers/user_controller.py:15`
- **Issue:** Controller imports Repository directly (skips Service layer)
- **Suggestion:** Import from `src/services/user_service.py` instead

**2. Guide Compliance Violation**
- **File:** `src/auth/jwt.py:23`
- **Issue:** Custom JWT implementation instead of authlib (Guide 01)
- **Suggestion:** Use authlib v1.3+ as recommended in Guide 01: OAuth 2.0

**3. DRY Violation**
- **File:** `src/auth/service.py:42`
- **Issue:** Duplicate validation logic in 3 places
- **Suggestion:** Extract to shared validator function in `src/utils/validators.py`

### MEDIUM Severity (2)

**1. KISS Violation**
- **File:** `src/api/controller.py:78`
- **Issue:** Cyclomatic complexity 12 (threshold 10)
- **Suggestion:** Simplify with early returns or extract helper functions

**2. DRY Violation**
- **File:** `src/utils/helpers.py:105`
- **Issue:** Duplicate error handling pattern (2 occurrences)
- **Suggestion:** Create error handler decorator

### Summary by Type

- **DRY:** 2 violations
- **KISS:** 1 violation
- **YAGNI:** 0 violations
- **Architecture:** 1 violation
- **Guide Compliance:** 1 violation
```

### Error Handling

**If no Done implementation tasks:**
- Return verdict: "PASS" (nothing to check)
- Add Linear comment: "ℹ️ No Done implementation tasks to analyze"

**If git diff unavailable:**
- Fallback: Analyze all files in "Affected Components" section
- Add warning in Linear comment

**If AST parsing fails:**
- Skip affected file
- Add warning in issues array
- Continue analyzing other files

### NOT Responsible For

This skill does NOT:
- Create refactoring tasks in Linear (ln-30-story-executor creates tasks)
- Change Story or Task statuses (ln-30-story-executor manages statuses)
- Make workflow decisions (ln-30-story-executor decides next step)
- Apply fixes automatically (that's developer's responsibility)

**Rationale:** Single Responsibility Principle - this skill ONLY analyzes code quality and reports issues. All workflow logic belongs to ln-30-story-executor orchestrator.

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Discovery Complete (Phase 1):**
- [ ] Story loaded from Linear
- [ ] Story.id (UUID) extracted
- [ ] Available guides discovered from docs/guides/
- [ ] Guide links extracted from Story Technical Notes

**✅ Tasks Loaded (Phase 2):**
- [ ] Done implementation tasks queried from Linear
- [ ] Test tasks filtered OUT
- [ ] Affected files identified per task

**✅ Code Analyzed (Phase 3):**
- [ ] Git diffs extracted for each task
- [ ] File contents loaded
- [ ] AST parsed for code structure

**✅ Violations Checked (Phase 4):**
- [ ] **Check 1:** DRY violations detected (duplicate code)
- [ ] **Check 2:** KISS violations detected (complexity >10)
- [ ] **Check 3:** YAGNI violations detected (unused code, premature abstraction)
- [ ] **Check 4:** Architecture violations detected (layer violations)
- [ ] **Check 5:** Guide compliance violations detected
- [ ] Issues categorized by severity (HIGH/MEDIUM/LOW)

**✅ Results Reported (Phase 5):**
- [ ] Verdict determined (PASS if no HIGH/MEDIUM issues)
- [ ] Linear comment formatted with categorized issues
- [ ] Comment added to Story
- [ ] JSON verdict returned with all required fields

**✅ Error Handling Applied:**
- [ ] No Done tasks → PASS with info comment
- [ ] Git diff unavailable → fallback to file analysis
- [ ] AST parsing errors → warnings logged, continue analysis

**Output:**
- JSON verdict with detailed issue list
- Linear comment with formatted issues (by severity)
- No side effects (no tasks created, no statuses changed)

---

**Version:** 2.0.0 (Simplified workflow from 5 phases to 4 by grouping Phase 3 (Analyze Code Changes) + Phase 4 (Check Violations) into Phase 3: Analyze Code & Check Violations with 2 steps, following Progressive Disclosure Pattern)
**Last Updated:** 2025-11-14
