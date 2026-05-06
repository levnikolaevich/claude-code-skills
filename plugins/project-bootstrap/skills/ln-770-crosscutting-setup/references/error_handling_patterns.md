# Error Handling Patterns

<!-- SCOPE: Global exception handling patterns ONLY. Contains error response format, per-stack middleware/filters. -->
<!-- DO NOT add here: Setup workflow → ln-770-crosscutting-setup SKILL.md, logging → logging_patterns.md -->

Global exception handling for all supported stacks.

---

## Standardized Error Response

All APIs should return errors in this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly error message",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "traceId": "abc-123-def"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## .NET Implementation

### Middleware/GlobalExceptionMiddleware.cs

```csharp
using System.Text.Json;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IWebHostEnvironment _env;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger,
        IWebHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;

        _logger.LogError(exception,
            "Unhandled exception. TraceId: {TraceId}", traceId);

        var (statusCode, errorCode) = exception switch
        {
            ValidationException => (400, "VALIDATION_ERROR"),
            UnauthorizedAccessException => (401, "UNAUTHORIZED"),
            KeyNotFoundException => (404, "NOT_FOUND"),
            InvalidOperationException => (409, "CONFLICT"),
            _ => (500, "INTERNAL_ERROR")
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new
        {
            error = new
            {
                code = errorCode,
                message = _env.IsDevelopment()
                    ? exception.Message
                    : GetUserFriendlyMessage(errorCode),
                traceId = traceId
            }
        };

        await context.Response.WriteAsJsonAsync(response);
    }

    private static string GetUserFriendlyMessage(string code) => code switch
    {
        "VALIDATION_ERROR" => "The request contains invalid data.",
        "UNAUTHORIZED" => "Authentication is required.",
        "NOT_FOUND" => "The requested resource was not found.",
        "CONFLICT" => "The request conflicts with current state.",
        _ => "An unexpected error occurred."
    };
}
```

### Custom Exceptions

```csharp
public class ValidationException : Exception
{
    public IEnumerable<ValidationError> Errors { get; }

    public ValidationException(IEnumerable<ValidationError> errors)
        : base("Validation failed")
    {
        Errors = errors;
    }
}

public record ValidationError(string Field, string Message);
```

---

## Node.js (Express) Implementation

### src/middleware/errorHandler.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details: { field: string; message: string }[] = []
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const traceId = req.headers['x-correlation-id'] as string ?? crypto.randomUUID();

  logger.error({
    err,
    traceId,
    path: req.path,
    method: req.method,
  }, 'Unhandled error');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err instanceof ValidationError ? err.details : undefined,
        traceId,
      },
    });
  }

  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred.',
      traceId,
    },
  });
}
```

### Usage

```typescript
app.use(errorHandler);

// In routes
throw new NotFoundError('Epic');
throw new ValidationError('Invalid data', [
  { field: 'email', message: 'Invalid format' }
]);
```

---

## Python (FastAPI) Implementation

### src/core/exceptions.py

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid

class ErrorDetail(BaseModel):
    field: str
    message: str

class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[List[ErrorDetail]] = None
    traceId: str

class AppException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: str = "INTERNAL_ERROR",
        details: List[ErrorDetail] = None
    ):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details

class ValidationError(AppException):
    def __init__(self, message: str, details: List[ErrorDetail] = None):
        super().__init__(message, 400, "VALIDATION_ERROR", details)

class NotFoundError(AppException):
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", 404, "NOT_FOUND")

async def app_exception_handler(request: Request, exc: AppException):
    trace_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": [d.dict() for d in exc.details] if exc.details else None,
                "traceId": trace_id
            }
        }
    )
```

### main.py

```python
from fastapi import FastAPI
from .core.exceptions import AppException, app_exception_handler

app = FastAPI()
app.add_exception_handler(AppException, app_exception_handler)
```

---

## React Error Boundary

### src/components/ErrorBoundary.tsx

```tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-lg font-semibold text-red-800">
            Something went wrong
          </h2>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-red-600 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10
