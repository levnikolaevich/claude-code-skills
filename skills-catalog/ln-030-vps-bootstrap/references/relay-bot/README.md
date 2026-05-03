# claude-relay-bot — Node.js port

TypeScript relay-bot implementation. Same SQLite schema (`/var/lib/${PROJECT_NAME}/relay.db`), same HTTP hook/API endpoints (`http://127.0.0.1:${RELAY_HOOK_PORT}/...`), same atomic god-command protocol on disk.

Only one relay-bot instance can run per project because it binds the project hook port and owns the project SQLite database.

## Architecture

Hexagonal / Clean layering. Strict downward dependencies; no global mutable singletons.

- `domain/` — pure types and invariants. No I/O.
- `infrastructure/` — drivers for SQLite, Telegram (grammY), tmux, filesystem, systemd, JSONL.
- `services/` — orchestration on top of repositories + drivers.
- `handlers/telegram/` — grammY composer modules (one per command/callback).
- `handlers/http/` — Fastify routes (hooks + local API).
- `workers/` — background loops (inbound, outbox, error alerter, media cleanup).
- `lib/` — generic helpers (pino logger, retry/backoff, token bucket, telegram split, mutex, graceful shutdown).
- `app.ts` — composition root. Builds dependency graph, returns `{ start, stop }`.

## Build

```bash
npm ci
npm run build   # -> dist/
```

## Run

```bash
node dist/index.js
```

Environment is loaded from `process.env` (parsed by Zod in `src/config/env.ts`). Use `.env.example` as a template.

## Critical locking note

`infrastructure/filesystem/atomicCommand.ts` uses POSIX `flock(2)` via the `fs-ext` package. This matches the bash `flock` calls in `god-session.sh`. Do **not** substitute `proper-lockfile` (sentinel-directory based) — it does not share kernel `flock(2)` locks and would silently break atomicity of `god-command.json`.

## Schema lifecycle

`infrastructure/db/schema.ts` defines the relay schema. `migrations.ts` runs idempotent forward migrations, so `relay.db` boots cleanly with data intact.
