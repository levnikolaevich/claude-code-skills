#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > README.md <<'FIXTURE_CONTENT'
# Contianer notes
This is documentation copy, not a packaging task.
FIXTURE_CONTENT
mkdir -p .
cat > Dockerfile <<'FIXTURE_CONTENT'
FROM scratch
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
