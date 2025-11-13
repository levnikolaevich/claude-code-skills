# KISS Violations Reference

KISS (Keep It Simple, Stupid) principle: Most systems work best if they are kept simple rather than made complicated.

## Violation Types

### 1. High Cyclomatic Complexity

**Threshold:** >10 = MEDIUM severity, >15 = HIGH severity

**Violation Example:**
```python
def process_user(user, action, options=None):
    if user:
        if user.active:
            if action == 'update':
                if options and 'email' in options:
                    if validate_email(options['email']):
                        if user.role == 'admin' or user.id == options.get('user_id'):
                            # Complexity = 7 decision points!
                            return update_email(user, options['email'])
    return None
```

**Fix with Early Returns:**
```python
def process_user(user, action, options=None):
    if not user or not user.active:
        return None

    if action != 'update' or not options or 'email' not in options:
        return None

    if not validate_email(options['email']):
        return None

    if user.role != 'admin' and user.id != options.get('user_id'):
        return None

    return update_email(user, options['email'])
```

---

### 2. Deep Nesting

**Threshold:** >4 levels = violation

**Fix:** Extract nested logic into helper functions

---

### 3. Long Functions

**Threshold:** >50 lines = violation

**Fix:** Extract logical blocks into separate functions with descriptive names

---

## Detection

```python
def calculate_complexity(func_node):
    complexity = 1  # Base complexity
    for node in ast.walk(func_node):
        if isinstance(node, (ast.If, ast.For, ast.While, ast.And, ast.Or, ast.ExceptHandler)):
            complexity += 1
    return complexity
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
