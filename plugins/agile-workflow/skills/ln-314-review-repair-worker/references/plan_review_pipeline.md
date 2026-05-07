# Plan Review Pipeline (mode=plan_review)

Pipeline orchestration for MCP Ref research. Runs in parallel with agent background tasks.
Criteria definitions: `references/phase2_research_audit.md` (criteria #5, #6, #21, #28 + Anti-Hallucination — sections marked "ALL MODES").

## Applicability Check

Scan plan content for technology decision signals. No signals → skip MCP Ref research, proceed to Phase 5.

| Signal Type | Examples |
|-------------|---------|
| Infrastructure choice | Redis, PostgreSQL, K8s, Docker, RabbitMQ |
| API/protocol decision | REST vs GraphQL, WebSocket, gRPC, OAuth 2.0 |
| Security mechanism | JWT, PKCE, CORS, rate limiting, OWASP |
| Library/framework choice | FastAPI, Polly, SQLAlchemy, Pydantic |
| Architectural pattern | CQRS, event sourcing, middleware chain, DI |
| Configuration/tooling | ESLint, Prettier, CI config |

## Stack Detection

Priority order for `query_prefix`:

1. Plan content (technology mentions) → use directly
2. `.hex-skills/environment_state.json` research section → extract stack hints
3. Glob for indicator files:

| Indicator | Stack | Query Prefix |
|-----------|-------|--------------|
| `*.csproj`, `*.sln` | .NET | `"C# ASP.NET Core"` |
| `package.json` + `tsconfig.json` | Node.js | `"TypeScript Node.js"` |
| `requirements.txt`, `pyproject.toml` | Python | `"Python"` |
| `go.mod` | Go | `"Go Golang"` |
| `Cargo.toml` | Rust | `"Rust"` |
| `build.gradle`, `pom.xml` | Java | `"Java"` |

4. Parse plan references for technology mentions (fallback heuristic)

## Research Execution

Apply criteria #5, #6, #21, #28 from `references/phase2_research_audit.md` (see "Auto-fix: plan" column):

1. For each extracted topic, run queries per criterion
2. Anti-Hallucination (Step 4 from phase2_research_audit.md) — verify factual claims in artifact
3. Each finding → CORRECTED / VALIDATED / REVIEW NEEDED

## Compare & Correct Safety Rules

1. **Max 5 corrections** per run
2. **Must cite** specific RFC/standard/doc for each correction
3. **Only correct** when official docs **directly contradict** plan statement (high confidence)
4. Each correction = surgical Edit with inline rationale `"(per {RFC/standard}: ...)"`
5. Ambiguous findings → record as `"REVIEW NEEDED"` (not auto-corrected)
