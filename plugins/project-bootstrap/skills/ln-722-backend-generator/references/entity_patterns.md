# Entity Generation Patterns

<!-- SCOPE: .NET entity generation rules ONLY. Contains BaseEntity structure, property conventions, relationship patterns. -->
<!-- DO NOT add here: Generation workflow → ln-722-backend-generator SKILL.md -->

Rules for generating Domain entities in .NET Clean Architecture.

---

## Base Entity Structure

All entities inherit from `BaseEntity` with common properties.

| Property | Type | Purpose | Required |
|----------|------|---------|----------|
| `Id` | `Guid` | Unique identifier | Yes |
| `CreatedAt` | `DateTime` | Creation timestamp | Yes |
| `UpdatedAt` | `DateTime?` | Last modification timestamp | Optional |
| `CreatedBy` | `string?` | Creator identifier | Optional |
| `UpdatedBy` | `string?` | Modifier identifier | Optional |

---

## Property Generation Rules

| Input Type | C# Type | Attributes | Notes |
|------------|---------|------------|-------|
| String (required) | `string` | `required` | Non-nullable string |
| String (optional) | `string?` | None | Nullable string |
| Integer | `int` | None | Default 0 |
| Boolean | `bool` | None | Default false |
| Date/Time | `DateTime` | None | Use UTC convention |
| Decimal | `decimal` | None | For money/precise values |
| Enum reference | `{Entity}Status` | None | Enum type |
| Foreign key | `Guid` | None | Reference to other entity |
| Navigation | `{Related}?` | `virtual` | EF Core navigation property |

---

## Entity Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Class name | PascalCase, singular | `Epic`, `Story`, `User` |
| Property name | PascalCase | `Title`, `CreatedAt` |
| Foreign key | Related entity + "Id" | `EpicId`, `UserId` |
| Navigation property | Related entity name | `Epic`, `Stories` |
| Collection navigation | Plural of related | `Stories`, `Tasks` |

---

## Status Enum Generation

For each entity with status, generate corresponding enum.

| Enum Name | Values Pattern | Notes |
|-----------|----------------|-------|
| `{Entity}Status` | Domain-specific values | e.g., Draft, Active, Completed |
| `Priority` | Urgent, High, Normal, Low | If priority field exists |

**Common status patterns:**

| Entity Type | Typical Statuses |
|-------------|------------------|
| Work item | Draft, Active, InProgress, Done, Cancelled |
| User | Pending, Active, Suspended, Deleted |
| Request | Submitted, Processing, Approved, Rejected |

---

## Relationship Patterns

| Relationship | Parent Entity | Child Entity |
|--------------|---------------|--------------|
| One-to-Many | No FK, has collection | Has FK property |
| Many-to-One | Has FK property | No FK |
| Many-to-Many | Join table | Join table |

**FK naming:** `{ParentEntity}Id` in child entity.

---

## Validation Annotations

| Constraint | Annotation | When to Use |
|------------|------------|-------------|
| Required | `required` keyword | Non-nullable value types, required strings |
| Max length | `[MaxLength(N)]` | String length limits |
| Range | `[Range(min, max)]` | Numeric constraints |
| Regex | `[RegularExpression]` | Format validation |

---

## Default Values

| Type | Default | How to Set |
|------|---------|------------|
| `string` | `string.Empty` | `= string.Empty;` |
| `DateTime` | None (must set) | Set in constructor or service |
| `Guid` | Empty | Generate with `Guid.NewGuid()` |
| `int`, `bool` | 0, false | CLR defaults |
| Collections | Empty list | `= new List<T>();` |

---

## Entity Generation Checklist

| Step | Action |
|------|--------|
| 1 | Create class inheriting `BaseEntity` |
| 2 | Add domain-specific properties |
| 3 | Add foreign key properties (if relationships) |
| 4 | Add navigation properties (if relationships) |
| 5 | Generate status enum (if status field) |
| 6 | Add `required` for non-nullable strings |
| 7 | Initialize collections in declaration |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
