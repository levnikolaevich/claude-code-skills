# Program.cs Sections

<!-- SCOPE: ASP.NET Core Program.cs structure ONLY. Contains section order, service registration, middleware pipeline. -->
<!-- DO NOT add here: Generation workflow → ln-722-backend-generator SKILL.md -->

Structure and order of sections in ASP.NET Core Program.cs.

---

## Section Order

| Order | Section | Purpose |
|-------|---------|---------|
| 1 | Builder creation | `WebApplication.CreateBuilder(args)` |
| 2 | Service registration | Add services to DI container |
| 3 | App building | `builder.Build()` |
| 4 | Middleware pipeline | Configure HTTP request pipeline |
| 5 | Endpoint mapping | Map controllers, health checks |
| 6 | App run | `app.Run()` |

---

## Service Registration Sections

| Section | Services | Order |
|---------|----------|-------|
| **Core** | Controllers, EndpointsApiExplorer | First |
| **Documentation** | Swagger/OpenAPI | After core |
| **Cross-cutting** | CORS, HealthChecks | After documentation |
| **Logging** | Serilog, other loggers | After cross-cutting |
| **Application** | Custom services, repositories | Last |

---

## Service Registration Order

| Order | Registration | Purpose |
|-------|--------------|---------|
| 1 | `AddControllers()` | MVC controllers |
| 2 | `AddEndpointsApiExplorer()` | API metadata |
| 3 | `AddSwaggerGen()` | Swagger documentation |
| 4 | `AddCors()` | Cross-origin requests |
| 5 | `AddHealthChecks()` | Health monitoring |
| 6 | `UseSerilog()` | Structured logging (on Host) |
| 7 | Custom services | Application-specific |

---

## Middleware Pipeline Order

| Order | Middleware | Purpose | When to Include |
|-------|------------|---------|-----------------|
| 1 | Exception handler | Global exception handling | Always |
| 2 | HTTPS redirection | Force HTTPS | Production |
| 3 | CORS | Cross-origin policy | When CORS needed |
| 4 | Authentication | Verify identity | When auth enabled |
| 5 | Authorization | Check permissions | When auth enabled |
| 6 | Swagger | API documentation | Development |
| 7 | Static files | Serve static content | When needed |
| 8 | Routing | Route resolution | Always |
| 9 | Endpoints | Controller mapping | Always |

---

## Environment-Specific Configuration

| Environment | Configuration |
|-------------|---------------|
| Development | Swagger enabled, detailed errors, CORS permissive |
| Production | Swagger disabled, generic errors, CORS restrictive |

**Pattern:** Use `app.Environment.IsDevelopment()` for conditional middleware.

---

## Extension Method Organization

Break Program.cs into extension methods for clarity.

| Extension | Purpose | Called On |
|-----------|---------|-----------|
| `AddApiServices()` | Register API services | `IServiceCollection` |
| `AddSwaggerServices()` | Configure Swagger | `IServiceCollection` |
| `AddCorsPolicy()` | Configure CORS | `IServiceCollection` |
| `UseApiMiddleware()` | Configure middleware | `WebApplication` |

---

## Health Checks Configuration

| Check | Purpose | Endpoint |
|-------|---------|----------|
| Basic | App is running | `/health` |
| Ready | App is ready to serve | `/health/ready` |
| Live | App is alive | `/health/live` |

---

## Logging Configuration

| Provider | Purpose | Environment |
|----------|---------|-------------|
| Console | Development output | All |
| File | Persistent logs | All |
| Seq/Elasticsearch | Centralized logging | Production |

---

## Program.cs Generation Checklist

| Step | Action |
|------|--------|
| 1 | Create WebApplicationBuilder |
| 2 | Add Controllers and API Explorer |
| 3 | Add Swagger (if enabled) |
| 4 | Add CORS (if enabled) |
| 5 | Add HealthChecks (if enabled) |
| 6 | Configure Serilog (if enabled) |
| 7 | Build application |
| 8 | Configure exception middleware |
| 9 | Configure CORS middleware |
| 10 | Configure Swagger middleware |
| 11 | Map controllers |
| 12 | Map health checks |
| 13 | Run application |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
