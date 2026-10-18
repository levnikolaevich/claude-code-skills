#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > package.json <<'FIXTURE_CONTENT'
{"name":"sample","private":true,"scripts":{"check":"node tools/check.mjs"}}
FIXTURE_CONTENT
mkdir -p tools
cat > tools/check.mjs <<'FIXTURE_CONTENT'
console.log("No checks configured yet");
FIXTURE_CONTENT
mkdir -p .
cat > standards.md <<'FIXTURE_CONTENT'
# Accepted standards

Application TypeScript and CSS must have static checks. Warnings fail. Current command does not enforce this. Record the missing controls and their owning configuration in this document, without implementing them. No mandatory coordinator or second standards file.
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
