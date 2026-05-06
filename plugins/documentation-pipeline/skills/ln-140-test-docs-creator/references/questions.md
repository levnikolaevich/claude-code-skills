# Test Documentation Questions

<!-- SCOPE: Interactive questions for test documentation (testing_strategy.md, tests/README.md) ONLY. -->
<!-- DO NOT add here: question logic → ln-140-test-docs-creator SKILL.md, test implementation → test files -->

**Purpose:** Define what each section of test documentation should answer.

**Format:** Question → Expected Content → Validation Heuristics → Auto-Discovery Hints → MCP Ref Hints

---

## Table of Contents

| Document | Questions | Auto-Discovery | Priority | Line |
|----------|-----------|----------------|----------|------|
| [docs/reference/guides/testing-strategy.md](#docsreferenceguidestesting-strategymd) | 2 | None | High | L25 |
| [tests/README.md](#testsreadmemd) | 2 | High | High | L101 |

**Priority Legend:**
- **Critical:** Must answer all questions
- **High:** Strongly recommended
- **Medium:** Optional (can use template defaults)

**Auto-Discovery Legend:**
- **None:** No auto-discovery needed (use template as-is)
- **Low:** 1-2 questions need auto-discovery
- **High:** All questions need auto-discovery

---

<!-- DOCUMENT_START: docs/reference/guides/testing-strategy.md -->
## docs/reference/guides/testing-strategy.md

**File:** docs/reference/guides/testing-strategy.md (universal testing philosophy)
**Target Sections:** Testing Philosophy, Test Levels

**Rules for this document:**
- Universal testing philosophy (NOT framework-specific)
- Risk-Based Testing principle
- Story-Level Test Task Pattern
- No auto-discovery needed (standard best practices)

---

<!-- QUESTION_START: 1 -->
### Question 1: What is the overall testing approach?

**Expected Answer:** Risk-Based Testing principle, test pyramid levels (E2E/Integration/Unit), priority-driven approach (Priority ≥15)
**Target Section:** ## Testing Philosophy

**Validation Heuristics:**
- ✅ Mentions "Risk-Based Testing" or "risk-based"
- ✅ Has test pyramid description (E2E, Integration, Unit)
- ✅ Mentions priority threshold (≥15 or "Priority 15")
- ✅ References "Story-Level Test Task Pattern"
- ✅ Length > 100 words

**Auto-Discovery:**
- N/A (standard philosophy from template)

**MCP Ref Hints:**
- Research: "risk-based testing best practices" (if template needs enhancement)
- Research: "test pyramid Martin Fowler" (if need to explain pyramid rationale)
<!-- QUESTION_END: 1 -->

---

<!-- QUESTION_START: 2 -->
### Question 2: What are the test level targets?

**Expected Answer:** E2E (baseline: positive + negative per endpoint), Integration (only when E2E insufficient), Unit (only complex business logic Priority ≥15), rationale for each level
**Target Section:** ## Test Levels

**Validation Heuristics:**
- ✅ Lists 3 levels: E2E, Integration, Unit
- ✅ Describes Usefulness Criteria for each test level
- ✅ Explains purpose/rationale for each level
- ✅ No numerical targets — test count driven by risk, not volume
- ✅ Length > 150 words

**Auto-Discovery:**
- N/A (standard targets from template)

**MCP Ref Hints:**
- Research: "testing pyramid ratios" (if need to justify ranges)
- Research: "value-based testing approach" (if need to explain priority-driven testing)
<!-- QUESTION_END: 2 -->

---

**Overall File Validation:**
- ✅ Has SCOPE tags in first 5 lines
- ✅ NO framework-specific code examples (FastAPI, pytest, Jest, etc.)
- ✅ Has Maintenance section at end
- ✅ Total length > 400 words

<!-- DOCUMENT_END: docs/reference/guides/testing-strategy.md -->

---

<!-- DOCUMENT_START: tests/README.md -->
## tests/README.md

**File:** tests/README.md (test organization structure)
**Target Sections:** Test Organization, Running Tests

**Rules for this document:**
- Project-specific test organization
- Auto-discovery of test frameworks (Jest/Vitest/Pytest/Mocha)
- Auto-discovery of directory structure (e2e/, integration/, unit/)
- Auto-discovery of naming conventions
- Auto-discovery of test runner commands

---

<!-- QUESTION_START: 3 -->
### Question 3: How are tests organized in this project?

**Expected Answer:** Directory structure (tests/automated/e2e/, tests/automated/integration/, tests/automated/unit/), naming conventions (*.test.js or *.spec.js or test_*.py), Story-Level Test Task Pattern
**Target Section:** ## Test Organization

**Validation Heuristics:**
- ✅ Describes directory structure with 3 levels (e2e, integration, unit)
- ✅ Mentions naming conventions (*.test.*, *.spec.*, test_*.*)
- ✅ References Story-Level Test Task Pattern
- ✅ Has test framework mention (Jest, Vitest, Pytest, Mocha, etc.)
- ✅ Length > 80 words

**Auto-Discovery:**
1. **Scan tests/ directory:**
   - Use Glob tool: `pattern: "tests/automated/e2e/**/*.{js,ts,py,go}"`
   - Use Glob tool: `pattern: "tests/automated/integration/**/*.{js,ts,py,go}"`
   - Use Glob tool: `pattern: "tests/automated/unit/**/*.{js,ts,py,go}"`
   - Count files in each directory
   - Example output: "✓ Test structure: 12 E2E, 45 Integration, 78 Unit tests"

2. **Detect test framework:**
   - Check package.json → "devDependencies" or "dependencies":
     - Node.js: jest, vitest, mocha, ava, tap, jasmine
     - Extract version
   - Check requirements.txt (if exists):
     - Python: pytest, nose2, unittest2
     - Extract version
   - Check go.mod (if exists):
     - Go: testing (built-in)
   - Example output: "✓ Test framework detected: jest@29.7.0"

3. **Extract naming conventions:**
   - For each test file found:
     - Extract filename pattern:
       - *.test.js → "*.test.js" convention
       - *.spec.ts → "*.spec.ts" convention
       - test_*.py → "test_*.py" convention
       - *_test.go → "*_test.go" convention
   - Use most common pattern (majority rule)
   - Example output: "✓ Naming convention: *.test.js (detected from 135 files)"

4. **If tests/ directory doesn't exist:**
   - Create placeholder structure:
     ```
     tests/
       e2e/       (empty, ready for E2E tests)
       integration/  (empty, ready for Integration tests)
       unit/      (empty, ready for Unit tests)
     ```
   - Log: "⚠️ Test directory structure created (will be populated during Story test task execution)"

**MCP Ref Hints:**
- Research: "[detected_framework] best practices" (e.g., "jest best practices {current_year}")
- Research: "[detected_framework] naming conventions" (if need to explain patterns)
<!-- QUESTION_END: 3 -->

---

<!-- QUESTION_START: 4 -->
### Question 4: How do I run tests locally?

**Expected Answer:** Test runner command (npm test, pytest, go test), run specific test files, run with coverage
**Target Section:** ## Running Tests

**Validation Heuristics:**
- ✅ Has test runner command (npm test, yarn test, pytest, go test, etc.)
- ✅ Mentions coverage (--coverage, coverage report, etc.)
- ✅ Shows how to run specific tests
- ✅ Has examples with actual commands
- ✅ Length > 50 words

**Auto-Discovery:**
1. **Extract test command from package.json:**
   - Read package.json → "scripts" → "test"
   - Extract command:
     - "jest" → "npm test" (runs Jest)
     - "vitest" → "npm test" (runs Vitest)
     - "mocha" → "npm test" (runs Mocha)
     - Custom script → use as-is
   - Example output: "Test runner: npm test (runs jest)"

2. **Extract coverage command (if exists):**
   - Check package.json → "scripts":
     - "test:coverage": "jest --coverage"
     - "coverage": "vitest run --coverage"
   - Example output: "Coverage: npm run test:coverage"

3. **For Python projects:**
   - Check for pytest.ini or pyproject.toml
   - Default: "pytest" or "python -m pytest"
   - Coverage: "pytest --cov=src"

4. **For Go projects:**
   - Default: "go test ./..."
   - Coverage: "go test -cover ./..."

5. **If no test script found:**
   - Default based on detected framework:
     - Jest → "npm test"
     - Vitest → "npm test"
     - Pytest → "pytest"
     - Go → "go test ./..."
   - Log: "⚠️ No test script found in package.json. Using default '[command]'."

**MCP Ref Hints:**
- N/A (framework-specific, use detected framework docs)
<!-- QUESTION_END: 4 -->

---

**Overall File Validation:**
- ✅ Has SCOPE tags in first 5 lines
- ✅ Has link to testing-strategy.md in Quick Navigation section
- ✅ Has Maintenance section at end
- ✅ Total length > 100 words

<!-- DOCUMENT_END: tests/README.md -->

---

**Version:** 1.0.0
**Last Updated:** 2025-11-18
