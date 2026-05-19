import { randomBytes } from "node:crypto";
import { shellQuote, assertSafeArg } from "./shell-escape.mjs";

export const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const DEFAULT_SESSION_WAIT_SECONDS = 300;

const SID_RE = /^[a-f0-9]{8,32}$/;
const STREAMS = new Set(["stdout", "stderr"]);
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F-\x9F]/;

export function newSessionId() {
    return randomBytes(4).toString("hex");
}

export function isSafeSessionId(sid) {
    return typeof sid === "string" && SID_RE.test(sid);
}

export function tmuxNameForSid(sid) {
    assertSafeSid(sid);
    return `hex_ssh_${sid}`;
}

export function sanitizePositiveInt(value, fallback, fieldName) {
    if (value === undefined || value === null || value === "") return fallback;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) {
        throw new Error(`INVALID_INPUT: ${fieldName} must be a positive integer`);
    }
    return n;
}

export function assertSafeSid(sid) {
    if (!isSafeSessionId(sid)) {
        throw new Error("INVALID_SESSION: sid must be 8-32 lowercase hex characters");
    }
}

export function assertValidStream(stream) {
    if (!STREAMS.has(stream)) {
        throw new Error("INVALID_STREAM: stream must be stdout or stderr");
    }
}

export function assertValidPagination(offset, limit) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1) {
        throw new Error("INVALID_PAGINATION: offset must be >= 0 and limit must be >= 1");
    }
}

export function assertSafeSessionCommand(command) {
    assertSafeArg("command", command);
    if (CONTROL_CHARS_RE.test(command)) {
        throw new Error("UNSAFE_ARG: command contains terminal control characters");
    }
}

export function buildSessionMetadata({ sid, name = "", ttlSeconds = DEFAULT_SESSION_TTL_SECONDS, now = new Date() }) {
    assertSafeSid(sid);
    const createdAtEpoch = Math.floor(now.getTime() / 1000);
    return {
        created_by: "hex-ssh-mcp",
        sid,
        name,
        tmux_name: tmuxNameForSid(sid),
        created_at: now.toISOString(),
        created_at_epoch: createdAtEpoch,
        ttl_seconds: ttlSeconds,
        expires_at_epoch: createdAtEpoch + ttlSeconds,
    };
}

function sessionPrelude(sid) {
    assertSafeSid(sid);
    return [
        `sid=${shellQuote(sid)}`,
        `tmux_name=${shellQuote(tmuxNameForSid(sid))}`,
        'dir="$HOME/.hex-ssh/sessions/$sid"',
        'meta="$dir/meta.json"',
    ].join("; ");
}

function metadataValidationCommand() {
    return [
        'test -f "$meta" || { echo SESSION_NOT_FOUND >&2; exit 3; }',
        `grep -Fq ${shellQuote('"created_by":"hex-ssh-mcp"')} "$meta"`,
        'grep -Fq "\\"sid\\":\\"$sid\\"" "$meta"',
        'grep -Fq "\\"tmux_name\\":\\"$tmux_name\\"" "$meta"',
    ].join(" && ") + " || { echo METADATA_VALIDATION_FAILED >&2; exit 3; }";
}

function base64DecodeCommand(targetPath) {
    return `(base64 -d 2>/dev/null || base64 -D) > ${targetPath}`;
}

export function capabilitiesCommand() {
    const tools = ["sh", "tmux", "awk", "sed", "tail", "head", "base64", "wc", "grep", "date"];
    const packageManagers = ["apt", "dnf", "yum", "apk", "pacman", "brew"];
    return [
        'printf "os=%s\\n" "$(uname -s 2>/dev/null || printf unknown)"',
        'printf "shell=%s\\n" "${SHELL:-unknown}"',
        ...tools.map((tool) => `if command -v ${tool} >/dev/null 2>&1; then printf "tool.${tool}=present\\n"; else printf "tool.${tool}=missing\\n"; fi`),
        ...packageManagers.map((pm) => `if command -v ${pm} >/dev/null 2>&1; then printf "pkg.${pm}=present\\n"; fi`),
    ].join("; ");
}

export function parseCapabilitiesOutput(output) {
    const values = {};
    for (const line of String(output || "").split("\n")) {
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        values[line.slice(0, idx)] = line.slice(idx + 1);
    }
    const tools = {};
    const packageManagers = [];
    for (const [key, value] of Object.entries(values)) {
        if (key.startsWith("tool.")) tools[key.slice(5)] = value === "present";
        if (key.startsWith("pkg.") && value === "present") packageManagers.push(key.slice(4));
    }
    return {
        os: values.os || "unknown",
        shell: values.shell || "unknown",
        tmux_installed: tools.tmux === true,
        session_backend: tools.tmux === true ? "tmux" : "none",
        package_managers: packageManagers,
        tools,
    };
}

