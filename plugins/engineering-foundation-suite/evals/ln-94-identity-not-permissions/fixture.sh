#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > auth.py <<'FIXTURE_CONTENT'
def actor(header, session, validate):
    if header:
        result = validate(header)
        if result:
            return result
    return session.get("actor")
FIXTURE_CONTENT
mkdir -p .
cat > policy.json <<'FIXTURE_CONTENT'
{"viewer":["read"],"admin":["read","write"]}
FIXTURE_CONTENT
mkdir -p .
cat > README.md <<'FIXTURE_CONTENT'
An explicit Authorization header selects API credentials. Invalid API credentials must be rejected, even when a browser session exists.
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
