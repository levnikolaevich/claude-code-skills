# .NET Version Compatibility Matrix

<!-- SCOPE: .NET version compatibility matrix ONLY. Contains SDK versions, LTS status, package compatibility. -->
<!-- DO NOT add here: Upgrade workflow → ln-822-nuget-upgrader SKILL.md -->

Version compatibility for .NET SDK, runtime, and common packages.

---

## .NET SDK Versions

| .NET Version | Status | Support End | LTS |
|--------------|--------|-------------|-----|
| .NET 10 | Current | TBD | Yes |
| .NET 9 | Current | May 2026 | No |
| .NET 8 | LTS | Nov 2026 | Yes |
| .NET 7 | EOL | May 2024 | No |
| .NET 6 | LTS | Nov 2024 | Yes |

---

## Package Compatibility

### Microsoft.EntityFrameworkCore

| EF Core | .NET 6 | .NET 7 | .NET 8 | .NET 9 | .NET 10 |
|---------|--------|--------|--------|--------|---------|
| 6.x | Yes | Yes | No | No | No |
| 7.x | No | Yes | Yes | No | No |
| 8.x | No | No | Yes | Yes | No |
| 9.x | No | No | No | Yes | Yes |

### ASP.NET Core

| ASP.NET | .NET Version | Notes |
|---------|--------------|-------|
| 6.x | .NET 6 | LTS |
| 7.x | .NET 7 | STS |
| 8.x | .NET 8 | LTS |
| 9.x | .NET 9 | STS |

---

## Upgrade Paths

### Recommended Sequence

| From | To | Skip |
|------|----|------|
| .NET 6 | .NET 8 | Yes (.NET 7 is EOL) |
| .NET 7 | .NET 8 | Direct upgrade |
| .NET 8 | .NET 9 | Direct upgrade |
| .NET 9 | .NET 10 | Direct upgrade |

### Breaking Changes by Version

| Version | Key Changes |
|---------|-------------|
| .NET 7 → 8 | Rate limiting, output caching |
| .NET 8 → 9 | Blazor improvements, AOT |
| .NET 9 → 10 | TBD |

---

## Target Framework Monikers

| TFM | Description |
|-----|-------------|
| net6.0 | .NET 6 |
| net7.0 | .NET 7 |
| net8.0 | .NET 8 |
| net9.0 | .NET 9 |
| net10.0 | .NET 10 |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
