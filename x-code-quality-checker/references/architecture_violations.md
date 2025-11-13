# Architecture Violations Reference

Clean Architecture principles: Separation of concerns, layer independence, dependency inversion.

## Layer Hierarchy

```
┌─────────────────┐
│  Controllers    │  (HTTP handlers, routes)
│    (routes/)    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│    Services     │  (Business logic)
│  (services/)    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Repositories   │  (Data access)
│ (repositories/) │
└─────────────────┘
```

**Rule:** Only call downward. Controller → Service → Repository.

## Violation Patterns

### 1. Layer Skipping

**Violation:**
```python
# controllers/user_controller.py
from repositories.user_repository import UserRepository  # VIOLATION!

def get_user(user_id):
    user_repo = UserRepository()  # Skips Service layer
    return user_repo.get(user_id)
```

**Fix:**
```python
# controllers/user_controller.py
from services.user_service import UserService

def get_user(user_id):
    user_service = UserService()
    return user_service.get_user(user_id)

# services/user_service.py
from repositories.user_repository import UserRepository

class UserService:
    def __init__(self):
        self.user_repo = UserRepository()

    def get_user(self, user_id):
        return self.user_repo.get(user_id)
```

**Severity:** HIGH

---

### 2. Circular Dependencies

**Violation:**
```python
# module_a.py
from module_b import function_b

def function_a():
    return function_b()

# module_b.py
from module_a import function_a  # CIRCULAR!

def function_b():
    return function_a()
```

**Detection:** Build dependency graph, check for cycles

**Fix:** Extract shared code to third module or use dependency injection

**Severity:** HIGH

---

### 3. Business Logic in Wrong Layer

**Violation:**
```python
# controllers/user_controller.py
def create_user(data):
    # Business logic in controller! VIOLATION!
    if not data.get('email') or '@' not in data['email']:
        return {"error": "Invalid email"}

    if len(data.get('password', '')) < 8:
        return {"error": "Password too short"}

    user = User(**data)
    db.session.add(user)
    db.session.commit()
    return {"success": True}
```

**Fix:** Move business logic to Service layer

---

## Detection

```python
def detect_layer_violations(files):
    violations = []

    for file in files:
        # Parse imports
        imports = extract_imports(file)

        # Check layer
        if 'controllers' in file.path or 'routes' in file.path:
            # Controller layer
            for imp in imports:
                if 'repositories' in imp:
                    violations.append({
                        'type': 'Architecture',
                        'severity': 'HIGH',
                        'file': file.path,
                        'description': 'Controller imports Repository (skips Service)',
                        'suggestion': 'Import from services/ instead'
                    })

    return violations
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
