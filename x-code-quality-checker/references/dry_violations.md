# DRY Violations Reference

DRY (Don't Repeat Yourself) principle: Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.

## Common Violation Patterns

### Pattern 1: Duplicate Function Definitions

**Violation:**
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

**Fix:**
```python
# utils/validators.py
def validate_email(email):
    if not email or '@' not in email:
        raise ValueError("Invalid email")

# auth/service.py + users/service.py
from utils.validators import validate_email
```

**Severity:** HIGH if >2 duplicates, MEDIUM if 2 duplicates

---

### Pattern 2: Duplicate Validation Logic

**Violation:**
```python
# File 1
if not user.email or '@' not in user.email:
    return {"error": "Invalid email"}

# File 2
if not email or email.find('@') == -1:  # Same logic, different syntax!
    raise ValueError("Invalid email")

# File 3
email_valid = email and '@' in email  # Same logic again!
if not email_valid:
    return False
```

**Fix:**
```python
# utils/validators.py
def is_valid_email(email):
    return email and '@' in email

# All files use:
if not is_valid_email(user.email):
    return {"error": "Invalid email"}
```

---

### Pattern 3: Duplicate Error Handling

**Violation:**
```python
# File 1
try:
    result = api_call()
except requests.exceptions.RequestException as e:
    logger.error(f"API call failed: {e}")
    return {"error": "Service unavailable"}

# File 2
try:
    data = external_api_call()
except requests.exceptions.RequestException as err:
    logger.error(f"API call failed: {err}")  # DUPLICATE!
    return {"error": "Service unavailable"}
```

**Fix:**
```python
# utils/decorators.py
def handle_api_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            logger.error(f"API call failed: {e}")
            return {"error": "Service unavailable"}
    return wrapper

# Usage
@handle_api_errors
def api_call():
    return requests.get("https://api.example.com")
```

---

### Pattern 4: Duplicate Database Queries

**Violation:**
```python
# users/repository.py
def get_active_users():
    return db.query(User).filter(User.active == True, User.deleted_at == None).all()

# admin/repository.py
def get_active_users():  # DUPLICATE!
    return db.query(User).filter(User.active == True, User.deleted_at == None).all()
```

**Fix:**
```python
# users/repository.py (single source of truth)
class UserRepository:
    @staticmethod
    def get_active_users():
        return db.query(User).filter(User.active == True, User.deleted_at == None).all()

# admin/repository.py imports from users/
from users.repository import UserRepository
```

---

## Detection Algorithm

```python
def detect_dry_violations(files):
    violations = []

    # 1. Extract all functions from all files
    functions = {}
    for file in files:
        ast_tree = ast.parse(file.content)
        for node in ast.walk(ast_tree):
            if isinstance(node, ast.FunctionDef):
                functions[node.name] = functions.get(node.name, [])
                functions[node.name].append({
                    'file': file.path,
                    'line': node.lineno,
                    'body': ast.unparse(node)
                })

    # 2. Find duplicate function names
    for func_name, occurrences in functions.items():
        if len(occurrences) > 1:
            # 3. Check if function bodies are similar (>80% similarity)
            for i, func1 in enumerate(occurrences):
                for func2 in occurrences[i+1:]:
                    similarity = calculate_similarity(func1['body'], func2['body'])
                    if similarity > 0.8:
                        violations.append({
                            'type': 'DRY',
                            'severity': 'HIGH' if len(occurrences) > 2 else 'MEDIUM',
                            'file': func2['file'],
                            'line': func2['line'],
                            'description': f"Duplicate function '{func_name}' in {len(occurrences)} places",
                            'suggestion': f"Extract to shared module"
                        })

    return violations
```

---

## Similarity Calculation

**Token-based Jaccard similarity:**

```python
def calculate_similarity(code1, code2):
    # Tokenize code (remove whitespace, comments)
    tokens1 = set(tokenize(code1))
    tokens2 = set(tokenize(code2))

    # Jaccard index
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2

    if not union:
        return 0.0

    return len(intersection) / len(union)

def tokenize(code):
    # Remove whitespace and comments
    code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
    code = re.sub(r'\s+', ' ', code)

    # Split into tokens
    tokens = re.findall(r'\w+|[^\w\s]', code)

    return tokens
```

**Threshold:** 80% similarity = duplicate

---

## Exceptions (When DRY Not Applicable)

1. **Different domains:** Same logic but different business context
2. **Temporary code:** Prototypes or one-off scripts
3. **Test fixtures:** Test data duplication acceptable for clarity
4. **Configuration:** Similar config blocks OK (e.g., multiple API endpoints)

**Example (acceptable duplication):**
```python
# auth/config.py
AUTH_API_URL = "https://api.example.com/auth"
AUTH_API_TIMEOUT = 5

# users/config.py
USERS_API_URL = "https://api.example.com/users"  # Similar but different domain
USERS_API_TIMEOUT = 5
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
