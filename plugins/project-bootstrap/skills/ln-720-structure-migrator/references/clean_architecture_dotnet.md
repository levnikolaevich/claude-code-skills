# Clean Architecture Template (.NET)

<!-- SCOPE: .NET Clean Architecture folder structure ONLY. Contains Api/Domain/Infrastructure layers, file naming. -->
<!-- DO NOT add here: Migration workflow → ln-720-structure-migrator SKILL.md -->

Reference structure for .NET backend projects.

---

## Directory Structure

```
src/
├── {Project}.Api/
│   ├── Controllers/
│   ├── DTOs/
│   │   ├── Requests/
│   │   └── Responses/
│   ├── Middleware/
│   ├── MockData/
│   ├── Extensions/
│   ├── Program.cs
│   └── appsettings.json
│
├── {Project}.Domain/
│   ├── Entities/
│   ├── Enums/
│   └── Common/
│
├── {Project}.Services/
│   ├── Interfaces/
│   └── Implementations/
│
├── {Project}.Repositories/
│   ├── Interfaces/
│   ├── Implementations/
│   └── Data/
│
└── {Project}.Shared/
    ├── Constants/
    └── Helpers/
```

---

## Layer Responsibilities

| Layer | Project | Responsibilities | Dependencies |
|-------|---------|------------------|--------------|
| **API** | {Project}.Api | HTTP endpoints, DTOs, Middleware, Extensions | Services, Shared |
| **Domain** | {Project}.Domain | Entities, Enums, Business rules | None |
| **Services** | {Project}.Services | Business logic, Orchestration | Domain, Repositories |
| **Repositories** | {Project}.Repositories | Data access, Persistence | Domain |
| **Shared** | {Project}.Shared | Constants, Helpers, Extensions | None |

---

## Project References

| Project | References | Rationale |
|---------|------------|-----------|
| Api | Services, Shared | Needs business logic, utilities |
| Services | Domain, Repositories | Business logic uses entities and data |
| Repositories | Domain | Data layer maps to entities |
| Domain | (none) | Core, independent |
| Shared | (none) | Utilities, independent |

---

## API Layer Components

| Folder | Purpose | Contents |
|--------|---------|----------|
| Controllers/ | HTTP endpoints | One controller per entity/feature |
| DTOs/Requests/ | Input validation | Create/Update request classes |
| DTOs/Responses/ | Output formatting | Response classes, paginated responses |
| Middleware/ | Cross-cutting | Exception, Logging, CorrelationId |
| MockData/ | Development data | Static mock data per feature |
| Extensions/ | DI configuration | Service registration methods |

---

## Domain Layer Components

| Folder | Purpose | Contents |
|--------|---------|----------|
| Entities/ | Business objects | Entity classes inheriting BaseEntity |
| Enums/ | Domain enumerations | Status, Priority, Type enums |
| Common/ | Base classes | BaseEntity, AuditableEntity |

---

## Program.cs Structure

| Section | Purpose | Order |
|---------|---------|-------|
| Builder creation | Initialize WebApplicationBuilder | 1 |
| Serilog config | Configure structured logging | 2 |
| Service registration | AddControllers, AddSwagger, AddCors, AddHealthChecks | 3 |
| App services | AddApplicationServices extension | 4 |
| Build app | builder.Build() | 5 |
| Middleware pipeline | Correlation, Logging, Exception, CORS | 6 |
| Endpoints | MapControllers, MapHealthChecks | 7 |
| Run | app.Run() | 8 |

---

## NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| Swashbuckle.AspNetCore | 7.* | Swagger/OpenAPI |
| Serilog.AspNetCore | 9.* | Structured logging |
| Serilog.Sinks.Console | 6.* | Console output |

---

## Controller Conventions

| Aspect | Convention |
|--------|------------|
| Route | `api/[controller]` |
| Base class | `ControllerBase` |
| Attributes | `[ApiController]`, `[Route]` |
| DI | Constructor injection |
| Response types | `[ProducesResponseType]` attributes |
| Async | All actions async |

---

## Entity Conventions

| Aspect | Convention |
|--------|------------|
| Base class | Inherit from `BaseEntity` or `AuditableEntity` |
| Primary key | `Guid Id` in base class |
| Required strings | `required` keyword |
| Collections | Initialize with `new List<T>()` |
| Timestamps | `CreatedAt`, `UpdatedAt` in AuditableEntity |

---

**Version:** 2.0.0
**Last Updated:** 2026-01-10
