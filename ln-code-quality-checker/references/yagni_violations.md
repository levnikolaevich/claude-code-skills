# YAGNI Violations Reference

YAGNI (You Aren't Gonna Need It) principle: Don't add functionality until it's necessary.

## Violation Patterns

### 1. Unused Functions/Classes

**Violation:**
```python
def calculate_tax(amount):  # Defined but never called!
    return amount * 0.2

def process_payment(amount):
    return charge_card(amount)  # Doesn't use calculate_tax
```

**Detection:** Search codebase for function calls; if function never called → YAGNI violation

---

### 2. Premature Abstraction

**Violation:**
```python
# Interface with only ONE implementation
class UserRepositoryInterface:
    def get_user(self, id): pass
    def save_user(self, user): pass

class UserRepository(UserRepositoryInterface):  # Only implementation!
    def get_user(self, id):
        return db.query(User).get(id)
    def save_user(self, user):
        db.session.add(user)
        db.session.commit()
```

**Fix:** Remove interface until second implementation needed

---

### 3. Over-Engineering

**Violation:**
```python
# Complex pattern for simple problem
class UserFactoryBuilder:
    def __init__(self):
        self.strategy = None

    def set_strategy(self, strategy):
        self.strategy = strategy
        return self

    def build(self):
        return User(strategy=self.strategy)

# Usage
user = UserFactoryBuilder().set_strategy('default').build()
```

**Fix:**
```python
# Simple solution
user = User()
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
