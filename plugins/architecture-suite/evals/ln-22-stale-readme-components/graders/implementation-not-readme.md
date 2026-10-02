---
type: llm
focus: { source: file, path: docs/architecture/current-state.md }
---

PASS if the document describes the implemented flow (WSGI app in booking/app.py -> BookingService -> SQLite AppointmentRepository, then a synchronous SMTP confirmation inside the same request), and mentions a Redis cache, Celery worker, booking/cache.py or booking/tasks.py only as documented-but-not-observed drift (for example README or requirements.txt claims with no code wiring).
FAIL if it presents a Redis cache, a Celery worker or asynchronous email delivery as an existing component or runtime path, or if it replaces the current-state account with a proposed target architecture.
