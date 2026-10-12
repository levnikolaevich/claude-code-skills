#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > Dockerfile <<'FIXTURE_CONTENT'
FROM python:3.12-slim
COPY app.py /app.py
CMD ["python","/app.py"]
FIXTURE_CONTENT
mkdir -p .
cat > app.py <<'FIXTURE_CONTENT'
import missing_runtime_package
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