export function openSessionCommand(metadata) {
    const metaJson = JSON.stringify(metadata);
    const metaB64 = Buffer.from(metaJson, "utf8").toString("base64");
    return [
        sessionPrelude(metadata.sid),
        "command -v tmux >/dev/null 2>&1 || { echo TMUX_MISSING >&2; exit 127; }",
        'if tmux has-session -t "$tmux_name" 2>/dev/null; then echo SESSION_EXISTS >&2; exit 3; fi',
        'mkdir -p "$dir"',
        `printf %s ${shellQuote(metaB64)} | ${base64DecodeCommand('"$meta"')}`,
        'chmod 600 "$meta"',
        'tmux new-session -d -s "$tmux_name"',
    ].join("; ");
}

export function execSessionCommand({ sid, seq, command, waitSeconds }) {
    assertSafeSid(sid);
    if (!Number.isInteger(seq) || seq < 1) {
        throw new Error("INVALID_INPUT: seq must be a positive integer");
    }
    if (!command || typeof command !== "string") {
        throw new Error("INVALID_INPUT: command required");
    }
    assertSafeSessionCommand(command);
    const out = `"$dir/${seq}.out"`;
    const err = `"$dir/${seq}.err"`;
    const rc = `"$dir/${seq}.rc"`;
    const wrappedPrefix = [
        "__hex_ssh_exit_defined=0",
        "unalias -a 2>/dev/null || true",
        "trap - HUP INT TERM 2>/dev/null || true",
    ].join("; ") + "; __hex_ssh_session_dir=";
    const wrappedSuffix = [
        'exit() { return "$1"; } 2>/dev/null && __hex_ssh_exit_defined=1',
        `{ ${command}; } > "$__hex_ssh_session_dir/${seq}.out" 2> "$__hex_ssh_session_dir/${seq}.err"`,
        "__hex_ssh_rc=$?",
        'if [ "$__hex_ssh_exit_defined" = 1 ]; then unset -f exit 2>/dev/null || true; fi',
        `command printf '%s\\n' "$__hex_ssh_rc" > "$__hex_ssh_session_dir/${seq}.rc"`,
    ].join("; ");
    return [
        sessionPrelude(sid),
        "command -v tmux >/dev/null 2>&1 || { echo TMUX_MISSING >&2; exit 127; }",
        metadataValidationCommand(),
        'tmux has-session -t "$tmux_name" 2>/dev/null || { echo SESSION_NOT_FOUND >&2; exit 3; }',
        `rm -f ${rc}`,
        `wrapped_prefix=${shellQuote(wrappedPrefix)}`,
        `wrapped_suffix=${shellQuote(wrappedSuffix)}`,
        `quoted_dir=$(printf "%s" "$dir" | sed "s/'/'\\\\''/g; 1s/^/'/; \\$s/\\$/'/")`,
        'tmux send-keys -l -t "$tmux_name" "$wrapped_prefix$quoted_dir; $wrapped_suffix" || { echo TMUX_SEND_FAILED >&2; exit 3; }',
        'tmux send-keys -t "$tmux_name" Enter || { echo TMUX_SEND_FAILED >&2; exit 3; }',
        `i=0; while [ $i -lt ${waitSeconds} ] && [ ! -f ${rc} ]; do i=$((i+1)); sleep 1; done`,
        `test -f ${rc} || { tmux kill-session -t "$tmux_name" 2>/dev/null || true; echo __HEX_SSH_TIMEOUT__; exit 124; }`,
        `command printf '__HEX_SSH_RC__=%s\\n' "$(cat ${rc})"`,
        `command printf '__HEX_SSH_STDOUT_LINES__=%s\\n' "$(awk 'END{print NR}' ${out} 2>/dev/null || command printf 0)"`,
        `command printf '__HEX_SSH_STDERR_LINES__=%s\\n' "$(awk 'END{print NR}' ${err} 2>/dev/null || command printf 0)"`,
    ].join("; ");
}

export function nextSessionSeqCommand(sid) {
    assertSafeSid(sid);
    return [
        sessionPrelude(sid),
        metadataValidationCommand(),
        'seq_file="$dir/seq"',
        'seq_lock="$dir/seq.lock"',
        'i=0',
        'until mkdir "$seq_lock" 2>/dev/null; do i=$((i+1)); if [ $i -ge 30 ]; then echo SESSION_BUSY >&2; exit 3; fi; sleep 1; done',
        'trap \'rmdir "$seq_lock" 2>/dev/null || true\' EXIT HUP INT TERM',
        'if [ -f "$seq_file" ]; then seq=$(cat "$seq_file"); else seq=0; fi',
        'case "$seq" in ""|*[!0-9]*) echo BAD_SESSION_STATE >&2; exit 3;; esac',
        'seq=$((seq+1))',
        'printf "%s\\n" "$seq" > "$seq_file"',
        'rmdir "$seq_lock" 2>/dev/null || true',
        'trap - EXIT HUP INT TERM 2>/dev/null || true',
        'printf "%s\\n" "$seq"',
    ].join("; ");
}

export function parseNextSeqOutput(output) {
    const seq = Number.parseInt(String(output || "").trim(), 10);
    if (!Number.isInteger(seq) || seq < 1) {
        throw new Error("BAD_SESSION_STATE: session seq marker was invalid");
    }
    return seq;
}

