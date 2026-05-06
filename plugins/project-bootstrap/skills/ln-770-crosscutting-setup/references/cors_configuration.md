# CORS Configuration

<!-- SCOPE: CORS configuration patterns ONLY. Contains dev/prod policies, per-stack setup (Express, ASP.NET). -->
<!-- DO NOT add here: Setup workflow → ln-770-crosscutting-setup SKILL.md -->

Cross-Origin Resource Sharing setup for all supported stacks.

---

## Default Policy

```yaml
Development:
  AllowedOrigins:
    - http://localhost:3000
    - http://localhost:5173
    - http://127.0.0.1:3000
  AllowedMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
  AllowedHeaders: [Content-Type, Authorization, X-Correlation-ID]
  AllowCredentials: true
  MaxAge: 86400

Production:
  AllowedOrigins: ${CORS_ORIGINS}  # Comma-separated list
  AllowedMethods: [GET, POST, PUT, PATCH, DELETE]
  AllowedHeaders: [Content-Type, Authorization]
  AllowCredentials: true
  MaxAge: 86400
```

---

## .NET Implementation

### Extensions/CorsExtensions.cs

```csharp
public static class CorsExtensions
{
    public static IServiceCollection AddCorsServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var corsOrigins = configuration.GetValue<string>("Cors:Origins")
            ?? "http://localhost:3000,http://localhost:5173";

        services.AddCors(options =>
        {
            options.AddPolicy("Default", policy =>
            {
                policy
                    .WithOrigins(corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries))
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
                    .SetPreflightMaxAge(TimeSpan.FromSeconds(86400));
            });

            // Strict policy for production
            options.AddPolicy("Production", policy =>
            {
                var prodOrigins = configuration.GetValue<string>("Cors:ProductionOrigins")
                    ?? throw new InvalidOperationException("CORS:ProductionOrigins not configured");

                policy
                    .WithOrigins(prodOrigins.Split(','))
                    .WithMethods("GET", "POST", "PUT", "DELETE")
                    .WithHeaders("Content-Type", "Authorization")
                    .AllowCredentials();
            });
        });

        return services;
    }
}
```

### Program.cs

```csharp
builder.Services.AddCorsServices(builder.Configuration);

var app = builder.Build();

app.UseCors("Default");
```

### appsettings.json

```json
{
  "Cors": {
    "Origins": "http://localhost:3000,http://localhost:5173",
    "ProductionOrigins": "https://app.example.com"
  }
}
```

---

## Node.js (Express) Implementation

### src/config/cors.ts

```typescript
import cors, { CorsOptions } from 'cors';

const devOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

const prodOrigins = process.env.CORS_ORIGINS?.split(',') ?? [];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? prodOrigins
      : devOrigins;

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  maxAge: 86400,
};

export const corsMiddleware = cors(corsOptions);
```

### app.ts

```typescript
import express from 'express';
import { corsMiddleware } from './config/cors';

const app = express();
app.use(corsMiddleware);
```

---

## Python (FastAPI) Implementation

### main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Development origins
dev_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
]

# Production origins from environment
prod_origins = os.getenv("CORS_ORIGINS", "").split(",")

origins = prod_origins if os.getenv("ENV") == "production" else dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Correlation-ID"],
    max_age=86400,
)
```

---

## Common Issues

### Preflight Requests

OPTIONS requests must return 200 with correct headers:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

### Credentials with Wildcards

Cannot use `*` origin with credentials. Must specify exact origins:

```csharp
// WRONG - will fail
policy.AllowAnyOrigin().AllowCredentials();

// CORRECT
policy.WithOrigins("http://localhost:3000").AllowCredentials();
```

### Missing Headers

If custom headers aren't listed in `AllowedHeaders`, requests will fail:

```javascript
// Client sends X-Custom-Header
fetch('/api/data', {
  headers: { 'X-Custom-Header': 'value' }
});

// Server must allow it
.WithHeaders("Content-Type", "Authorization", "X-Custom-Header")
```

---

## Environment Variables

```bash
# .env.example
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
