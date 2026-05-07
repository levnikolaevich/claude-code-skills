# Stack Detection Reference

<!-- SCOPE: Technology detection patterns ONLY. Contains file markers, dependency patterns, detection priority. -->
<!-- DO NOT add here: Bootstrap workflow → ln-700-project-bootstrap SKILL.md -->

Technology detection patterns for ln-700-project-bootstrap.

---

## Detection Priority

1. **Explicit markers** (config files, project files)
2. **Dependencies** (package.json, requirements.txt, .csproj)
3. **File patterns** (extensions, naming conventions)
4. **Content analysis** (imports, syntax)

---

## Frontend Detection

### React

**Primary indicators:**
```bash
# package.json
"dependencies": {
  "react": "^19.x",
  "react-dom": "^19.x"
}

# File patterns
*.tsx, *.jsx
```

**Secondary indicators:**
```javascript
// Imports
import React from 'react';
import { useState, useEffect } from 'react';

// JSX syntax
return <div>...</div>;
```

**Build tools:**
| Tool | Detection |
|------|-----------|
| Vite | vite.config.ts, "vite" in devDependencies |
| CRA | react-scripts in dependencies |
| Next.js | next.config.js, "next" in dependencies |
| Remix | remix.config.js, "@remix-run" in dependencies |

