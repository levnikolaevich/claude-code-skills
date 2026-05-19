# hex-ssh-mcp

Token-efficient SSH MCP server with hash-verified remote file editing and persistent tmux sessions.

[![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-ssh-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp)
[![downloads](https://img.shields.io/npm/dm/@levnikolaevich/hex-ssh-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp)
[![license](https://img.shields.io/npm/l/@levnikolaevich/hex-ssh-mcp)](./LICENSE)
![node](https://img.shields.io/node/v/@levnikolaevich/hex-ssh-mcp)

Every remote file read returns FNV-1a hash-annotated lines and range checksums. Edits verify those checksums before applying changes -- preventing stale-context corruption across SSH boundaries. Command output is normalized and deduplicated for minimal token usage. Persistent session tools keep remote cwd/env in tmux and expose paginated stdout/stderr reads for large logs. The MCP server itself runs on Windows, macOS, and Linux.

## Features

### 14 MCP Tools

| Tool | Description | Key Feature |
|------|-------------|-------------|
| `remote-ssh` | Execute shell commands on remote servers | Disabled by default; normalized output when enabled |
| `ssh-read-lines` | Read remote file with hash-annotated lines | Partial reads via `startLine`/`endLine`/`maxLines` |
| `ssh-edit-block` | Hash-verified anchor edits in remote files | Checksum verification + compact diff output |
| `ssh-search-code` | Search remote files with grep | Deduplicated results with `(xN)` counts |
| `ssh-write-chunk` | Write or append to remote files | Rewrite is atomic; append is direct |
| `ssh-upload` | Upload a local file to a remote server via SFTP | Binary-safe transfer + durable remote finalize |
| `ssh-download` | Download a remote file to the local machine via SFTP | Binary-safe transfer + verified local finalize |
| `ssh-verify` | Check if held checksums are still valid | Single-line response avoids full re-read |
| `ssh-capabilities` | Inspect remote POSIX session support | Reports tmux, package managers, and shell tools |
| `ssh-session-open` | Open a trusted persistent tmux session | Preserves cwd/env between commands |
| `ssh-session-exec` | Run a command inside a persistent session | Returns metadata first, not large output |
| `ssh-session-read` | Read session stdout/stderr windows | Paginated output with `offset`/`limit` |
| `ssh-session-close` | Close a trusted tmux session | Validates hex-ssh metadata before cleanup |
| `ssh-session-gc` | Remove expired trusted sessions | Touches only valid hex-ssh metadata |

### Output Normalization

Built into `remote-ssh` and `ssh-search-code`. Pipeline:

1. **Normalize** -- replaces UUIDs, timestamps, IPs, hex IDs, large numbers with placeholders
2. **Deduplicate** -- collapses identical normalized lines with `(xN)` counts
3. **Truncate** -- keeps first 40 + last 20 lines, omits the middle

## Install

```bash
npm i -g @levnikolaevich/hex-ssh-mcp
claude mcp add -s user hex-ssh -e ALLOWED_HOSTS=server1,server2 -- hex-ssh-mcp
```

Requires Node.js >= 20.19.0.

## Supported Remote Targets

- Host runtime: Windows, macOS, and Linux.
- Remote shell tools (`remote-ssh`, `ssh-read-lines`, `ssh-edit-block`, `ssh-search-code`, `ssh-write-chunk`, `ssh-verify`) expect a POSIX-style shell environment with standard coreutils (`grep`, `sed`, `wc`, `base64`).
- SFTP transfer tools (`ssh-upload`, `ssh-download`) support platform-aware remote paths via `remotePlatform=auto|posix|windows`.


## SSH Config Support

hex-ssh automatically reads `~/.ssh/config` to resolve host aliases, usernames, ports, and identity files. Just use your SSH alias:

```
host: "contabo"  // resolves HostName, User, Port, IdentityFile from config
```

### Resolution Priority

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | Explicit tool args | `user: "admin"` overrides config |
| 2 | `~/.ssh/config` | `Host contabo` block |
| 3 | ENV vars | `SSH_PRIVATE_KEY` |
| 4 (lowest) | Defaults | port 22, `~/.ssh/id_*` |

### Connection Reuse

Connections are pooled and reused across tool calls to the same host with the same auth identity. Idle connections close after 60 seconds. Max 10 pooled connections.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SSH_CONFIG_PATH` | Override `~/.ssh/config` path |
| `ALLOWED_HOSTS` | Comma-separated resolved hostnames/IPs (not aliases) |
| `ALLOWED_LOCAL_DIRS` | Optional comma-separated local directory prefixes allowed for `ssh-upload`/`ssh-download` |
| `MAX_TRANSFER_BYTES` | Optional max file size for SFTP transfers. Default: `134217728` (128 MiB) |
| `TRANSFER_TIMEOUT_MS` | Optional transfer inactivity timeout for SFTP upload/download. Default: `120000` |

### Unsupported Directives (v1)

`ProxyJump` and `ProxyCommand` return an explicit `UNSUPPORTED_SSH_CONFIG` error. ssh2 does not support native proxy tunneling.

### Multi-Key Auth

When SSH config provides multiple `IdentityFile` entries, hex-ssh tries each key in order (like OpenSSH). If the server rejects a key, the next one is attempted automatically.
## Security

### Host Key Verification

SSH host keys are verified against known fingerprints (fail-closed). Sources checked in order:

1. `ALLOWED_HOST_FINGERPRINTS` env -- comma-separated `SHA256:<base64>` values
2. `~/.ssh/known_hosts` -- parsed, fingerprints computed from stored keys

If neither source has a match, the connection is **rejected**. Override known_hosts path with `KNOWN_HOSTS_PATH` env. Plain hostnames, hashed hostnames, and marker-prefixed `known_hosts` entries are parsed for fingerprint matching.

### Shell Escaping

All user-supplied arguments (file paths, patterns, commands) are single-quote escaped before shell interpolation. Null bytes and newlines in arguments are rejected (`UNSAFE_ARG` error).

### Command Policy (remote-ssh)

`remote-ssh` is disabled by default. Modes:

| Mode | Behavior |
|------|----------|
| `disabled` (default) | Reject all `remote-ssh` calls |
| `safe` | Allow commands except blocked dangerous patterns |
| `open` | Allow all commands |

Dangerous patterns are blocked in `safe` mode:

| Pattern | Reason |
|---------|--------|
| `rm -rf /` | Root/home deletion |
| `mkfs` | Filesystem format |
| `dd if=/dev/zero` | Direct disk write |
| Fork bombs | Process exhaustion |
| `> /dev/sd*` | Direct device write |
| `chmod 777` | Removes access restrictions |

Set `REMOTE_SSH_MODE=safe` or `REMOTE_SSH_MODE=open` explicitly to enable the tool.

### Path Canonicalization

Remote paths must be absolute for their platform. POSIX paths use `/...`; Windows remote paths use drive-qualified forms such as `C:\repo\file.txt` and should set `remotePlatform: "windows"` when auto-detection would be ambiguous. `.` and `..` segments are resolved before validation. Both file paths and `ALLOWED_DIRS` entries are canonicalized symmetrically.

Local transfer paths for `ssh-upload` and `ssh-download` must be absolute paths or `~/...`. When `ALLOWED_LOCAL_DIRS` is set, local paths are canonicalized and checked against that allowlist before the transfer starts.

### Per-call Timeouts

Timeout fields are scoped to the operation type. Missing or invalid values fall back to the default.

| Field | Default | Applies to | Notes |
|---|---|---|---|
| `connectTimeoutMs` | `20000` | all tools, connection handshake (new connection only) | Different values create separate pooled connections (max 10 per host). Changes ignored for cached connections. |
| `keepaliveIntervalMs` | `30000` | all tools, SSH keepalive on new connection | Same pool-key behavior as `connectTimeoutMs`. |
| `execTimeoutMs` | `120000` | `remote-ssh`, `ssh-read-lines`, `ssh-edit-block`, `ssh-search-code`, `ssh-write-chunk`, `ssh-verify` | Per-command timeout. On expiry: `EXEC_TIMEOUT` error. |
| `transferTimeoutMs` | `120000` (env `TRANSFER_TIMEOUT_MS` overrides default) | `ssh-upload`, `ssh-download` | SFTP inactivity timeout. Resets on each data chunk. On expiry: `TRANSFER_TIMEOUT` error. |

Priority for `transferTimeoutMs`: per-call arg > `TRANSFER_TIMEOUT_MS` env var > built-in default. The other timeout fields have no env override; pass the arg to change them.

### Atomic File Writes

File content is base64-encoded for transfer (no shell injection via content).

- `rewrite` uses temp file + rename and is atomic
- `append` writes directly with `>>` and is not atomic

### ALLOWED_HOSTS (recommended)

Comma-separated list of permitted hostnames/IPs. When set, connections to unlisted hosts are rejected.

```
ALLOWED_HOSTS=prod-web,prod-db,10.0.0.5
```

When unset, all hosts are permitted.

### ALLOWED_DIRS (optional)

Comma-separated list of permitted remote directory prefixes. When set, file operations outside these paths are rejected.

```
ALLOWED_DIRS=/home/deploy,/var/www,/etc/nginx
```

When unset, all remote paths are permitted.

### ALLOWED_LOCAL_DIRS (optional)

Comma-separated list of permitted local directory prefixes for `ssh-upload` and `ssh-download`. When set, local paths outside these directories are rejected before transfer.

```bash
ALLOWED_LOCAL_DIRS=/Users/alice/projects,/tmp/hex-ssh
```

When unset, any absolute local path is permitted.

### MAX_TRANSFER_BYTES (optional)

Maximum allowed file size for `ssh-upload` and `ssh-download`. Transfers above the limit fail fast with `FILE_TOO_LARGE`.

```bash
MAX_TRANSFER_BYTES=134217728
```

### TRANSFER_TIMEOUT_MS (optional)

Default transfer inactivity window for `ssh-upload` and `ssh-download` when no per-call `transferTimeoutMs` is supplied. If no transfer progress is observed before the timeout expires, the transfer fails with `TRANSFER_TIMEOUT`. Per-call `transferTimeoutMs` always overrides this. See "Per-call Timeouts" above.

```bash
TRANSFER_TIMEOUT_MS=120000
```

### SSH Key Authentication

Key-only authentication (no passwords). Resolution order:

1. `privateKeyPath` tool parameter (explicit per-call)
2. `SSH_PRIVATE_KEY` env var (path or raw key content starting with `-----`)
3. Default paths: `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`, `~/.ssh/id_ecdsa`

Supported key types: RSA, ED25519, ECDSA.

## Tools Reference

### remote-ssh

Execute shell commands on remote servers. Disabled by default; set `REMOTE_SSH_MODE=safe` or `REMOTE_SSH_MODE=open` to enable. Output is normalized and deduplicated when the tool runs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `command` | string | yes | Shell command to execute |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

### ssh-read-lines

Read remote file with FNV-1a hash-annotated lines and range checksums. Always prefer over `remote-ssh cat` -- returns edit-ready hashes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `filePath` | string | yes | Path to file on remote server |
| `startLine` | number | no | Start line, 1-based (default: 1) |
| `endLine` | number | no | End line (reads to limit if not set) |
| `maxLines` | number | no | Max lines to read (default: 200) |
| `plain` | boolean | no | Omit hashes, output `lineNum\|content` instead |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

Output format:

```
File: /etc/nginx/nginx.conf (85 lines) [showing 1-50] (35 more below)

ab.1    worker_processes auto;
cd.2    error_log /var/log/nginx/error.log;
...
checksum: 1-50:f7e2a1b0
```

### ssh-edit-block

Edit remote files using hash-verified anchors. Use `ssh-read-lines` first to get hash anchors and checksums.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `filePath` | string | yes | Path to file on remote server |
| `newText` | string | yes | Replacement text (for anchor/range/insert edits) |
| `anchor` | string | no | Hash anchor `ab.42` to set single line |
| `startAnchor` | string | no | Start hash anchor for range replace |
| `endAnchor` | string | no | End hash anchor for range replace |
| `insertAfter` | string | no | Hash anchor to insert after |
| `checksum` | string | no | Range checksum from `ssh-read-lines` (e.g. `1-50:f7e2a1b0`) |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

Returns a compact diff of applied changes. If checksum is stale, returns an error with the current checksum.

### ssh-search-code

Search remote files with grep. Results are deduplicated (identical normalized lines collapsed with `(xN)` counts).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `path` | string | yes | Directory to search on remote server |
| `pattern` | string | yes | Text or regex pattern |
| `filePattern` | string | no | Glob filter (e.g. `"*.js"`, `"*.py"`) |
| `ignoreCase` | boolean | no | Case-insensitive search (default: false) |
| `maxResults` | number | no | Max result lines (default: 50) |
| `contextLines` | number | no | Context lines around matches (default: 0) |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

### ssh-write-chunk

Write content to remote files (rewrite or append). Creates parent directories. `rewrite` is atomic via temp file + rename; `append` is non-atomic direct append. For existing files, prefer `ssh-edit-block` (shows diff, verifies hashes).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `filePath` | string | yes | Path to file on remote server |
| `content` | string | yes | Content to write |
| `mode` | string | no | `"rewrite"` or `"append"` (default: `"rewrite"`) |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

### ssh-upload

Upload a local file to the remote server over SFTP. Supports text and binary files. Creates remote parent directories over SFTP, stages to a temp file, then uses the strongest available finalize path (`ext_openssh_fsync` / `ext_openssh_rename` when supported, standard close+rename otherwise).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `localPath` | string | yes | Absolute local file path or `~/path` |
| `remotePath` | string | yes | Absolute destination path on remote server |
| `remotePlatform` | `auto` \| `posix` \| `windows` | no | Remote path platform hint. Use `windows` for paths like `C:\repo\file.txt` |
| `overwrite` | boolean | no | Replace existing destination when `true` (default: `false`) |
| `verify` | `none` \| `stat` | no | Post-transfer verification mode (default: `stat`) |
| `permissions` | string | no | Optional octal file mode for uploaded file, e.g. `0644` |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `transferTimeoutMs` | number | no | SFTP inactivity timeout in ms (default: 120000; `TRANSFER_TIMEOUT_MS` overrides default) |

Success output includes `bytes=`, `durationMs=`, `verify=`, and `durabilityPath=`. Existing destinations are rejected unless `overwrite=true`. Oversized transfers fail before streaming based on `MAX_TRANSFER_BYTES`.

### ssh-download

Download a remote file to the local machine over SFTP. Supports text and binary files. Writes to a temp file locally, fsyncs the staged file, then finalizes to the requested destination and verifies metadata when enabled.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `remotePath` | string | yes | Absolute file path on remote server |
| `remotePlatform` | `auto` \| `posix` \| `windows` | no | Remote path platform hint. Use `windows` for paths like `C:\repo\file.txt` |
| `localPath` | string | yes | Absolute local destination path or `~/path` |
| `overwrite` | boolean | no | Replace existing destination when `true` (default: `false`) |
| `verify` | `none` \| `stat` | no | Post-transfer verification mode (default: `stat`) |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `transferTimeoutMs` | number | no | SFTP inactivity timeout in ms (default: 120000; `TRANSFER_TIMEOUT_MS` overrides default) |

Success output includes `bytes=`, `durationMs=`, `verify=`, and `durabilityPath=`. Existing destinations are rejected unless `overwrite=true`. When `ALLOWED_LOCAL_DIRS` is set, the destination must resolve inside that allowlist.

### ssh-capabilities

Inspect whether a POSIX remote can support persistent sessions. Reports OS, shell, `tmux` availability, package managers, and required shell tools. This tool does not install packages.

### ssh-session-open

Open a trusted persistent `tmux` session on the remote host. Session metadata is stored under `~/.hex-ssh/sessions/<sid>/meta.json`; cleanup tools validate that metadata before touching a session.

Additional parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | no | Optional session label |
| `ttlSeconds` | number | no | Session TTL in seconds (default: 43200) |

Returns `sid`, `tmux_name`, and `next_commands` for `ssh-session-exec`, `ssh-session-read`, and `ssh-session-close`.

### ssh-session-exec

Run a command inside a persistent session. Uses the same `REMOTE_SSH_MODE` policy as `remote-ssh`; command execution is disabled by default. The response includes `seq`, `rc`, `stdout_lines`, and `stderr_lines`; use `ssh-session-read` for output. If `waitSeconds` expires, hex-ssh kills the tmux session and returns `SSH_EXEC_TIMEOUT`; reopen the session before continuing. Explicit `execTimeoutMs` is treated as a hard caller maximum and must be large enough to cover `waitSeconds` plus wrapper overhead.

Additional parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sid` | string | yes | Session id returned by `ssh-session-open` |
| `command` | string | yes | Shell command to execute |
| `waitSeconds` | number | no | Seconds to wait for command completion (default: 300) |

### ssh-session-read

Read a paginated output window from a session command.

Additional parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sid` | string | yes | Session id returned by `ssh-session-open` |
| `seq` | number | yes | Command sequence returned by `ssh-session-exec` |
| `stream` | `stdout` \| `stderr` | no | Output stream (default: `stdout`) |
| `offset` | number | no | Zero-based line offset (default: 0) |
| `limit` | number | no | Line limit (default: 50) |
| `raw` | boolean | no | Return only content in the result payload |

### ssh-session-close / ssh-session-gc

`ssh-session-close` closes one trusted session by `sid`. `ssh-session-gc` removes expired trusted sessions, or sessions older than `olderThanSeconds` when that optional parameter is supplied. Both validate `created_by`, `sid`, and `tmux_name` metadata before cleanup.

### ssh-verify

Verify range checksums from prior `ssh-read-lines` calls without re-reading full content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `host` | string | yes | Remote hostname or IP |
| `user` | string | no | SSH username (optional if set in `~/.ssh/config`) |
| `filePath` | string | yes | Path to file on remote server |
| `checksums` | string | yes | JSON array of checksum strings, e.g. `["1-50:f7e2a1b0"]` |
| `privateKeyPath` | string | no | Path to SSH private key |
| `port` | number | no | SSH port (default: 22) |
| `connectTimeoutMs` | number | no | SSH handshake timeout in ms (default: 20000) |
| `keepaliveIntervalMs` | number | no | SSH keepalive interval in ms (default: 30000) |
| `execTimeoutMs` | number | no | Per-command execution timeout in ms (default: 120000) |

Returns a single-line confirmation when all valid, or lists changed ranges with current checksums.

## Output Normalization

The shared `@levnikolaevich/hex-common/output/normalize` module reduces token waste in command output. It is applied automatically by `remote-ssh` and used internally by `ssh-search-code`.

### Measurement Note

The repository currently ships only a normalization diagnostic for `hex-ssh-mcp`, not a public comparative benchmark against built-in tools. That diagnostic measures normalize/deduplicate/truncate efficiency on synthetic command-output fixtures and should not be presented as a real workflow benchmark.

Run it with:

```bash
npm run benchmark:diagnostic
```

Current normalization diagnostic sample:

| ID | Scenario | Input | Output | Savings |
|----|----------|------:|-------:|--------:|
| 1 | Hash annotation overhead | 3,934 chars | 4,526 chars | -15% |
| 2 | Normalize: npm install | 11,219 chars | 2,953 chars | 74% |
| 3 | Normalize: server logs | 19,715 chars | 4,470 chars | 77% |
| 4 | Dedup: grep results | 5,799 chars | 3,199 chars | 45% |
| 5 | Smart truncate: large output | 22,281 chars | 2,717 chars | 88% |

Diagnostic summary: `72%` average reduction (`62,948 → 17,865 chars`).

## Interop Coverage

`hex-ssh-mcp` now has two transfer test layers:

- `npm test` runs fast smoke tests with mocked SSH/SFTP seams
- `npm run test:interop` runs real backend integration coverage

The interop suite validates:

- OpenSSH SFTP in Docker, including the opportunistic `openssh-ext` finalize path
- a controlled `ssh2.Server` fallback backend with no OpenSSH durability extensions

This means single-file `ssh-upload` / `ssh-download` behavior is covered across both the extension path and the standard fallback path. The interop suite requires Docker for the OpenSSH fixture.

### Normalization Rules

| Pattern | Replacement | Example |
|---------|-------------|---------|
| UUIDs | `<UUID>` | `550e8400-e29b-41d4-...` -> `<UUID>` |
| Timestamps | `<TS>` | `2026-03-19 14:30:00` -> `<TS>` |
| IP addresses | `<IP>` | `192.168.1.100:8080` -> `<IP>` |
| Hex IDs in paths | `/<ID>` | `/a1b2c3d4e5` -> `/<ID>` |
| Large numbers | `<N>` | `1234567` -> `<N>` |
| Trace IDs | `trace_id=<TRACE>` | `trace_id=f7e2a1b0` -> `trace_id=<TRACE>` |

### Deduplication

Identical lines (after normalization) are collapsed into a single line with `(xN)` count, sorted by frequency descending.

### Smart Truncation

Output exceeding 60 lines (40 head + 20 tail) is truncated with a gap indicator showing the number of omitted lines.

## Architecture

```
hex-ssh-mcp/
  server.mjs          MCP server (stdio transport, 14 tools)
  package.json
  lib/
    ssh-client.mjs    SSH connection, host/path validation, key resolution
    transfer.mjs      Local path validation and SFTP upload/download helpers
    session.mjs       Persistent tmux session command generation/parsing
    config-resolver.mjs SSH config parsing and host resolution
    command-policy.mjs Remote command safety policy

Shared substrate lives in `@levnikolaevich/hex-common`:

- `runtime/mcp-bootstrap`
- `runtime/schema`
- `runtime/results`
- `runtime/update-check`
- `text-protocol/hash`
- `output/normalize`
```

### Hash Format

```
ab.42    const x = calculateTotal(items);
```

- `ab` -- 2-char FNV-1a tag derived from content (whitespace-normalized)
- `42` -- line number (1-indexed)
- Tab separator, then original content
- Tag alphabet: `abcdefghijklmnopqrstuvwxyz234567` (32 symbols, bitwise selection)

### Range Checksums

```
checksum: 1-50:f7e2a1b0
```

FNV-1a accumulator over all line hashes in the range (little-endian byte feed). Detects changes to any line, even ones not being edited.

## FAQ

<details>
<summary><b>Does it support password authentication?</b></summary>

No. Key-only authentication (RSA, ED25519, ECDSA). This is a security design decision -- passwords in agent prompts are a leak risk. Configure SSH keys via `SSH_PRIVATE_KEY` env var or default paths (~/.ssh/).

</details>

<details>
<summary><b>Can I connect to multiple servers in one session?</b></summary>

Yes. Each tool call specifies `host` and can specify `user` directly, but connections are pooled and reused for the same resolved host/auth identity. Idle pooled connections close after 60 seconds, and the pool holds up to 10 entries.

</details>

<details>
<summary><b>What if ALLOWED_HOSTS is not set?</b></summary>

All hosts are permitted. Setting `ALLOWED_HOSTS` is recommended for production use -- it restricts which remote servers the agent can connect to, preventing lateral movement if prompts are manipulated.

</details>

## License

MIT