export function parseSessionExecOutput(output) {
    const text = String(output || "");
    if (text.includes("__HEX_SSH_TIMEOUT__")) {
        throw new Error("SSH_EXEC_TIMEOUT: session command timed out");
    }
    const rc = markerInt(text, "__HEX_SSH_RC__");
    const stdoutLines = markerInt(text, "__HEX_SSH_STDOUT_LINES__");
    const stderrLines = markerInt(text, "__HEX_SSH_STDERR_LINES__");
    if (rc === null || stdoutLines === null || stderrLines === null) {
        throw new Error("BAD_SESSION_STATE: session exec markers were missing");
    }
    return { rc, stdout_lines: stdoutLines, stderr_lines: stderrLines };
}

export function readSessionCommand({ sid, seq, stream, offset, limit }) {
    assertSafeSid(sid);
    assertValidStream(stream);
    assertValidPagination(offset, limit);
    if (!Number.isInteger(seq) || seq < 1) {
        throw new Error("INVALID_INPUT: seq must be a positive integer");
    }
    const ext = stream === "stderr" ? "err" : "out";
    const start = offset + 1;
    return [
        sessionPrelude(sid),
        metadataValidationCommand(),
        `file="$dir/${seq}.${ext}"`,
        'test -f "$file" || { echo __HEX_SSH_NOT_FOUND__; exit 0; }',
        'total=$(awk \'END{print NR}\' "$file" 2>/dev/null || printf 0)',
        `tail -n +${start} "$file" | head -n ${limit}`,
        'printf "\\n__HEX_SSH_TOTAL_LINES__=%s\\n" "$total"',
    ].join("; ");
}

export function parseSessionReadOutput(output) {
    const text = String(output || "");
    if (text.trim() === "__HEX_SSH_NOT_FOUND__") {
        throw new Error("OUTPUT_NOT_FOUND: session output not found");
    }
    const marker = "\n__HEX_SSH_TOTAL_LINES__=";
    const idx = text.lastIndexOf(marker);
    if (idx === -1) {
        throw new Error("BAD_SESSION_STATE: session read marker was missing");
    }
    const content = text.slice(0, idx);
    const totalLines = Number.parseInt(text.slice(idx + marker.length).trim(), 10);
    if (!Number.isInteger(totalLines) || totalLines < 0) {
        throw new Error("BAD_SESSION_STATE: session read total was invalid");
    }
    return { content, total_lines: totalLines };
}

export function closeSessionCommand(sid) {
    assertSafeSid(sid);
    return [
        sessionPrelude(sid),
        metadataValidationCommand(),
        'if tmux has-session -t "$tmux_name" 2>/dev/null; then tmux kill-session -t "$tmux_name"; fi',
        'rm -rf "$dir"',
    ].join("; ");
}

export function gcSessionsCommand({ olderThanSeconds = 0 } = {}) {
    const older = sanitizePositiveOrZero(olderThanSeconds, "olderThanSeconds");
    return [
        'root="$HOME/.hex-ssh/sessions"',
        'now=$(date +%s)',
        'deleted=""',
        'for meta in "$root"/*/meta.json; do',
        '  [ -f "$meta" ] || continue',
        '  dir=$(dirname "$meta")',
        '  sid=$(basename "$dir")',
        '  case "$sid" in ""|*[!a-f0-9]*) continue;; esac',
        `  grep -Fq ${shellQuote('"created_by":"hex-ssh-mcp"')} "$meta" || continue`,
        '  grep -Fq "\\"sid\\":\\"$sid\\"" "$meta" || continue',
        '  tmux_name="hex_ssh_$sid"',
        '  grep -Fq "\\"tmux_name\\":\\"$tmux_name\\"" "$meta" || continue',
        '  created=$(sed -n \'s/.*"created_at_epoch"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p\' "$meta" | head -n 1)',
        '  expires=$(sed -n \'s/.*"expires_at_epoch"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p\' "$meta" | head -n 1)',
        '  should=0',
        `  if [ ${older} -gt 0 ]; then threshold=$((now-${older})); [ -n "$created" ] && [ "$created" -le "$threshold" ] && should=1; else [ -n "$expires" ] && [ "$expires" -le "$now" ] && should=1; fi`,
        '  [ "$should" -eq 1 ] || continue',
        '  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$tmux_name" 2>/dev/null; then tmux kill-session -t "$tmux_name" || continue; fi',
        '  rm -rf "$dir" || continue',
        '  deleted="${deleted}${sid}\n"',
        'done',
        'printf "%s" "$deleted"',
    ].join("\n");
}

export function parseGcOutput(output) {
    return String(output || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function markerInt(text, marker) {
    const re = new RegExp(`${marker}=(-?\\d+)`);
    const match = re.exec(text);
    if (!match) return null;
    const n = Number.parseInt(match[1], 10);
    return Number.isInteger(n) ? n : null;
}

function sanitizePositiveOrZero(value, fieldName) {
    if (value === undefined || value === null || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0) {
        throw new Error(`INVALID_INPUT: ${fieldName} must be a non-negative integer`);
    }
    return n;
}
