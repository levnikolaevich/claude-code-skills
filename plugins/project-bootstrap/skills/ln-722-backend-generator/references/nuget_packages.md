# NuGet Package Dependencies

<!-- SCOPE: NuGet package reference for .NET projects ONLY. Contains package names, versions, target projects. -->
<!-- DO NOT add here: Generation workflow → ln-722-backend-generator SKILL.md -->

Required and optional packages for .NET Clean Architecture projects.

---

## Core Packages (Always Required)

| Package | Version | Purpose | Project |
|---------|---------|---------|---------|
| None (built-in) | — | ASP.NET Core included in SDK | Api |

---

## Documentation Packages

| Package | Version | Purpose | When to Include |
|---------|---------|---------|-----------------|
| `Swashbuckle.AspNetCore` | Latest | Swagger/OpenAPI documentation | When `useSwagger: true` |

---

## Logging Packages

| Package | Version | Purpose | When to Include |
|---------|---------|---------|-----------------|
| `Serilog.AspNetCore` | Latest | Structured logging integration | When `useSerilog: true` |
| `Serilog.Sinks.Console` | Latest | Console output | When `useSerilog: true` |
| `Serilog.Sinks.File` | Latest | File output | Optional with Serilog |

---

## Health Check Packages

| Package | Version | Purpose | When to Include |
|---------|---------|---------|-----------------|
| `AspNetCore.HealthChecks.UI` | Latest | Health check UI | Optional |
| `AspNetCore.HealthChecks.SqlServer` | Latest | SQL Server health | When using SQL Server |

---

## Data Access Packages (Future)

| Package | Version | Purpose | When to Include |
|---------|---------|---------|-----------------|
| `Microsoft.EntityFrameworkCore` | Latest | ORM | When DB connected |
| `Microsoft.EntityFrameworkCore.SqlServer` | Latest | SQL Server provider | When using SQL Server |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | Latest | PostgreSQL provider | When using PostgreSQL |

---

## Validation Packages (Optional)

| Package | Version | Purpose | When to Include |
|---------|---------|---------|-----------------|
| `FluentValidation.AspNetCore` | Latest | Request validation | When validation needed |

---

## Package Installation by Project

| Project | Required Packages | Optional Packages |
|---------|-------------------|-------------------|
| `{Project}.Api` | Swashbuckle (if Swagger) | Serilog, HealthChecks |
| `{Project}.Domain` | None | FluentValidation |
| `{Project}.Services` | None | None |
| `{Project}.Repositories` | None | EF Core (when DB) |
| `{Project}.Shared` | None | None |

---

## Configuration Matrix

| Option | Packages Added |
|--------|----------------|
| `useSwagger: true` | Swashbuckle.AspNetCore |
| `useSerilog: true` | Serilog.AspNetCore, Serilog.Sinks.Console |
| `useHealthChecks: true` | (built-in, no extra packages) |

---

## Version Strategy

| Strategy | Description |
|----------|-------------|
| Latest stable | Use latest stable version for new projects |
| Lock versions | Pin versions in production projects |
| Central management | Use Directory.Packages.props for consistency |

---

## Package Sources

| Source | URL | Purpose |
|--------|-----|---------|
| NuGet.org | https://api.nuget.org/v3/index.json | Public packages |
| Private feed | Company-specific | Internal packages |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
