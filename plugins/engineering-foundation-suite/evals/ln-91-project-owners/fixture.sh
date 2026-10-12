#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > AGENTS.md <<'FIXTURE_CONTENT'
# Instructions
Technical policy belongs to docs/technical.md. Recurring release steps belong to docs/release.md.
FIXTURE_CONTENT
mkdir -p docs
cat > docs/technical.md <<'FIXTURE_CONTENT'
# Technical contract
All projects must use Node.js JWT middleware and a Docker image.
FIXTURE_CONTENT
mkdir -p docs
cat > docs/architecture.md <<'FIXTURE_CONTENT'
# Accepted drivers
The CLI must work offline. Static docs have no database or user accounts.
FIXTURE_CONTENT
mkdir -p docs
cat > docs/release.md <<'FIXTURE_CONTENT'
# Release
No release has been authorized.
FIXTURE_CONTENT
mkdir -p node
cat > node/package.json <<'FIXTURE_CONTENT'
{"name":"web","private":true,"engines":{"node":">=22"},"scripts":{"start":"node server.mjs"}}
FIXTURE_CONTENT
mkdir -p node
cat > node/server.mjs <<'FIXTURE_CONTENT'
console.log("static preview")
FIXTURE_CONTENT
mkdir -p python
cat > python/pyproject.toml <<'FIXTURE_CONTENT'
[project]
name="offline-cli"
version="0.1.0"
requires-python=">=3.11"
FIXTURE_CONTENT
mkdir -p dotnet
cat > dotnet/Library.csproj <<'FIXTURE_CONTENT'
<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>
FIXTURE_CONTENT
mkdir -p static
cat > static/index.html <<'FIXTURE_CONTENT'
<h1>Reference</h1>
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
