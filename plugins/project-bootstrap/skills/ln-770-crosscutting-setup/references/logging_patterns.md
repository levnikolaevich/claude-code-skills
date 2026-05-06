# Logging Patterns

<!-- SCOPE: Structured logging patterns ONLY. Contains standardized fields, per-stack configurations (Winston, Serilog). -->
<!-- DO NOT add here: Setup workflow → ln-770-crosscutting-setup SKILL.md, error handling → error_handling_patterns.md -->

Structured logging configuration for all supported stacks.

---

## Standardized Log Fields

All stacks should produce logs with these fields:

```json
{
  "timestamp": "2026-01-10T12:34:56.789Z",
  "level": "Information",
  "message": "Request completed",
  "correlationId": "abc-123-def",
  "userId": "user_42",
  "requestPath": "/api/epics",
  "method": "GET",
  "statusCode": 200,
  "responseTime": 45,
  "exception": null
}
```

---

## .NET (Serilog)

### Installation

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Enrichers.CorrelationId
```

### appsettings.json

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "formatter": "Serilog.Formatting.Json.JsonFormatter, Serilog"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithCorrelationId"]
  }
}
```

### Program.cs

```csharp
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration));

var app = builder.Build();

app.UseSerilogRequestLogging(options =>
{
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers.UserAgent.ToString());
    };
});
```

### LoggingExtensions.cs

```csharp
public static class LoggingExtensions
{
    public static IServiceCollection AddLoggingServices(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        return services;
    }
}
```

---

## Node.js (Pino)

### Installation

```bash
npm install pino pino-http pino-pretty
```

### src/lib/logger.ts

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

### src/middleware/requestLogger.ts

```typescript
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: req.headers['x-correlation-id'] ?? crypto.randomUUID(),
  }),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
```

### Usage in Express

```typescript
import express from 'express';
import { requestLogger } from './middleware/requestLogger';

const app = express();
app.use(requestLogger);
```

---

## Python (structlog)

### Installation

```bash
pip install structlog
```

### src/core/logging.py

```python
import structlog
import logging

def configure_logging(log_level: str = "INFO"):
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level),
    )

def get_logger(name: str):
    return structlog.get_logger(name)
```

### FastAPI Middleware

```python
from fastapi import Request
import time
import uuid
from .logging import get_logger

logger = get_logger(__name__)

async def logging_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    start_time = time.time()

    response = await call_next(request)

    duration = (time.time() - start_time) * 1000

    logger.info(
        "request_completed",
        correlation_id=correlation_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration, 2)
    )

    return response
```

---

## Log Levels by Environment

| Environment | Default Level | Microsoft/Framework |
|-------------|---------------|---------------------|
| Development | Debug | Information |
| Staging | Information | Warning |
| Production | Information | Warning |

---

## Correlation ID Flow

```
Request → [Generate/Extract ID] → [Add to Context] → [Pass to Services] → [Include in Logs]
    ↓
Response Header: X-Correlation-ID
```

### Middleware Pattern

1. Check incoming `X-Correlation-ID` header
2. If missing, generate new UUID
3. Store in request context
4. Add to all log entries
5. Return in response header

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
