# ORM Schema Parsing Patterns

<!-- SCOPE: ORM schema parsing rules for all supported ORMs. Contains detection patterns, constraint extraction, reference detection. -->
<!-- DO NOT add here: Migration workflow → ln-723-seed-data-generator SKILL.md -->

Rules for parsing ORM schemas and extracting entity information across multiple ORMs.

---

## Schema File Structure

| Element | Pattern | Purpose |
|---------|---------|---------|
| Table definition | `export const tableName = pgTable('table_name', {...})` | Entity definition |
| Column definition | `columnName: type('db_name')` | Property definition |
| Constraints | `.primaryKey()`, `.notNull()`, `.unique()` | Validation rules |
| References | `.references(() => otherTable.id)` | Foreign keys |
| Defaults | `.default(value)`, `.defaultNow()` | Default values |

---

## Table Detection Pattern

| Pattern | Extraction |
|---------|------------|
| `export const X = pgTable(` | Table name: `X` |
| `pgTable('db_table_name'` | Database table name |
| Content between `{` and `}` | Column definitions |

---

## Column Detection Patterns

| Pattern | Column Name | Type |
|---------|-------------|------|
| `id: uuid('id')` | `id` | uuid |
| `title: varchar('title', {length: 255})` | `title` | varchar(255) |
| `status: varchar('status', {length: 50})` | `status` | varchar(50) |
| `count: integer('count')` | `count` | integer |
| `isActive: boolean('is_active')` | `isActive` | boolean |
| `createdAt: timestamp('created_at')` | `createdAt` | timestamp |

---

## Constraint Detection

| Constraint | Pattern | C# Impact |
|------------|---------|-----------|
| Primary key | `.primaryKey()` | Mark as `Id` property |
| Not null | `.notNull()` | Non-nullable type |
| Unique | `.unique()` | Validation only |
| Default | `.default(X)` | Set in MockData |
| Default now | `.defaultNow()` | `DateTime.UtcNow` |

---

## Reference Detection

| Pattern | Extracted Info |
|---------|----------------|
| `.references(() => users.id)` | FK to `users` table, column `id` |
| `.references(() => epics.id, {onDelete: 'cascade'})` | FK with cascade delete |

---

## Enum Detection

| Pattern | Extraction |
|---------|------------|
| `export const statusEnum = pgEnum('status', ['draft', 'active', 'done'])` | Enum name: `status`, values: draft, active, done |
| Column using enum: `status: statusEnum('status')` | Column uses enum type |

---

## Parsing Steps

| Step | Action | Output |
|------|--------|--------|
| 1 | Find all `pgTable()` calls | List of table definitions |
| 2 | Extract table name from export | Entity name |
| 3 | Parse column definitions | List of (name, type, constraints) |
| 4 | Identify primary keys | Mark `Id` properties |
| 5 | Identify foreign keys | List of relationships |
| 6 | Find enum definitions | Enum types and values |
| 7 | Extract defaults | Default value mappings |

---

## Name Transformation Rules

| Source (Drizzle) | Target (C#) | Example |
|------------------|-------------|---------|
| snake_case table | PascalCase class | `user_profiles` → `UserProfile` |
| snake_case column | PascalCase property | `created_at` → `CreatedAt` |
| plural table name | singular class | `epics` → `Epic` |
| enum name | PascalCase enum | `status_enum` → `StatusEnum` |

---

## Common Schema Patterns

| Pattern | Meaning |
|---------|---------|
| `id: uuid('id').primaryKey()` | UUID primary key |
| `...timestamps` | createdAt, updatedAt columns |
| `userId: uuid('user_id').references(() => users.id)` | Foreign key to users |
| `status: varchar('status', {length: 50}).default('draft')` | Status with default |

---

## ORM Auto-Detection

| ORM | Detection Pattern | Files |
|-----|-------------------|-------|
| **Drizzle** | `pgTable()`, `mysqlTable()`, `sqliteTable()` | `drizzle.config.ts`, `references/schema.ts` |
| **Prisma** | `model X {` syntax | `prisma/schema.prisma` |
| **TypeORM** | `@Entity()`, `@Column()` decorators | `*.entity.ts` |
| **EF Core** | `DbContext`, `DbSet<T>` | `*.cs` with EF references |
| **SQLAlchemy** | `Column()`, `relationship()`, `Base = declarative_base()` | `models.py`, `models/*.py` |
| **Django ORM** | `models.Model`, `models.CharField()` | `models.py` in Django apps |

---

## Prisma Schema Parsing

### Model Detection

| Pattern | Extraction |
|---------|------------|
| `model User {` | Model name: `User` |
| Content between `{` and `}` | Field definitions |

### Field Detection

| Pattern | Field | Type |
|---------|-------|------|
| `id String @id @default(uuid())` | `id` | String (PK) |
| `name String` | `name` | String (required) |
| `email String?` | `email` | String (nullable) |
| `age Int @default(0)` | `age` | Int |
| `posts Post[]` | `posts` | Relation (one-to-many) |

### Constraint Detection

| Constraint | Pattern |
|------------|---------|
| Primary key | `@id` |
| Unique | `@unique` |
| Default | `@default(value)` |
| Relation | `@relation(fields: [...], references: [...])` |
| Index | `@@index([field1, field2])` |

---

## TypeORM Schema Parsing

### Entity Detection

| Pattern | Extraction |
|---------|------------|
| `@Entity('table_name')` | Entity with explicit table name |
| `@Entity()` class User | Entity with class name as table |

### Column Detection

| Pattern | Field | Type |
|---------|-------|------|
| `@PrimaryGeneratedColumn('uuid')` | id | uuid (PK) |
| `@Column('varchar', { length: 255 })` | field | varchar |
| `@Column({ nullable: true })` | field | nullable |
| `@CreateDateColumn()` | createdAt | timestamp |

### Relation Detection

| Pattern | Relation Type |
|---------|---------------|
| `@ManyToOne(() => User)` | Many-to-one FK |
| `@OneToMany(() => Post, post => post.user)` | One-to-many |
| `@JoinColumn({ name: 'user_id' })` | FK column name |

---

## EF Core Schema Parsing

### Entity Detection

| Pattern | Extraction |
|---------|------------|
| `public class User` in models folder | Entity class |
| `public DbSet<User> Users { get; set; }` | DbSet registration |

### Property Detection

| Pattern | Field | Type |
|---------|-------|------|
| `public Guid Id { get; set; }` | Id | Guid (PK by convention) |
| `public string Name { get; set; }` | Name | string (required) |
| `public string? Description { get; set; }` | Description | string (nullable) |
| `public DateTime CreatedAt { get; set; }` | CreatedAt | DateTime |

### Fluent API Configuration

| Pattern | Meaning |
|---------|---------|
| `entity.HasKey(e => e.Id)` | Primary key |
| `entity.Property(e => e.Name).IsRequired()` | Not null |
| `entity.HasOne(e => e.User).WithMany(u => u.Posts)` | Relationship |

---

## Name Transformation Rules (Universal)

| Source Convention | Target Convention | Example |
|-----------------|-------------------|---------|
| snake_case | PascalCase (C#) | `user_profiles` -> `UserProfile` |
| snake_case | camelCase (TS) | `user_profiles` -> `userProfiles` |
| snake_case | snake_case (Python) | `user_profiles` -> `user_profiles` |
| Plural table | Singular class | `epics` -> `Epic` |

---

**Version:** 2.0.0
**Last Updated:** 2026-02-07
