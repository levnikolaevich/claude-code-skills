# Research Query Templates

<!-- SCOPE: Pre-built query templates for researching optimization solutions per bottleneck type. -->
<!-- DO NOT add here: research workflow -> ln-812 SKILL.md; tool priority -> references/research_tool_fallback.md -->

Query templates organized by bottleneck type. Use with research_tool_fallback.md priority chain.

---

## Competitive Analysis Queries

| Goal | Query Template | Tool |
|------|---------------|------|
| Industry benchmark | `"{domain} API response time benchmark {year}"` | WebSearch |
| Competitor performance | `"{competitor_type} {operation} latency"` | WebSearch |
| Standard expectations | `"acceptable response time for {operation_type}"` | WebSearch |
| SLA norms | `"{domain} API SLA p99 latency"` | WebSearch |

**Variables:** `{domain}` = business domain (translation, payment, search), `{operation}` = what the endpoint does, `{year}` = current year.

---

## Target Metric Queries

Research quantitative targets per metric from `performance_map.baseline`. Use alongside Competitive Analysis to establish what "good" looks like for each measured dimension.

| Metric | Query Template | Tool |
|--------|---------------|------|
| CPU time | `"{framework} handler CPU time benchmark"` | WebSearch |
| Memory | `"{domain} API memory usage benchmark {year}"` | WebSearch |
| HTTP round-trips | `"{domain} API call count optimization best practice"` | WebSearch |
| I/O throughput | `"{domain} {operation} throughput benchmark"` | WebSearch |
| GPU utilization | `"{framework} GPU inference latency benchmark"` | WebSearch |

**Variables:** same as Competitive Analysis + `{framework}` from stack detection.

---

## Solution Research by Bottleneck Type

### Architecture (N+1, Sequential, Missing Cache/Batch)

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{framework} batch API requests pattern"` | Context7 / Ref | Framework-specific batching |
| `"{language} asyncio.gather parallel requests"` | Context7 | Parallelization |
| `"{library_name} batch method"` | Context7 / Ref | Check if client supports batching |
| `"N+1 HTTP request optimization {language}"` | WebSearch | General patterns |
| `"cache prefetch pattern {language}"` | WebSearch | Caching strategies |
| `"{framework} DataLoader pattern"` | Context7 / Ref | Batch + cache (GraphQL-inspired) |

### I/O-Network

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{library} connection pooling configuration"` | Context7 / Ref | Pool settings |
| `"{library} HTTP/2 multiplexing"` | Context7 / Ref | Protocol optimization |
| `"{framework} request caching middleware"` | Context7 / Ref | Cache layer |
| `"reduce HTTP round trips {language}"` | WebSearch | General strategies |
| `"{library} retry with backoff"` | Context7 / Ref | Resilience patterns |
| `"{library} timeout configuration"` | Context7 / Ref | Prevent hanging |

### I/O-DB

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{ORM} eager loading include"` | Context7 / Ref | N+1 prevention |
| `"{ORM} bulk insert batch"` | Context7 / Ref | Batch writes |
| `"{ORM} select specific fields projection"` | Context7 / Ref | Over-fetch prevention |
| `"{database} query optimization index"` | Ref | Indexing strategies |
| `"database query caching {framework}"` | WebSearch | Query-level cache |
| `"{ORM} raw SQL performance"` | Context7 | When ORM abstraction is bottleneck |

### I/O-File

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{language} async file I/O"` | Context7 / Ref | Non-blocking file ops |
| `"{language} streaming file processing"` | Context7 | Avoid loading full file to memory |
| `"{language} memory mapped file mmap"` | WebSearch | Large file access |
| `"file processing pipeline {language}"` | WebSearch | Stream/pipeline patterns |

### CPU-Bound

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{algorithm_name} faster alternative"` | WebSearch | Better algorithm |
| `"{language} {operation} performance optimization"` | Context7 / Ref | Language-specific tricks |
| `"{language} vectorized operations numpy"` | Context7 | SIMD/vectorization |
| `"cache computation result {language}"` | WebSearch | Memoization |
| `"{language} C extension native performance"` | WebSearch | FFI for hot paths |
| `"open source {functionality} library {language}"` | WebSearch | OSS replacement for custom code |

### Cache

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"{framework} cache invalidation strategy"` | Context7 / Ref | Invalidation patterns |
| `"{language} LRU cache TTL configuration"` | Context7 | Eviction policies |
| `"cache key design best practices"` | WebSearch | Key structure |
| `"tiered caching L1 L2 pattern {language}"` | WebSearch | Multi-layer cache |
| `"{framework} cache warming preload"` | Context7 / Ref | Warm-up strategies |
| `"cache stampede thundering herd prevention"` | WebSearch | Concurrency patterns |

### External Service

| Query Template | Tool | Focus |
|---------------|------|-------|
| `"cache external API response pattern"` | WebSearch | Caching layer |
| `"circuit breaker pattern {framework}"` | Context7 / Ref | Resilience |
| `"{service_name} batch API"` | Ref | Check for batch endpoint |
| `"API response caching Redis {framework}"` | Context7 | Cache infrastructure |
| `"{service_name} alternative faster"` | WebSearch | Provider alternatives |

---

## Local Codebase Check Queries

Before external research, check the local codebase:

| What to Check | How |
|---------------|-----|
| Batch method on client | Grep for `batch`, `bulk`, `multi` in client class |
| Cache infrastructure | Grep for `redis`, `memcache`, `cache`, `@cached` |
| Existing connection pool config | Grep for `pool_size`, `max_connections`, `pool` |
| Async variants of sync calls | Grep for `async_`, `aio`, `Async` prefix/suffix on client methods |
| Unused configuration options | Read client config for batch_size, max_connections parameters |

**Priority:** Always check local codebase FIRST. Unused existing capability is the lowest-risk, highest-impact fix.

---

**Version:** 1.0.0
**Last Updated:** 2026-03-14
