# API Specification: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}
**OpenAPI Version:** 3.0.3

<!-- DOC_KIND: reference -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need endpoint contracts, auth rules, or request/response shapes. -->
<!-- SKIP_WHEN: Skip when you only need architecture rationale or deployment procedures. -->
<!-- PRIMARY_SOURCES: src/, openapi.*, package.json, docs/project/architecture.md -->

<!-- SCOPE: API endpoints (methods, paths, parameters, responses), authentication mechanisms (JWT, OAuth2, API keys), error codes (HTTP status + custom codes), rate limiting, API versioning ONLY. -->
<!-- DO NOT add here: Database schema → database_schema.md, Tech stack versions → tech_stack.md, Architecture patterns → architecture.md, Requirements → requirements.md, Deployment → runbook.md, Infrastructure inventory → infrastructure.md, Design system → design_guidelines.md -->

<!-- NO_CODE_EXAMPLES: API spec documents CONTRACTS (endpoints, schemas), not implementations.
     ALLOWED: JSON request/response schemas (this IS the API contract), endpoint tables, error code tables
     FORBIDDEN: Controller implementations, validation classes, service code, middleware examples
     For implementation patterns → docs/reference/guides/ -->

## Quick Navigation

- [Docs Hub](../README.md)
- [Architecture](architecture.md)
- [Database Schema](database_schema.md)
- [Runbook](runbook.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Captures API contracts, auth requirements, responses, and error conventions. |
| Read When | You need exact endpoint behavior or integration-facing details. |
| Skip When | You only need database structure or operations guidance. |
| Canonical | Yes |
| Next Docs | [Architecture](architecture.md), [Database Schema](database_schema.md), [Runbook](runbook.md) |
| Primary Sources | `src/`, `openapi.*`, `package.json`, `docs/project/architecture.md` |

---

## 1. API Overview

### 1.1 Base URL
{{BASE_URL}}
<!-- Example: Development: http://localhost:3000/api/v1, Production: https://api.example.com/v1 -->

### 1.2 API Design Principles
{{API_DESIGN_PRINCIPLES}}
<!-- Example: RESTful design, Stateless communication, JSON request/response format, HATEOAS links for discoverability, Consistent error handling -->

### 1.3 API Versioning
{{API_VERSIONING}}
<!-- Example: URI versioning (/api/v1/, /api/v2/), Unsupported API policy (6 months notice), Backward compatibility for minor updates -->

---

## 2. Authentication & Authorization

### 2.1 Authentication Methods

**Supported Methods:**
{{AUTH_METHODS}}
<!-- Example: JWT Bearer tokens (primary), OAuth2 (Google, GitHub), API Keys (for service-to-service) -->

**JWT Token Format:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "role": "admin",
    "exp": 1234567890
  }
}
```

**Token Expiration:**
{{TOKEN_EXPIRATION}}
<!-- Example: Access token: 1 hour, Refresh token: 30 days -->

### 2.2 Authorization (RBAC)

**Roles:**
{{RBAC_ROLES}}
<!-- Example:
| Role | Permissions | Description |
|------|-------------|-------------|
| Admin | Full access | System administration |
| Editor | Read, Create, Update | Content management |
| Viewer | Read only | View-only access |
-->

---

## 3. API Endpoints

### 3.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login (email/password) | No |
| POST | `/auth/refresh` | Refresh access token | Yes (Refresh token) |
| POST | `/auth/logout` | Logout (invalidate tokens) | Yes |
| GET | `/auth/me` | Get current user info | Yes |

**Example: POST /auth/login**

Request:
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

Response (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "editor"
  }
}
```

---

### 3.2 User Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/users` | List all users (paginated) | Yes | Admin |
| GET | `/users/:id` | Get user by ID | Yes | Admin, self |
| PUT | `/users/:id` | Update user | Yes | Admin, self |
| DELETE | `/users/:id` | Delete user | Yes | Admin |
| PATCH | `/users/:id/password` | Change password | Yes | Admin, self |

**Example: GET /users?page=1&limit=20**

Response (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "editor",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### 3.3 {{RESOURCE_1}} Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/{{resource}}` | List {{resource}} | Yes |
| GET | `/{{resource}}/:id` | Get {{resource}} by ID | Yes |
| POST | `/{{resource}}` | Create {{resource}} | Yes |
| PUT | `/{{resource}}/:id` | Update {{resource}} | Yes |
| DELETE | `/{{resource}}/:id` | Delete {{resource}} | Yes |

<!-- Example: Products
| GET | `/products` | List products | Yes |
| GET | `/products/:id` | Get product by ID | Yes |
| POST | `/products` | Create product | Yes (Editor+) |
| PUT | `/products/:id` | Update product | Yes (Editor+) |
| DELETE | `/products/:id` | Delete product | Yes (Admin) |
-->

---

### 3.4 {{RESOURCE_2}} Endpoints

{{RESOURCE_2_ENDPOINTS}}
<!-- Repeat structure from 3.3 for additional resources: Orders, Categories, etc. -->

---

## 4. Request & Response Formats

### 4.1 Common Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | Page number (1-based) | `?page=2` |
| `limit` | integer | Items per page (max 100) | `?limit=50` |
| `sort` | string | Sort field (+asc, -desc) | `?sort=-createdAt` |
| `filter` | string | Filter expression | `?filter=status:active` |
| `search` | string | Search query | `?search=keyword` |

### 4.2 Standard Response Structure

**Success Response:**
```json
{
  "data": { /* resource data */ },
  "meta": { /* metadata, pagination */ }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ /* validation errors, if applicable */ ]
  }
}
```

---

## 5. Error Codes

### 5.1 HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request format, validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource (email already exists) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### 5.2 Custom Error Codes

| Code | HTTP Status | Description | Example |
|------|-------------|-------------|---------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email/password | Login failed |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT token expired | Token needs refresh |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role | Admin-only action |
| `VALIDATION_FAILED` | 422 | Input validation failed | Missing required field |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found | User ID not found |
| `RESOURCE_CONFLICT` | 409 | Resource already exists | Email already registered |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | 100 req/min limit hit |

**Example Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed for request body",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

---

## 6. Rate Limiting

**Limits:**
{{RATE_LIMITS}}
<!-- Example:
| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Read (GET) | 100 requests | 1 minute |
| Write (POST/PUT/DELETE) | 30 requests | 1 minute |
-->

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1640000000
```

---

## 7. Pagination

**Request:**
```
GET /users?page=2&limit=20
```

**Response:**
```json
{
  "data": [ /* 20 users */ ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  },
  "links": {
    "self": "/users?page=2&limit=20",
    "first": "/users?page=1&limit=20",
    "prev": "/users?page=1&limit=20",
    "next": "/users?page=3&limit=20",
    "last": "/users?page=8&limit=20"
  }
}
```

---

## 8. OpenAPI Specification

**OpenAPI Documentation:**
{{OPENAPI_LINK}}
<!-- Example: Swagger UI available at `/api-docs`, OpenAPI JSON at `/api-docs.json` -->

**Example OpenAPI Snippet (users endpoint):**
```yaml
paths:
  /users:
    get:
      summary: List all users
      tags: [Users]
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
```

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New API endpoints added
- Authentication/authorization changes
- Error code modifications
- Rate limiting adjustments
- API versioning (major/minor releases)

**Verification:**
- [ ] All endpoints documented with methods/paths/params/responses
- [ ] Authentication requirements specified for each endpoint
- [ ] Error codes match implementation
- [ ] OpenAPI specification up to date
- [ ] Rate limits tested and validated

---
