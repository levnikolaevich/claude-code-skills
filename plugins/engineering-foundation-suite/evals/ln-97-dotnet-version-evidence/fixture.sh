#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > App.csproj <<'FIXTURE_CONTENT'
<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>
FIXTURE_CONTENT
mkdir -p .
cat > handler.cs <<'FIXTURE_CONTENT'
// Registered IExceptionHandler excerpt; default ExceptionHandlerOptions.
logger.LogError(exception, "Request failed");
httpContext.Response.StatusCode = 500;
await httpContext.Response.WriteAsJsonAsync(new { code = "internal_error" });
return true;
FIXTURE_CONTENT
mkdir -p .
cat > proposal.md <<'FIXTURE_CONTENT'
Delete logger.LogError because middleware always emits diagnostics even when TryHandleAsync returns true. This was true for our .NET 8 service.
FIXTURE_CONTENT
mkdir -p .
cat > policy.md <<'FIXTURE_CONTENT'
Unexpected request failures must retain one diagnostic owner. This fixture supplies a reference snapshot; no network research or runtime execution is available.
FIXTURE_CONTENT
mkdir -p .
cat > reference.md <<'FIXTURE_CONTENT'
# Microsoft Learn reference snapshot
Source: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling?view=aspnetcore-10.0#iexceptionhandler
Checked: 2026-10-12
> Starting in .NET 10, diagnostics are suppressed by default for handled exceptions.
The page contrasts earlier versions and documents SuppressDiagnosticsCallback for explicitly changing that default.
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
