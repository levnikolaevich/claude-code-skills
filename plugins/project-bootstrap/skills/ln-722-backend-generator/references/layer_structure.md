# Clean Architecture Layer Structure

<!-- SCOPE: .NET Clean Architecture layer definitions ONLY. Contains layer responsibilities, dependencies, project names. -->
<!-- DO NOT add here: Generation workflow → ln-722-backend-generator SKILL.md -->

Structure and responsibilities for .NET Clean Architecture projects.

---

## Layer Overview

| Layer | Project Name | Purpose | Dependencies |
|-------|--------------|---------|--------------|
| **API** | `{Project}.Api` | HTTP endpoints, request handling | Domain, Services |
| **Domain** | `{Project}.Domain` | Business entities, core logic | None (independent) |
| **Services** | `{Project}.Services` | Business logic, orchestration | Domain, Repositories |
| **Repositories** | `{Project}.Repositories` | Data access abstraction | Domain |
| **Shared** | `{Project}.Shared` | Cross-cutting utilities | None |

---

## Dependency Rules

| Layer | Can Depend On | Cannot Depend On |
|-------|---------------|------------------|
| Api | Domain, Services, Shared | Repositories (direct) |
| Services | Domain, Repositories (interfaces), Shared | Api |
| Repositories | Domain, Shared | Api, Services |
| Domain | Shared | Api, Services, Repositories |
| Shared | Nothing | All other layers |

**Key principle:** Dependencies point inward. Outer layers depend on inner layers, never the reverse.

---

## API Layer Structure

| Folder | Purpose | Contents |
|--------|---------|----------|
| `Controllers/` | HTTP endpoints | One controller per entity/feature |
| `DTOs/` | Data transfer objects | Request/Response classes |
| `Middleware/` | Cross-cutting concerns | Exception handling, logging, correlation |
| `Extensions/` | Service configuration | DI registration, middleware setup |
| `MockData/` | Development data | Static mock data classes |

---

## Domain Layer Structure

| Folder | Purpose | Contents |
|--------|---------|----------|
| `Entities/` | Business entities | Entity classes inheriting BaseEntity |
| `Enums/` | Domain enumerations | Status, Priority, Type enums |
| `Common/` | Shared base classes | BaseEntity, ValueObject |
| `Events/` | Domain events | Event classes (optional) |
| `Exceptions/` | Domain exceptions | Custom exception types (optional) |

---

## Services Layer Structure

| Folder | Purpose | Contents |
|--------|---------|----------|
| `Interfaces/` | Service contracts | I{Entity}Service interfaces |
| Root | Service implementations | {Entity}Service classes |
| `Validators/` | Business validation | FluentValidation classes (optional) |

---

## Repositories Layer Structure

| Folder | Purpose | Contents |
|--------|---------|----------|
| `Interfaces/` | Repository contracts | I{Entity}Repository interfaces |
| Root | Repository implementations | When DB is connected |

---

## Shared Layer Structure

| Folder | Purpose | Contents |
|--------|---------|----------|
| `Constants/` | Application constants | Configuration keys, magic strings |
| `Extensions/` | Extension methods | String, DateTime, etc. extensions |
| `Helpers/` | Utility classes | Static helper methods |

---

## Project References

| Project | References |
|---------|------------|
| `{Project}.Api.csproj` | Domain, Services, Shared |
| `{Project}.Services.csproj` | Domain, Repositories, Shared |
| `{Project}.Repositories.csproj` | Domain, Shared |
| `{Project}.Domain.csproj` | Shared |
| `{Project}.Shared.csproj` | (none) |

---

## Generation Order

Create projects and files in this sequence.

| Order | Project/Action | Rationale |
|-------|----------------|-----------|
| 1 | Create solution file | Container for all projects |
| 2 | `{Project}.Shared` | No dependencies, foundation |
| 3 | `{Project}.Domain` | Depends only on Shared |
| 4 | `{Project}.Repositories` | Depends on Domain |
| 5 | `{Project}.Services` | Depends on Domain, Repositories |
| 6 | `{Project}.Api` | Depends on all above |
| 7 | Add project references | Wire up dependencies |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
