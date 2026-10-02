#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p accounts tests docs
: > accounts/__init__.py
: > tests/__init__.py
cat > accounts/users.py <<'PY'
import hashlib
import secrets


def _hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)


class UserStore:
    def __init__(self):
        self._users = {}

    def add(self, email, password):
        salt = secrets.token_bytes(16)
        self._users[email] = (salt, _hash(password, salt))

    def exists(self, email):
        return email in self._users

    def set_password(self, email, password):
        salt = secrets.token_bytes(16)
        self._users[email] = (salt, _hash(password, salt))

    def check_password(self, email, password):
        if email not in self._users:
            return False
        salt, digest = self._users[email]
        return secrets.compare_digest(digest, _hash(password, salt))
PY
cat > accounts/reset.py <<'PY'
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

TOKEN_TTL = timedelta(minutes=30)


class ResetError(Exception):
    pass


def _digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


class ResetService:
    def __init__(self, users, mailer, clock=None):
        self.users = users
        self.mailer = mailer
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._tokens = {}

    def request(self, email):
        """Always returns the same acknowledgement so callers cannot probe for accounts."""
        if self.users.exists(email):
            token = secrets.token_urlsafe(32)
            self._tokens[_digest(token)] = {
                "email": email,
                "expires": self._clock() + TOKEN_TTL,
                "used": False,
            }
            self.mailer.send(email, token)
        return "If the address is registered, a reset link has been sent."

    def confirm(self, token, new_password):
        entry = self._tokens.get(_digest(token))
        if entry is None:
            raise ResetError("invalid")
        if entry["used"]:
            raise ResetError("used")
        if self._clock() > entry["expires"]:
            raise ResetError("expired")
        self.users.set_password(entry["email"], new_password)
        entry["used"] = True
PY
cat > docs/password-reset.md <<'MD'
# Password reset

- PR-1: A reset link works for 30 minutes after it is requested and is refused afterwards.
- PR-2: A reset link can be used only once.
- PR-3: Requesting a reset for an unknown address gives the same response as for a registered one and sends no email.
- PR-4: After a successful reset the new password signs in and the old password no longer does.
MD
cat > tests/test_users.py <<'PY'
import unittest
from datetime import timedelta

from accounts.reset import TOKEN_TTL, ResetError
from accounts.users import UserStore


class UsersTest(unittest.TestCase):
    def test_token_ttl_constant(self):
        self.assertEqual(TOKEN_TTL, timedelta(minutes=30))

    def test_reset_error_is_exception(self):
        self.assertTrue(issubclass(ResetError, Exception))

    def test_store_starts_empty(self):
        self.assertEqual(UserStore()._users, {})

    def test_set_password_changes_login(self):
        store = UserStore()
        store.add("a@example.test", "old-secret")
        store.set_password("a@example.test", "new-secret")
        self.assertTrue(store.check_password("a@example.test", "new-secret"))
        self.assertFalse(store.check_password("a@example.test", "old-secret"))

    def test_set_password_changes_login_again(self):
        store = UserStore()
        store.add("b@example.test", "first")
        store.set_password("b@example.test", "second")
        self.assertTrue(store.check_password("b@example.test", "second"))


if __name__ == "__main__":
    unittest.main()
PY
printf '# Accounts\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Add password reset service"
