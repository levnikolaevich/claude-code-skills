# Controller Generation Patterns

<!-- SCOPE: ASP.NET Core controller generation rules ONLY. Contains naming conventions, route patterns, CRUD templates. -->
<!-- DO NOT add here: Generation workflow → ln-722-backend-generator SKILL.md -->

Rules for generating ASP.NET Core Controllers in Clean Architecture.

---

## Controller Structure

| Element | Convention | Purpose |
|---------|------------|---------|
| Class name | `{Entity}Controller` | Naming convention |
| Base class | `ControllerBase` | API controller base |
| Route | `api/[controller]` | RESTful routing |
| Attributes | `[ApiController]`, `[Route]` | API behavior |

---

## Standard CRUD Endpoints

| Operation | HTTP Method | Route | Returns |
|-----------|-------------|-------|---------|
| Get all | `GET` | `/api/{entities}` | `IEnumerable<{Entity}Dto>` |
| Get by ID | `GET` | `/api/{entities}/{id}` | `{Entity}Dto` or 404 |
| Create | `POST` | `/api/{entities}` | `{Entity}Dto` with 201 |
| Update | `PUT` | `/api/{entities}/{id}` | `{Entity}Dto` or 404 |
| Delete | `DELETE` | `/api/{entities}/{id}` | 204 or 404 |

---

## Endpoint Generation Rules

| Endpoint Type | Action Name | Attributes | Response |
|---------------|-------------|------------|----------|
| Get all | `GetAll()` | `[HttpGet]` | `Ok(list)` |
| Get by ID | `GetById(Guid id)` | `[HttpGet("{id}")]` | `Ok(item)` or `NotFound()` |
| Create | `Create({Entity}CreateDto dto)` | `[HttpPost]` | `CreatedAtAction(...)` |
| Update | `Update(Guid id, {Entity}UpdateDto dto)` | `[HttpPut("{id}")]` | `Ok(item)` or `NotFound()` |
| Delete | `Delete(Guid id)` | `[HttpDelete("{id}")]` | `NoContent()` or `NotFound()` |

---

## DTO Patterns

| DTO Type | Purpose | Properties |
|----------|---------|------------|
| `{Entity}Dto` | Response DTO | All readable properties |
| `{Entity}CreateDto` | Create request | Required fields only |
| `{Entity}UpdateDto` | Update request | Updatable fields only |
| `{Entity}ListDto` | List item (summary) | Subset for lists |

---

## Dependency Injection

| Dependency | Purpose | Injection |
|------------|---------|-----------|
| `ILogger<{Entity}Controller>` | Logging | Constructor |
| `I{Entity}Service` | Business logic | Constructor (when services implemented) |
| MockData class | Development data | Static method call |

---

## Response Patterns

| Scenario | Response Method | HTTP Status |
|----------|-----------------|-------------|
| Success with data | `Ok(data)` | 200 |
| Created resource | `CreatedAtAction(...)` | 201 |
| No content | `NoContent()` | 204 |
| Not found | `NotFound()` | 404 |
| Bad request | `BadRequest(errors)` | 400 |
| Validation error | `ValidationProblem()` | 400 |

---

## Route Naming Conventions

| Entity | Controller Route | Example URLs |
|--------|------------------|--------------|
| `Epic` | `api/epics` | `GET /api/epics`, `GET /api/epics/{id}` |
| `Story` | `api/stories` | `GET /api/stories`, `POST /api/stories` |
| `User` | `api/users` | `GET /api/users/{id}`, `PUT /api/users/{id}` |

**Rule:** Pluralize entity name for route.

---

## MockData Integration

For initial development without database:

| Pattern | Usage |
|---------|-------|
| Static data class | `{Feature}MockData` |
| Get all method | `{Feature}MockData.Get{Entities}()` |
| Get by ID method | `{Feature}MockData.Get{Entity}ById(id)` |

---

## Controller Generation Checklist

| Step | Action |
|------|--------|
| 1 | Create controller class with attributes |
| 2 | Add constructor with ILogger |
| 3 | Generate GetAll endpoint |
| 4 | Generate GetById endpoint |
| 5 | Generate Create endpoint (if needed) |
| 6 | Generate Update endpoint (if needed) |
| 7 | Generate Delete endpoint (if needed) |
| 8 | Wire up MockData or Service calls |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