**UI Libraries:**
| Library | Detection |
|---------|-----------|
| shadcn/ui | components.json, @radix-ui/* |
| MUI | @mui/material |
| Chakra | @chakra-ui/react |
| Ant Design | antd |

### Vue

**Primary indicators:**
```bash
# package.json
"dependencies": {
  "vue": "^3.x"
}

# File patterns
*.vue
```

**Secondary indicators:**
```html
<template>
  <div>...</div>
</template>
<script setup>
```

### Angular

**Primary indicators:**
```bash
# package.json
"dependencies": {
  "@angular/core": "^17.x"
}

# Config
angular.json
```

**File patterns:**
```
*.component.ts
*.module.ts
*.service.ts
```

### Svelte

**Primary indicators:**
```bash
# package.json
"dependencies": {
  "svelte": "^4.x"
}

# File patterns
*.svelte
```

---

## Backend Detection

### Node.js

**Frameworks:**
| Framework | Detection |
|-----------|-----------|
| Express | "express" in dependencies |
| Fastify | "fastify" in dependencies |
| NestJS | "@nestjs/core" in dependencies |
| Koa | "koa" in dependencies |
| Hono | "hono" in dependencies |

**TypeScript:**
- tsconfig.json exists
- *.ts files in server/

### .NET

**Primary indicators:**
```bash
# Project files
*.csproj
*.sln
```

**Framework detection:**
```xml
<!-- In .csproj -->
<TargetFramework>net10.0</TargetFramework>

<!-- Web API -->
<PackageReference Include="Microsoft.AspNetCore.OpenApi" />

<!-- Entity Framework -->
<PackageReference Include="Microsoft.EntityFrameworkCore" />
```

**Project types:**
| Type | Indicators |
|------|------------|
| Web API | Program.cs with WebApplication |
| Minimal API | app.MapGet() patterns |
| MVC | Controllers/ folder |
| Blazor | _Imports.razor |

### Python

**Primary indicators:**
```bash
# Dependency files
requirements.txt
pyproject.toml
setup.py
Pipfile
```

**Frameworks:**
| Framework | Detection |
|-----------|-----------|
| FastAPI | "fastapi" in requirements |
| Flask | "flask" in requirements |
| Django | "django" in requirements, manage.py |

### Go

**Primary indicators:**
```bash
go.mod
go.sum
```

**Frameworks:**
| Framework | Detection |
|-----------|-----------|
| Gin | "github.com/gin-gonic/gin" |
| Echo | "github.com/labstack/echo" |
| Fiber | "github.com/gofiber/fiber" |

---

## Database Detection

### PostgreSQL

**Indicators:**
```bash
# Environment
DATABASE_URL=postgres://...
POSTGRES_HOST=...

# Docker
image: postgres:17

# Dependencies
pg, node-postgres (Node)
psycopg2, asyncpg (Python)
Npgsql (C#)
```

### MongoDB

**Indicators:**
```bash
# Environment
MONGODB_URI=mongodb://...
MONGO_URL=...

# Dependencies
mongodb, mongoose (Node)
pymongo, motor (Python)
MongoDB.Driver (C#)
```

### MySQL/MariaDB

**Indicators:**
```bash
# Environment
DATABASE_URL=mysql://...
MYSQL_HOST=...

# Docker
image: mysql:8
image: mariadb:11
```

### SQLite

**Indicators:**
```bash
# File existence
*.db, *.sqlite, *.sqlite3

# Dependencies
better-sqlite3, sqlite3 (Node)
sqlite3 (Python - stdlib)
Microsoft.Data.Sqlite (C#)
```

---

## ORM Detection

| ORM | Stack | Detection |
|-----|-------|-----------|
| Drizzle | Node | drizzle.config.ts, drizzle-kit |
| Prisma | Node | prisma/schema.prisma |
| TypeORM | Node | ormconfig.json, typeorm |
| Sequelize | Node | .sequelizerc, sequelize |
| EF Core | .NET | Microsoft.EntityFrameworkCore |
| SQLAlchemy | Python | sqlalchemy in requirements |
| Django ORM | Python | DATABASES in settings.py |

---

## Structure Detection

### Monolith (Prototype/Platform Export)

**Indicators:** Flat structure with client/ + server/ folders, single root package.json.
**Common in:** Replit exports, StackBlitz projects, CodeSandbox downloads, early-stage prototypes.

```
project/
├── client/           # Frontend
├── server/           # Backend
├── shared/           # Shared types
├── package.json      # Root package
└── [.replit]         # Optional platform config
```

### Clean Architecture

```
project/
├── src/
│   ├── frontend/
│   └── Backend.Api/
│       ├── Controllers/
│       ├── Backend.Domain/
│       ├── Backend.Services/
│       └── Backend.Repositories/
```

### Monorepo (pnpm/Turborepo)

```
project/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── ui/
│   └── shared/
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Detection Algorithm

```python
def detect_stack(project_path):
    stack = {
        "frontend": None,
        "backend": None,
        "database": None,
        "orm": None,
        "structure": None
    }

    # 1. Check for explicit config files
    if exists("package.json"):
        deps = read_json("package.json")["dependencies"]

        # Frontend
        if "react" in deps:
            stack["frontend"] = {"framework": "react", "version": deps["react"]}
        elif "vue" in deps:
            stack["frontend"] = {"framework": "vue", "version": deps["vue"]}

        # Backend (Node)
        if "express" in deps:
            stack["backend"] = {"framework": "express", "runtime": "node"}

    if glob("*.csproj"):
        stack["backend"] = {"framework": "aspnetcore", "runtime": "dotnet"}

    if exists("requirements.txt") or exists("pyproject.toml"):
        deps = read_python_deps()
        if "fastapi" in deps:
            stack["backend"] = {"framework": "fastapi", "runtime": "python"}

    # 2. Database from docker-compose or env
    if exists("docker-compose.yml"):
        services = read_yaml("docker-compose.yml")["services"]
        for name, config in services.items():
            if "postgres" in config.get("image", ""):
                stack["database"] = {"type": "postgres"}

    # 3. ORM detection
    if exists("drizzle.config.ts"):
        stack["orm"] = "drizzle"
    elif exists("prisma/schema.prisma"):
        stack["orm"] = "prisma"

    # 4. Structure detection
    if exists(".replit") or exists(".stackblitzrc") or exists("sandbox.config.json") or exists("glitch.json"):
        stack["structure"] = "monolith-prototype"
        # Detect platform origin
        if exists(".replit"): stack["origin"] = "replit"
        elif exists(".stackblitzrc"): stack["origin"] = "stackblitz"
        elif exists("sandbox.config.json"): stack["origin"] = "codesandbox"
        elif exists("glitch.json"): stack["origin"] = "glitch"
    elif exists("client/") and exists("server/"):
        stack["structure"] = "monolith-prototype"
        stack["origin"] = "custom"
    elif exists("pnpm-workspace.yaml"):
        stack["structure"] = "monorepo"
    elif glob("src/*/*.csproj"):
        stack["structure"] = "clean-architecture"

    return stack
```

---

## Output Format

```yaml
Stack Detection Result:
  frontend:
    framework: react
    version: 19.0.0
    buildTool: vite
    uiLibrary: shadcn/ui
    stateManagement: react-query
    router: wouter

  backend:
    current:
      framework: express
      runtime: node
      version: 22.x
    target:
      framework: aspnetcore
      runtime: dotnet
      version: 10.0

  database:
    type: postgres
    version: 17
    orm:
      current: drizzle
      target: efcore

  structure:
    current: monolith-prototype
    origin: replit | stackblitz | codesandbox | glitch | custom
    target: clean-architecture

  devtools:
    packageManager: npm
    typescript: true
    docker: false
    cicd: none
```

---

**Version:** 2.0.0
**Last Updated:** 2026-02-07
