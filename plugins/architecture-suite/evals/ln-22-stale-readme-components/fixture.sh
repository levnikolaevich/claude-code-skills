#!/usr/bin/env bash
set -euo pipefail
# Fixed dates keep the baseline commit hash stable so graders can check the snapshot anchor.
export GIT_AUTHOR_DATE="2026-09-01T09:00:00+00:00"
export GIT_COMMITTER_DATE="2026-09-01T09:00:00+00:00"
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
git config core.autocrlf false
mkdir -p booking tests
: > booking/__init__.py
cat > booking/repository.py <<'PY'
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_email TEXT NOT NULL,
    clinician TEXT NOT NULL,
    slot TEXT NOT NULL,
    UNIQUE (clinician, slot)
)
"""


class AppointmentRepository:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.execute(SCHEMA)

    def insert(self, patient_email, clinician, slot):
        with self.conn:
            cur = self.conn.execute(
                "INSERT INTO appointments (patient_email, clinician, slot) VALUES (?, ?, ?)",
                (patient_email, clinician, slot),
            )
        return cur.lastrowid

    def is_taken(self, clinician, slot):
        row = self.conn.execute(
            "SELECT 1 FROM appointments WHERE clinician = ? AND slot = ?", (clinician, slot)
        ).fetchone()
        return row is not None
PY
cat > booking/notifications.py <<'PY'
import os
import smtplib
from email.message import EmailMessage


def send_confirmation(patient_email, clinician, slot):
    message = EmailMessage()
    message["From"] = os.environ.get("MAIL_FROM", "noreply@clinic.example")
    message["To"] = patient_email
    message["Subject"] = "Appointment confirmed"
    message.set_content(f"You are booked with {clinician} at {slot}.")
    with smtplib.SMTP(os.environ.get("SMTP_HOST", "localhost"), 25, timeout=10) as smtp:
        smtp.send_message(message)
PY
cat > booking/service.py <<'PY'
from booking import notifications


class SlotTaken(Exception):
    pass


class BookingService:
    def __init__(self, repository, notify=notifications.send_confirmation):
        self.repository = repository
        self.notify = notify

    def book(self, patient_email, clinician, slot):
        if self.repository.is_taken(clinician, slot):
            raise SlotTaken(slot)
        appointment_id = self.repository.insert(patient_email, clinician, slot)
        self.notify(patient_email, clinician, slot)
        return appointment_id
PY
cat > booking/app.py <<'PY'
import json
import os
from wsgiref.simple_server import make_server

from booking.repository import AppointmentRepository
from booking.service import BookingService, SlotTaken


def create_app(service):
    def app(environ, start_response):
        path = environ.get("PATH_INFO", "")
        method = environ.get("REQUEST_METHOD", "GET")
        if method == "GET" and path == "/health":
            start_response("200 OK", [("Content-Type", "text/plain")])
            return [b"ok"]
        if method == "POST" and path == "/appointments":
            length = int(environ.get("CONTENT_LENGTH") or 0)
            body = json.loads(environ["wsgi.input"].read(length) or b"{}")
            try:
                appointment_id = service.book(body["patient_email"], body["clinician"], body["slot"])
            except SlotTaken:
                start_response("409 Conflict", [("Content-Type", "application/json")])
                return [b'{"error": "slot taken"}']
            start_response("201 Created", [("Content-Type", "application/json")])
            return [json.dumps({"id": appointment_id}).encode()]
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"not found"]

    return app


def main():
    repository = AppointmentRepository(os.environ.get("BOOKING_DB", "booking.sqlite3"))
    app = create_app(BookingService(repository))
    make_server("0.0.0.0", int(os.environ.get("PORT", "8000")), app).serve_forever()


if __name__ == "__main__":
    main()
PY
: > tests/__init__.py
cat > tests/test_service.py <<'PY'
import unittest

from booking.repository import AppointmentRepository
from booking.service import BookingService, SlotTaken


class BookingServiceTest(unittest.TestCase):
    def setUp(self):
        self.sent = []
        self.service = BookingService(
            AppointmentRepository(":memory:"), notify=lambda *args: self.sent.append(args)
        )

    def test_booking_sends_confirmation(self):
        self.service.book("a@example.com", "dr-lee", "2026-10-01T09:00")
        self.assertEqual(len(self.sent), 1)

    def test_double_booking_is_rejected(self):
        self.service.book("a@example.com", "dr-lee", "2026-10-01T09:00")
        with self.assertRaises(SlotTaken):
            self.service.book("b@example.com", "dr-lee", "2026-10-01T09:00")


if __name__ == "__main__":
    unittest.main()
PY
cat > requirements.txt <<'TXT'
redis==4.6.0
celery==5.3.6
TXT
printf 'web: python -m booking.app\n' > Procfile
cat > README.md <<'MD'
# Clinic booking

## Architecture

Requests hit the booking API. Clinician availability lookups are cached in Redis
(`booking/cache.py`), and confirmation emails are queued to a Celery worker
(`booking/tasks.py`) so a booking never waits on SMTP.

## Development

Run `python -m booking.app`; run tests with `python -m unittest`.
MD
printf '__pycache__/\n*.sqlite3\n' > .gitignore
git add -A
git commit -q -m "Clinic booking service"
