# API Contract Detection Patterns

Language-specific detection patterns for ln-643 audit rules.

## Rule 1: Layer Leakage in Signatures

Service/domain method accepts HTTP-layer types.

### Detection by Language

| Language/Framework | Detection Grep | Example Violation |
|--------------------|----------------|-------------------|
| Python/FastAPI | `from fastapi import Request` in `**/services/**` or `**/domain/**` | `def translate(self, request: Request)` |
| Python/FastAPI | `parsed_body:\s*dict\|form_data:\s*dict\|headers:\s*dict` in service methods | `def process(self, parsed_body: dict)` |
| Python/Flask | `from flask import request` in `**/services/**` | `flask.request.json` in service layer |
| TS/Express | `req:\s*Request\|res:\s*Response` in `**/services/**` | `process(req: Request)` |
| TS/NestJS | `@Req\(\)\|@Res\(\)\|@Body\(\)` in `**/services/**` | NestJS decorators in service |
| C#/ASP.NET | `HttpContext\|HttpRequest\|IFormFile` in `**/Services/**` | `Process(HttpContext ctx)` |
| Java/Spring | `HttpServletRequest\|@RequestBody` in `**/service/**` | `void process(HttpServletRequest req)` |

### False Positive Exclusions

| Pattern | Why Exclude |
|---------|-------------|
| `**/test*/**` or `**/*.test.*` | Test files may mock HTTP types |
| `**/middleware/**` or `**/interceptor/**` | Middleware legitimately uses HTTP types |
| `**/api/**` or `**/controllers/**` | API layer is allowed to use HTTP types |

## Rule 2: Missing DTO for Grouped Parameters

4+ related parameters always passed together.

### Detection

| Step | Tool | Pattern |
|------|------|---------|
| 1. Find method signatures | Grep | `def \|function \|=>.*\(` in service files |
| 2. Count params | Grep | `,.*,.*,.*,` (4+ commas = 5+ params) |
| 3. Find repeated groups | Compare | Same 4+ param names in 2+ methods |

### Language-Specific Hints

| Language | DTO Convention | Detection |
|----------|---------------|-----------|
| Python | `@dataclass` or `BaseModel` | `Grep("@dataclass\|class.*BaseModel\|class.*NamedTuple")` |
| TypeScript | `interface` or `type` | `Grep("interface.*Request\|type.*Params\|interface.*Input")` |
| C# | `record` or `class` | `Grep("record.*Request\|class.*Dto\|class.*Command")` |
| Java | `record` or POJO | `Grep("record.*Request\|class.*Dto\|class.*Request")` |

## Rule 3: Entity Leakage to API

ORM/domain entity returned directly from API endpoint.

### Detection by Language

| Language/Framework | Detection Grep | What It Finds |
|--------------------|----------------|---------------|
| Python/FastAPI | `return.*user\|return.*item` in endpoint WITHOUT `response_model=` | ORM object returned without DTO |
| Python/FastAPI | `__dict__\|model_dump\(\)` in API endpoints | Manual serialization (fragile) |
| Python/SQLAlchemy | `from.*models import` in `**/api/**` WITHOUT matching `from.*schemas import` | Model imported but no schema |
| TS/TypeORM | `return.*repository\.(find\|save)` in controller without `.toDTO()` | Entity returned directly |
| C#/EF | `return.*_context\.\w+\.Find\|return.*await.*_context` without `.Select(` | DbSet result returned |
| Java/JPA | `return.*repository\.(find\|save)` without `mapper\|Dto` | JPA entity exposed |

### Verification: Response DTO Exists

| Framework | Check Pattern |
|-----------|---------------|
| FastAPI | `response_model=\|-> .*Schema\|-> .*Response` on endpoint |
| NestJS | `@ApiResponse\|@ApiOkResponse\|ResponseDto` |
| ASP.NET | `ActionResult<.*Dto>\|Ok\\(.*Dto` |
| Spring | `ResponseEntity<.*Dto>` |

## Rule 4: Inconsistent Error Contracts

Mixed error patterns within same service.

### Detection

| Step | Tool | Pattern |
|------|------|---------|
| 1. Find raises | Grep | `raise \|throw \|throw new` in service methods |
| 2. Find return None | Grep | `return None\|return null\|return undefined` in same service |
| 3. Find Result type | Grep | `Result\|Either\|Optional\|Maybe` in return types |
| 4. Compare | Logic | If 2+ patterns in same service class → violation |

### Language-Specific Patterns

| Language | Pattern A (Exception) | Pattern B (Null return) | Pattern C (Result type) |
|----------|-----------------------|-------------------------|-------------------------|
| Python | `raise.*Error\|raise.*Exception` | `return None` | `Result\|Either\|Optional` |
| TypeScript | `throw new.*Error` | `return null\|return undefined` | `Result<\|Either<\|Option<` |
| C# | `throw new.*Exception` | `return null` | `Result<\|OneOf<\|ErrorOr<` |
| Java | `throw new.*Exception` | `return null\|return Optional.empty` | `Either<\|Result<\|Try<` |

## Rule 5: Redundant Method Overloads

Two methods differ only in 1-2 params that could be optional.

### Detection

| Step | Tool | Pattern |
|------|------|---------|
| 1. Find suffixed methods | Grep | `_with_\|_and_\|_full\|_detailed\|_extended` in method names |
| 2. Compare signatures | Read | Base method params subset of extended method params |
| 3. Flag if | Logic | Extended = Base + 1-2 optional params |

### Common Suffix Patterns

| Suffix Pattern | Merge Strategy |
|----------------|---------------|
| `get_X` + `get_X_with_Y` | `get_X(include_Y=False)` |
| `find_X` + `find_X_detailed` | `find_X(detailed=False)` |
| `process_X` + `process_X_and_notify` | `process_X(notify=False)` |
| `create_X` + `create_X_with_defaults` | `create_X(use_defaults=True)` |

## Rule 6: Architectural Honesty

Read-named function contains write side-effects (architecturally dishonest interface).

### Detection

**MANDATORY READ:** `references/ai_ready_architecture.md` for complete side-effect marker patterns and false positive exclusions.

| Step | Tool | Pattern |
|------|------|---------|
| 1. Find read-named functions | Grep | `(def\|function\|async)\s+(get_\|find_\|check_\|validate_\|is_\|has_)` in service files |
| 2. Check body for write markers | Grep | Side-effect markers per reference (DB writes, HTTP calls, notifications, events) |
| 3. Apply exclusions | Logic | Skip get_or_create, @cache decorators, CQRS handlers, check_and_* (per reference) |

### Severity

| Condition | Severity |
|-----------|----------|
| Read-named function in auth/payment service with write side-effects | HIGH |
| Read-named function in other services with write side-effects | MEDIUM |

---
**Version:** 1.1.0
