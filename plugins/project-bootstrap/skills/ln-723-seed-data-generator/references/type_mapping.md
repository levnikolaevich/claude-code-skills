# Type Mapping Reference

<!-- SCOPE: ORM to multi-target type mapping. Contains type conversions, nullable rules, default values for C#, TypeScript, Python. -->
<!-- DO NOT add here: Migration workflow → ln-723-seed-data-generator SKILL.md -->

Mapping rules from ORM schema types to target language types (C#, TypeScript, Python).

---

## Universal Type Mapping (All Targets)

| ORM-Agnostic Type | C# Type | TypeScript Type | Python Type | Notes |
|--------------------|---------|-----------------|-------------|-------|
| UUID/GUID | `Guid` | `string` | `str` (uuid4) | Primary/foreign key |
| String (short) | `string` | `string` | `str` | varchar, CharField |
| String (long) | `string` | `string` | `str` | text, TextField |
| Integer | `int` | `number` | `int` | |
| Big Integer | `long` | `number` | `int` | |
| Float | `float` / `double` | `number` | `float` | |
| Decimal | `decimal` | `number` | `Decimal` | Money/precise values |
| Boolean | `bool` | `boolean` | `bool` | |
| Timestamp | `DateTime` | `Date` | `datetime` | |
| Date only | `DateOnly` | `string` (ISO) | `date` | |
| Time only | `TimeOnly` | `string` (ISO) | `time` | |
| JSON | `JsonDocument` | `Record<string, unknown>` | `dict` | |
| Binary | `byte[]` | `Buffer` | `bytes` | |

---

## Drizzle to C# Type Mapping (Primary)

| Drizzle Type | C# Type | Nullable | Default Value | Notes |
|--------------|---------|----------|---------------|-------|
| `uuid('id')` | `Guid` | No | `Guid.Empty` | Primary key |
| `uuid('ref_id')` | `Guid` | Depends | `Guid.Empty` | Foreign key |
| `varchar('name', {length: N})` | `string` | Depends | `string.Empty` | Check `.notNull()` |
| `text('description')` | `string` | Yes | `null` | Long text |
| `integer('count')` | `int` | No | `0` | Numeric |
| `bigint('amount')` | `long` | No | `0L` | Large numbers |
| `real('value')` | `float` | No | `0f` | Single precision |
| `doublePrecision('value')` | `double` | No | `0d` | Double precision |
| `numeric('price', {precision, scale})` | `decimal` | No | `0m` | Money/precise |
| `boolean('isActive')` | `bool` | No | `false` | True/false |
| `timestamp('createdAt')` | `DateTime` | No | `DateTime.MinValue` | Timestamps |
| `date('birthDate')` | `DateOnly` | No | `DateOnly.MinValue` | Date only |
| `time('startTime')` | `TimeOnly` | No | `TimeOnly.MinValue` | Time only |
| `json('metadata')` | `JsonDocument` or `string` | Yes | `null` | JSON data |
| `jsonb('data')` | `JsonDocument` or `string` | Yes | `null` | Binary JSON |

---

## Prisma to C# Type Mapping

| Prisma Type | C# Type | Nullable | Notes |
|-------------|---------|----------|-------|
| `String` | `string` | Depends on `?` | Check `@db.VarChar(N)` |
| `Int` | `int` | Depends on `?` | |
| `BigInt` | `long` | Depends on `?` | |
| `Float` | `double` | Depends on `?` | |
| `Decimal` | `decimal` | Depends on `?` | |
| `Boolean` | `bool` | Depends on `?` | |
| `DateTime` | `DateTime` | Depends on `?` | |
| `Json` | `JsonDocument` | Yes | |
| `Bytes` | `byte[]` | Yes | |

---

## TypeORM to C# Type Mapping

| TypeORM Type | C# Type | Nullable | Notes |
|--------------|---------|----------|-------|
| `@PrimaryGeneratedColumn('uuid')` | `Guid` | No | Primary key |
| `@Column('varchar')` | `string` | Depends | |
| `@Column('int')` | `int` | Depends | |
| `@Column('bigint')` | `long` | Depends | |
| `@Column('decimal')` | `decimal` | Depends | |
| `@Column('boolean')` | `bool` | No | |
| `@Column('timestamp')` | `DateTime` | Depends | |
| `@Column('json')` | `JsonDocument` | Yes | |

---

## Nullable Detection Rules

| ORM | Nullable Indicator | C# Result |
|-----|-------------------|-----------|
| Drizzle | No `.notNull()` chain | `Type?` |
| Drizzle | Has `.notNull()` | `Type` |
| Prisma | Field has `?` suffix | `Type?` |
| Prisma | No `?` suffix | `Type` |
| TypeORM | `nullable: true` | `Type?` |
| TypeORM | `nullable: false` or omitted | `Type` |

---

## Primary Key Detection

| ORM | Primary Key Indicator |
|-----|-----------------------|
| Drizzle | `.primaryKey()` method |
| Prisma | `@id` attribute |
| TypeORM | `@PrimaryColumn()` or `@PrimaryGeneratedColumn()` |

---

## Foreign Key Detection

| ORM | Foreign Key Indicator | Naming Convention |
|-----|----------------------|-------------------|
| Drizzle | `.references(() => table.id)` | `{relatedTable}Id` |
| Prisma | `@relation` attribute | `{relatedModel}Id` |
| TypeORM | `@ManyToOne()`, `@JoinColumn()` | `{relatedEntity}Id` |

---

## Default Value Handling

| ORM Default | C# Handling |
|-------------|-------------|
| `.default(value)` | Set in MockData |
| `.defaultNow()` | `DateTime.UtcNow` in MockData |
| `@default(autoincrement())` | Generate sequential |
| `@default(uuid())` | `Guid.NewGuid()` |

---

## Faker Library Integration

Generated seed data files should use faker libraries for realistic values with deterministic seeding.

| Target | Library | Seed Example | Package |
|--------|---------|--------------|---------|
| **C#** | Bogus | `new Faker().UseSeed(42)` | `Bogus` NuGet |
| **TypeScript** | Faker.js | `faker.seed(42)` | `@faker-js/faker` npm |
| **Python** | Faker | `Faker.seed_instance(42)` | `faker` pip |

**Deterministic seeding** ensures reproducible data across test runs.

---

**Version:** 2.0.0
**Last Updated:** 2026-02-07
