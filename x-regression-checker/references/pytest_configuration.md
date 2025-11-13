# Test Framework Configuration Reference

This document provides configuration examples and detection patterns for supported test frameworks.

## Supported Frameworks

### 1. pytest (Python)

**Detection Patterns:**
- File: `pytest.ini` OR `pyproject.toml` (with `[tool.pytest.ini_options]`)
- Directory: `tests/` with `test_*.py` or `*_test.py` files

**Run Command:**
```bash
pytest tests/ -v --tb=short
```

**Configuration Example (pytest.ini):**
```ini
[pytest]
testpaths = tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
```

**Output Parsing:**
```
============= test session starts ==============
collected 127 items

tests/test_auth.py::test_login PASSED    [  1%]
tests/test_auth.py::test_logout PASSED   [  2%]
tests/test_api.py::test_rate_limit FAILED [ 50%]

======= 125 passed, 2 failed in 12.5s =======
```

**Parse Pattern:**
- Total: Extract from `collected X items`
- Results: Extract from `X passed, Y failed in Z.Zs`
- Failed tests: Lines with `FAILED` status

---

### 2. jest (JavaScript/TypeScript)

**Detection Patterns:**
- File: `jest.config.js` OR `jest.config.ts` OR `package.json` (with `"jest"` key)
- Directory: `__tests__/` OR `test/` OR files matching `*.test.js` or `*.spec.js`

**Run Command:**
```bash
npm test -- --verbose
```

**Configuration Example (jest.config.js):**
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: ['src/**/*.js'],
  verbose: true,
};
```

**Output Parsing:**
```
PASS  tests/auth.test.js
  ✓ should login successfully (123ms)
  ✓ should logout (45ms)

FAIL  tests/api.test.js
  ✕ should enforce rate limit (234ms)

Tests:       2 failed, 125 passed, 127 total
Time:        12.5s
```

**Parse Pattern:**
- Total: Extract from `X total`
- Results: Extract from `X failed, Y passed`
- Failed tests: Lines starting with `✕` under FAIL suites

---

### 3. vitest (JavaScript/TypeScript)

**Detection Patterns:**
- File: `vitest.config.js` OR `vitest.config.ts` OR `vite.config.js` (with `test` key)
- Directory: `test/` OR files matching `*.test.js` or `*.spec.js`

**Run Command:**
```bash
npm run test
```

**Configuration Example (vitest.config.js):**
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js', '**/*.spec.js'],
  },
});
```

**Output Parsing:**
```
✓ tests/auth.test.js (2)
✗ tests/api.test.js (1)
   ✗ should enforce rate limit

Test Files  1 failed | 4 passed (5)
     Tests  2 failed | 125 passed (127)
      Time  12.5s
```

**Parse Pattern:**
- Total: Extract from `Tests X failed | Y passed (Z)`
- Failed tests: Lines starting with `✗` (cross mark)

---

### 4. go test (Go)

**Detection Patterns:**
- File: `go.mod`
- Files: `*_test.go` in any directory

**Run Command:**
```bash
go test ./... -v
```

**Configuration:** No config file needed (convention-based)

**Output Parsing:**
```
=== RUN   TestLogin
--- PASS: TestLogin (0.12s)
=== RUN   TestLogout
--- PASS: TestLogout (0.05s)
=== RUN   TestRateLimit
--- FAIL: TestRateLimit (0.23s)
    api_test.go:45: Rate limit not enforced

PASS
ok      github.com/user/project/auth    0.17s
FAIL
FAIL    github.com/user/project/api     0.28s
```

**Parse Pattern:**
- Results: Count lines with `--- PASS:` and `--- FAIL:`
- Failed tests: Extract test names from `--- FAIL: TestName`
- Execution time: Sum times from `ok` and `FAIL` package lines

---

## Framework Detection Algorithm

```
1. Check for Python test files:
   IF pytest.ini OR pyproject.toml exists:
      RETURN "pytest"

2. Check for JavaScript test files:
   IF jest.config.js OR package.json contains "jest":
      RETURN "jest"
   ELSE IF vitest.config.js OR vite.config.js contains "test":
      RETURN "vitest"

3. Check for Go test files:
   IF go.mod exists AND *_test.go files found:
      RETURN "go test"

4. No framework detected:
   RETURN null (no tests found)
```

## Timeout Handling

All test commands run with **5-minute timeout**:

```bash
timeout 300 pytest tests/ -v --tb=short
```

**Rationale:**
- Prevents hanging tests from blocking pipeline
- Typical test suite runs in < 2 minutes
- 5 minutes allows for slow integration tests

**On Timeout:**
- Kill process
- Return verdict: "FAIL"
- Include timeout message in Linear comment

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
