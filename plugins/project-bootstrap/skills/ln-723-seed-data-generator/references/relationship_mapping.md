# Relationship Mapping Reference

<!-- SCOPE: Entity relationship mapping rules ONLY. Contains FK handling, navigation properties, join tables. -->
<!-- DO NOT add here: Migration workflow → ln-723-seed-data-generator SKILL.md -->

Rules for handling foreign keys and relationships in MockData migration.

---

## Relationship Types

| Type | ORM Pattern | C# Pattern |
|------|-------------|------------|
| One-to-Many | Parent has collection | `List<Child>` in parent |
| Many-to-One | Child has FK | `ParentId` property in child |
| One-to-One | FK with unique | Single navigation property |
| Many-to-Many | Join table | Separate join entity |

---

## Foreign Key Detection

| ORM | FK Pattern | Extracted Info |
|-----|------------|----------------|
| Drizzle | `.references(() => table.id)` | Target table, target column |
| Prisma | `@relation(fields: [fk], references: [pk])` | FK field, target table |
| TypeORM | `@ManyToOne(() => Entity)` | Target entity |

---

## FK to C# Property Rules

| FK Column Name | C# Property Name | Notes |
|----------------|------------------|-------|
| `user_id` | `UserId` | Standard FK |
| `epic_id` | `EpicId` | Standard FK |
| `parent_id` | `ParentId` | Self-reference |
| `created_by_id` | `CreatedById` | User reference |

---

## Navigation Property Rules

| Relationship | Parent Property | Child Property |
|--------------|-----------------|----------------|
| One-to-Many | `List<Child> Children` | `Parent Parent` |
| Many-to-One | (none or single) | `Guid ParentId` |
| Self-reference | `List<Entity> Children` | `Guid? ParentId` |

---

## MockData Relationship Handling

| Rule | Implementation |
|------|----------------|
| Generate parents first | Parent GUIDs must exist before children |
| Valid FK values | Child FK must match existing parent ID |
| Balanced distribution | Distribute children across parents evenly |
| Include orphan-safe | Allow nullable FKs where schema permits |

---

## Generation Order by Dependency

| Order | Entity Type | Depends On |
|-------|-------------|------------|
| 1 | Users (no FK) | Nothing |
| 2 | Projects (user FK) | Users |
| 3 | Epics (project FK) | Projects |
| 4 | Stories (epic FK) | Epics |
| 5 | Tasks (story FK) | Stories |

---

## FK Value Assignment Patterns

| Pattern | Usage |
|---------|-------|
| Round-robin | Distribute evenly across parents |
| Weighted | More children for "important" parents |
| Random | Random valid parent |
| Fixed | First N children to first parent |

---

## Self-Referencing Relationships

| Scenario | Handling |
|----------|----------|
| Tree structure | Root items have null ParentId |
| Hierarchy | Some items reference other items |
| Depth limit | Usually 2-3 levels in mock data |

---

## Accessor Methods for Relationships

| Method | Purpose | Signature |
|--------|---------|-----------|
| GetByParentId | Get children | `Get{Children}By{Parent}Id(Guid parentId)` |
| GetWithChildren | Get parent with related | Return parent, query children separately |

---

## Validation Rules

| Check | Description |
|-------|-------------|
| FK exists | All FK values have matching parent |
| No cycles | Self-references don't create loops |
| Type match | FK type matches PK type (Guid to Guid) |

---

## Example Relationship Chain

| Entity | FK | Target |
|--------|---|--------|
| Story | EpicId | Epic.Id |
| Epic | ProjectId | Project.Id |
| Project | OwnerId | User.Id |
| Task | StoryId | Story.Id |
| Task | AssigneeId | User.Id |

**Generation order:** User → Project → Epic → Story → Task

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
