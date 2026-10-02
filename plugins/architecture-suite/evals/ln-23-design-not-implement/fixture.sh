#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p classes tests docs/requirements
: > classes/__init__.py
cat > classes/store.py <<'PY'
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    capacity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    member_id TEXT NOT NULL REFERENCES members(id),
    UNIQUE (class_id, member_id)
);
"""


def connect(path="studio.sqlite3"):
    conn = sqlite3.connect(path, isolation_level=None)
    conn.executescript(SCHEMA)
    return conn
PY
cat > classes/notify.py <<'PY'
import os
import smtplib
from email.message import EmailMessage


def send_email(to, subject, body):
    message = EmailMessage()
    message["From"] = "studio@example.invalid"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(os.environ.get("SMTP_HOST", "localhost"), timeout=10) as smtp:
        smtp.send_message(message)
PY
cat > classes/bookings.py <<'PY'
class ClassFull(Exception):
    pass


def book_spot(conn, class_id, member_id):
    conn.execute("BEGIN IMMEDIATE")
    try:
        capacity = conn.execute("SELECT capacity FROM classes WHERE id = ?", (class_id,)).fetchone()[0]
        taken = conn.execute("SELECT COUNT(*) FROM bookings WHERE class_id = ?", (class_id,)).fetchone()[0]
        if taken >= capacity:
            raise ClassFull(class_id)
        conn.execute("INSERT INTO bookings (class_id, member_id) VALUES (?, ?)", (class_id, member_id))
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


def cancel_booking(conn, class_id, member_id):
    conn.execute("DELETE FROM bookings WHERE class_id = ? AND member_id = ?", (class_id, member_id))


def join_waitlist(conn, class_id, member_id):
    # TODO(waitlist): see docs/requirements/waitlist.md
    raise NotImplementedError("waitlist is not built yet")
PY
: > tests/__init__.py
cat > tests/test_bookings.py <<'PY'
import unittest

from classes import bookings, store


class BookingTest(unittest.TestCase):
    def setUp(self):
        self.conn = store.connect(":memory:")
        self.conn.execute("INSERT INTO classes VALUES (1, 'Spin', '2026-10-05T07:00', 1)")

    def test_full_class_rejects_booking(self):
        bookings.book_spot(self.conn, 1, "m1")
        with self.assertRaises(bookings.ClassFull):
            bookings.book_spot(self.conn, 1, "m2")


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/requirements/waitlist.md <<'MD'
# Class waitlist requirements

Owner: Product (Sara Okafor). Status: committed for the next sprint.

## Context

The studio runs about 40 classes a day with 20 places each. Bookings for the next week open every
Sunday at 07:00; the busiest minute so far saw 30 booking requests (gym front-desk logs, September 2026).
The system is one Python process on one VM with SQLite, maintained by two developers. There is no
budget for new infrastructure this year.

## Requirements

- **WL-1** A member can join the waitlist of a full class; the waitlist is capped at 10 members per class.
- **WL-2** When a booked place is freed, it is offered to waitlisted members in the order they joined.
- **WL-3** The offered member is emailed within 5 minutes and has 2 hours to confirm; otherwise the offer
  passes to the next member.
- **WL-4** A freed place is offered to exactly one member at a time and can never be booked twice.
- **WL-5** A member can leave the waitlist at any time; offers stop 1 hour before the class starts.

## Open suggestion (not committed)

Our CTO asked whether we should use this feature to move to microservices with Kafka for booking events.
MD
printf '# Studio classes\n\nRun tests with `python3 -m unittest`.\n' > README.md
printf '__pycache__/\n*.sqlite3\n' > .gitignore
git add -A
git commit -q -m "Class bookings"
