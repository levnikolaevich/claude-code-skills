#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > logger.py <<'FIXTURE_CONTENT'
def transfer(db, log, token):
    log.info({"event":"transfer.committed","token":token})
    db.commit()
FIXTURE_CONTENT
mkdir -p .
cat > collector.md <<'FIXTURE_CONTENT'
Delivery: best effort; drops records when buffer is full.
FIXTURE_CONTENT
mkdir -p .
cat > policy.md <<'FIXTURE_CONTENT'
Security tokens must never be emitted. Financial audit history must survive collector outages.
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
