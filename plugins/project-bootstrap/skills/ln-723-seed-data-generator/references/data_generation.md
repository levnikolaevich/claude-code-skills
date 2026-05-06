# Data Generation Patterns

<!-- SCOPE: Mock data generation patterns ONLY. Contains field type → data pattern mapping, realistic value examples. -->
<!-- DO NOT add here: Migration workflow → ln-723-seed-data-generator SKILL.md -->

Patterns for generating realistic mock data by field type.

---

## Field Type to Data Pattern

| Field Type | Data Pattern | Example Values |
|------------|--------------|----------------|
| UUID/Guid | Consistent GUIDs | `Guid.Parse("...")` |
| Person name | Realistic names | John Smith, Jane Doe |
| Email | name@domain format | john.smith@example.com |
| Title/Subject | Domain-specific | "User Authentication", "Epic #1" |
| Description | Lorem-style or domain | "Implements login flow..." |
| Status | Valid enum value | draft, active, completed |
| Date (past) | Relative to now | `DateTime.UtcNow.AddDays(-30)` |
| Date (future) | Relative to now | `DateTime.UtcNow.AddDays(14)` |
| Boolean | Varied | true, false (mix) |
| Integer count | Realistic range | 1-100 for counts |
| Priority | Enum sequence | Urgent, High, Normal, Low |

---

## GUID Generation Strategy

| Strategy | Usage | Example |
|----------|-------|---------|
| Fixed GUIDs | Consistent relationships | `Guid.Parse("550e8400-e29b-41d4-a716-446655440000")` |
| Sequential suffix | Related items | `...440001`, `...440002`, `...440003` |
| Prefix grouping | By entity type | `1xxxxxxx` for Users, `2xxxxxxx` for Epics |

---

## Name Generation Patterns

| Entity | Name Pattern | Examples |
|--------|--------------|----------|
| User | FirstName LastName | Alice Johnson, Bob Chen |
| Project | Adjective Noun | "Blue Phoenix", "Fast Track" |
| Epic | Action Feature | "User Authentication", "Payment Integration" |
| Story | As/When/Given format | "User login flow", "Dashboard widget" |
| Task | Verb Noun | "Create endpoint", "Add validation" |

---

## Date Generation Patterns

| Scenario | Pattern | C# Expression |
|----------|---------|---------------|
| Created recently | -30 to -1 days | `DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 30))` |
| Due soon | +1 to +14 days | `DateTime.UtcNow.AddDays(Random.Shared.Next(1, 14))` |
| Historical | -365 to -30 days | `DateTime.UtcNow.AddDays(-Random.Shared.Next(30, 365))` |
| Future milestone | +30 to +90 days | `DateTime.UtcNow.AddDays(Random.Shared.Next(30, 90))` |

---

## Status Distribution

| Status Type | Distribution | Example |
|-------------|--------------|---------|
| Work item status | Draft: 20%, Active: 40%, Done: 30%, Cancelled: 10% | Mix for realistic view |
| User status | Active: 80%, Pending: 15%, Suspended: 5% | Mostly active |
| Priority | Normal: 50%, High: 30%, Urgent: 10%, Low: 10% | Bell curve |

---

## Relationship Data Rules

| Rule | Description |
|------|-------------|
| Valid FK | All foreign keys must reference existing parent |
| Realistic counts | 3-7 items per parent (not too few, not too many) |
| Varied relationships | Different parents have different child counts |
| Orphan prevention | No child without valid parent |

---

## Sample Count Guidelines

| Entity Type | Recommended Count | Rationale |
|-------------|-------------------|-----------|
| Root entities (User, Project) | 3-5 | Enough variety |
| Child entities (Epic, Story) | 5-10 | Realistic hierarchies |
| Leaf entities (Task, Comment) | 10-20 | Sufficient detail |
| Reference data (Status, Priority) | All values | Complete coverage |

---

## Seed Consistency

| Principle | Implementation |
|-----------|----------------|
| Reproducible | Use fixed seed for random |
| Idempotent | Same data on regeneration |
| Related | Parent IDs referenced correctly |

---

## MockData Class Structure

| Component | Purpose |
|-----------|---------|
| Private static list | Holds mock data |
| GetAll method | Returns full list |
| GetById method | Finds by ID |
| GetBy{FK} method | Filters by foreign key |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
