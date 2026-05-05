# hex-relay

Telegram and HTTP control plane for per-project agent god-sessions.

`hex-relay` is the product extracted from `ln-030-vps-bootstrap`. The `ln-030` coordinator routes deployment and maintenance to the `ln-033-hex-relay-lifecycle` worker, while this directory owns the TypeScript runtime, product documentation, build, and checks.

## What It Does

`hex-relay` lets an operator control a long-running Claude Code session from Telegram without giving the model direct access to Telegram tokens, provider tokens, host systemd, or sibling projects.

- Accepts Telegram text, captions, photos, image documents, and general documents.
- Delivers accepted operator messages into the correct per-user tmux god-session.
- Mirrors final Claude replies back to Telegram through Claude Code hooks.
- Exposes `/new_session`, `/sessions`, `/tasks`, `/users`, and `/usage` bot commands.
- Polls provider issues through control-plane credentials and lets an allowed user take one task into their current session.
- Stores dispatch runs, memories, session events, health snapshots, allowed users, and outbound messages in SQLite.
- Keeps outbound Telegram delivery durable through an outbox worker with retry/backoff.

## Relationship To `ln-030`

`ln-030-vps-bootstrap` is the public VPS entrypoint. It decides whether the host, project runtime, relay lifecycle, or diagnostics worker should run. `ln-033-hex-relay-lifecycle` owns this product's deploy, redeploy, migration, health, Telegram command, and user-management flow: upload source to `/opt/${SERVICE_PREFIX}-hex-relay`, build it on the VPS, install `${SERVICE_PREFIX}-hex-relay.service`, and wire project-scope Claude hooks.

This directory is the product source. Product changes should be made here, validated with the npm scripts below, and redeployed with `docs/redeploy.md`.

## Architecture

Hexagonal / Clean layering. Dependencies point inward toward pure domain types; I/O stays in handlers and infrastructure.

| Path                     | Responsibility                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `src/domain/`            | Pure types and invariants. No I/O.                                                    |
| `src/infrastructure/`    | SQLite, Telegram, tmux, filesystem, systemd, and JSONL drivers.                       |
| `src/services/`          | Orchestration on top of repositories and drivers.                                     |
| `src/handlers/telegram/` | grammY command, callback, allowlist, and inbound handlers.                            |
| `src/handlers/http/`     | Fastify routes for Claude hooks and local API endpoints.                              |
| `src/workers/`           | Inbound delivery, outbox, error alerting, and media cleanup loops.                    |
| `src/lib/`               | Logger, retry/backoff, token bucket, Telegram splitting, mutex, and shutdown helpers. |
| `src/app.ts`             | Composition root. Builds the dependency graph and returns `{ start, stop }`.          |

## Environment

Environment is loaded from `process.env` and validated by `src/config/env.ts`.

Required:

| Variable             | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather.                                               |
| `TELEGRAM_CHAT_ID`   | Primary operator chat ID.                                               |
| `PROJECT_NAME`       | State namespace; relay DB lives at `/var/lib/${PROJECT_NAME}/relay.db`. |
| `PROJECT_DIR`        | Project checkout where god-sessions run.                                |
| `SERVICE_PREFIX`     | systemd/tmux/API namespace for one project.                             |
| `BOT_USER`           | Linux user that owns the project agent workload.                        |
| `RELAY_HOOK_PORT`    | Local Fastify listener port on `127.0.0.1`.                             |

Optional:

| Variable                                                                 | Purpose                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `RELAY_VERBOSITY`                                                        | `quiet`, `normal`, or `verbose`; defaults to `normal`.               |
| `RELAY_INBOUND_REACTIONS`                                                | Comma-separated Telegram reaction pool for inbound acknowledgements. |
| `RELAY_VOICE_TRANSCRIPTION`                                              | `off` or `local`; local uses `ffmpeg` plus `whisper.cpp`.            |
| `FFMPEG_BIN`                                                             | `ffmpeg` executable path/name for voice normalization.               |
| `WHISPER_CPP_BIN`                                                        | `whisper-cli` executable path for local voice transcription.         |
| `WHISPER_CPP_MODEL`                                                      | Local multilingual Whisper model file; CPU default is `small-q5_1`.  |
| `RELAY_VOICE_MAX_DURATION_SEC`                                           | Max Telegram voice duration; defaults to `90`.                       |
| `RELAY_VOICE_TRANSCRIBE_TIMEOUT_SEC`                                     | Local ASR timeout; defaults to `120`.                                |
| `GIT_PROVIDER`                                                           | `github` or `gitlab`; defaults to `github`.                          |
| `REPO_SLUG`                                                              | Repository slug used by task polling.                                |
| `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH` | GitHub App credentials for task polling and git operations.          |
| `GITLAB_HOST`, `GITLAB_API_TOKEN`                                        | GitLab API settings for task polling.                                |

Use `.env.example` for local development shape. Production installs source `/etc/${PROJECT_NAME}/secrets.env` through systemd and set identity variables in the unit file.

## Build And Run

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

Run the compiled service:

```bash
node dist/index.js
```

For development:

```bash
npm run dev
```

## Runtime Behavior

- Telegram ingress accepts plain text, media captions, photos, image documents, general documents, and locally transcribed voice messages when enabled. Unsupported media without usable text is recorded as rejected and receives an explanatory reply.
- Voice messages are speech-to-text only: `ffmpeg` normalizes Telegram OGG/OPUS to mono WAV and `whisper.cpp` returns plain text. The god-session receives only the transcript, without voice metadata.
- Accepted inbound messages are persisted to SQLite before delivery into tmux.
- A serialized control lane coordinates `/new_session`, resume/delete actions, and inbound delivery so operator messages are not lost during tmux restarts.
- Outbound Telegram messages are written to a durable outbox and drained with retry/backoff.
- Claude Code hooks post local HTTP events into the same SQLite-backed state store.
- SessionStart context injection exposes recent memories and dispatch history to each new god-session.

## HTTP Surface

Fastify listens on `127.0.0.1:${RELAY_HOOK_PORT}`.

| Route family  | Purpose                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `/hooks/*`    | Claude Code hook ingestion for prompt, session, tool, compact, stop, and subagent events. |
| `/tasks/*`    | Task polling and Telegram handoff for provider issues.                                    |
| `/dispatch/*` | Dispatch run state and history.                                                           |
| `/memory/*`   | Persistent operator memory API.                                                           |
| `/health`     | Health snapshots for service and god-session visibility.                                  |

Stable internal API routes use Fastify/Zod route schemas. Claude hook routes intentionally keep compatibility parsing and return `200 {}` for ignored malformed hook payloads. See `src/handlers/http/` for exact schemas.

## Database Lifecycle

`src/infrastructure/db/schema.ts` defines the SQLite schema. `migrations.ts` runs idempotent forward migrations, so `/var/lib/${PROJECT_NAME}/relay.db` boots cleanly with existing data intact.

## Locking

`src/infrastructure/filesystem/atomicCommand.ts` uses POSIX `flock(2)` via `fs-ext`. This must stay compatible with the bash `flock` calls in `god-session.sh`. Do not replace it with sentinel-directory locking such as `proper-lockfile`; that would not share kernel locks and would break atomicity for `god-command.json`.

## Deployment

`ln-030-vps-bootstrap` installs `hex-relay` to `/opt/${SERVICE_PREFIX}-hex-relay` and supervises it with `${SERVICE_PREFIX}-hex-relay.service`. Only one instance can run per project because it owns the project hook port and SQLite database.

Product runbooks live in `docs/`. Installer templates and VPS-specific wiring remain in `skills-catalog/ln-030-vps-bootstrap/references/`.
