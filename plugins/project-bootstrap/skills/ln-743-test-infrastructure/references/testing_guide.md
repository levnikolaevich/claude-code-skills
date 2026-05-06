# Testing Best Practices Guide

<!-- SCOPE: Testing infrastructure best practices ONLY. Contains AAA pattern, fixture patterns, framework configs. -->
<!-- DO NOT add here: Setup workflow → ln-743-test-infrastructure SKILL.md -->

Reference for ln-743-test-infrastructure.

---

## AAA Pattern (Arrange-Act-Assert)

All tests should follow this structure:

```
// Arrange - Set up test data and dependencies
// Act - Execute the code under test
// Assert - Verify the result
```

### Benefits

- Consistent structure across all tests
- Easy to read and understand
- Clear separation of concerns
- Easier to identify issues

---

## Test Naming Conventions

### TypeScript/Vitest

```typescript
describe('ComponentName', () => {
  it('should do something when condition', () => {});
  it('renders correctly with props', () => {});
  it('calls handler when button clicked', () => {});
});
```

### .NET/xUnit

```csharp
// Pattern: MethodName_Scenario_ExpectedBehavior
public void Calculate_WithValidInput_ReturnsCorrectResult()
public void Process_WhenUserNotFound_ThrowsException()
public void GetAll_WithEmptyDatabase_ReturnsEmptyList()
```

### Python/pytest

```python
# Pattern: test_methodname_scenario_expected
def test_add_positive_numbers_returns_sum():
def test_divide_by_zero_raises_valueerror():
def test_get_user_not_found_returns_none():
```

---

## Test Types and When to Use

| Type | Purpose | Speed | Isolation |
|------|---------|-------|-----------|
| Unit | Test single function/method | Fast | Complete |
| Integration | Test component interactions | Medium | Partial |
| E2E | Test full user flows | Slow | None |

### Recommended Distribution

- **Unit Tests:** 70-80% of test suite
- **Integration Tests:** 15-25%
- **E2E Tests:** 5-10%

---

## Coverage Guidelines

### Minimum Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Lines | 70% | 80% |
| Branches | 70% | 80% |
| Functions | 70% | 80% |

### What to Cover

- ✅ Business logic
- ✅ Edge cases
- ✅ Error handling
- ✅ Public API

### What NOT to Cover

- ❌ Generated code
- ❌ Simple getters/setters
- ❌ Framework code
- ❌ Configuration files

---

## Mocking Best Practices

### When to Mock

- External services (APIs, databases)
- Slow operations (file I/O, network)
- Non-deterministic code (random, time)
- Dependencies with side effects

### When NOT to Mock

- Simple utility functions
- Data structures
- The code under test itself

### Mock Verification

```typescript
// Vitest
const mockFn = vi.fn();
expect(mockFn).toHaveBeenCalledWith('arg');
expect(mockFn).toHaveBeenCalledTimes(1);
```

```csharp
// Moq
mockRepository.Verify(r => r.Save(It.IsAny<User>()), Times.Once);
```

```python
# pytest with unittest.mock
mock_service.process.assert_called_once_with(expected_data)
```

---

## Framework-Specific Tips

### Vitest/React

- Use `screen.getByRole()` over `getByTestId()` for accessibility
- Prefer user-event over fireEvent for realistic interactions
- Use `vi.fn()` for mock functions
- Use `vi.mock()` for module mocking

### xUnit/.NET

- Use `[Fact]` for single tests, `[Theory]` for parameterized
- Use FluentAssertions for readable assertions
- Use `Mock.Of<T>()` for simple mocks
- Dispose resources in constructor/Dispose pattern

### pytest/Python

- Use fixtures for shared setup
- Use `@pytest.mark.parametrize` for data-driven tests
- Use `pytest.raises` for exception testing
- Use `pytest.approx` for float comparisons

---

## Test Organization

### TypeScript

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx  # Co-located
├── utils/
│   ├── format.ts
│   └── format.test.ts
└── test/
    └── setup.ts
```

### .NET

```
tests/
├── Project.Tests/           # Unit tests
│   ├── Services/
│   └── Controllers/
└── Project.IntegrationTests/ # Integration tests
```

### Python

```
tests/
├── conftest.py        # Shared fixtures
├── unit/
│   └── test_service.py
└── integration/
    └── test_api.py
```

---

## CI/CD Integration

### Run Tests in CI

```yaml
# GitHub Actions example
- name: Run tests
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v4
```

### Coverage Gates

Configure CI to fail if:
- Coverage drops below threshold
- Tests fail
- Coverage report not generated

---

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing implementation | Brittle tests | Test behavior, not implementation |
| Too many mocks | Hard to maintain | Mock only external dependencies |
| No assertions | False positives | Always assert something |
| Shared state | Flaky tests | Isolate each test |
| Slow tests | Long CI times | Parallelize, mock I/O |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
