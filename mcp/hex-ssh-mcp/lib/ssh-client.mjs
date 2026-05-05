/**
 * SSH client for remote command execution with connection pooling.
 * Supports RSA/ED25519/ECDSA private keys, multi-key auth retry,
 * and SSH config-derived identity files.
 * Security: ALLOWED_HOSTS env var restricts resolved destination hosts.
 */

import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join, posix as pathPosix, win32 as pathWin32 } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { buildHostVerifier } from "./host-verify.mjs";
import { assertSafeArg } from "./shell-escape.mjs";

const DEFAULT_KEY_PATHS = [
    join(homedir(), ".ssh", "id_rsa"),
    join(homedir(), ".ssh", "id_ed25519"),
    join(homedir(), ".ssh", "id_ecdsa"),
];

export const DEFAULT_CONNECT_TIMEOUT_MS = 20_000;
export const DEFAULT_KEEPALIVE_INTERVAL_MS = 30_000;
export const DEFAULT_EXEC_TIMEOUT_MS = 120_000;
const POOL_TTL = 60_000;
const POOL_MAX = 10;

// --------------- Connection Pool ---------------

const pool = new Map(); // key -> { readyPromise, client, activeCount, lastUsed, timer }

let _clientFactory = () => new Client(); // injectable for tests

/** @internal Test seam: override Client constructor. */
export function _setClientFactory(fn) { _clientFactory = fn; }

function makePoolKey(host, user, port, authId, lookupHost, connectTimeoutMs, keepaliveIntervalMs) {
    return `${user}@${host}:${port}:${authId}:${lookupHost}:ct${connectTimeoutMs}:ka${keepaliveIntervalMs}`;
}

function evict(key) {
    const entry = pool.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    try { entry.client?.end(); } catch { /* already closed */ }
    pool.delete(key);
}

function evictOldest() {
    let oldest = null;
    let oldestKey = null;
    for (const [k, e] of pool) {
        if (e.activeCount > 0) continue; // skip active
        if (!oldest || e.lastUsed < oldest.lastUsed) { oldest = e; oldestKey = k; }
    }
    if (oldestKey) evict(oldestKey);
}

function scheduleIdleEviction(key) {
    const entry = pool.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
        if (entry.activeCount <= 0) evict(key);
    }, POOL_TTL);
}

function isAlive(client) {
    // ssh2 Client tracks writable state via internal socket
    try { return client && client._sock && client._sock.writable; } catch { return false; }
}

async function acquirePooled(key, connectFn) {
    const existing = pool.get(key);
    if (existing) {
        const client = await existing.readyPromise;
        if (isAlive(client)) {
            existing.activeCount++;
            existing.lastUsed = Date.now();
            if (existing.timer) clearTimeout(existing.timer);
            return client;
        }
        pool.delete(key); // stale
    }
    if (pool.size >= POOL_MAX) evictOldest();
    const entry = { readyPromise: connectFn(), client: null, activeCount: 1, lastUsed: Date.now(), timer: null };
    pool.set(key, entry);
    try {
        entry.client = await entry.readyPromise;
        return entry.client;
    } catch (err) {
        pool.delete(key);
        throw err;
    }
}

function releasePooled(key) {
    const entry = pool.get(key);
    if (!entry) return;
    entry.activeCount = Math.max(0, entry.activeCount - 1);
    entry.lastUsed = Date.now();
    if (entry.activeCount === 0) scheduleIdleEviction(key);
}

/** Close all pooled connections (called on process exit). */
export function closeAllConnections() {
    for (const [k] of pool) evict(k);
}

process.on("exit", closeAllConnections);

// --------------- Host Validation ---------------

/**
 * Validate resolved host against ALLOWED_HOSTS env.
 * Checks the resolved destination ONLY (not alias).
 * @param {string} resolvedHost - Final network destination
 * @param {string} [originalHost] - Original alias (for error messages only)
 */
function validateHost(resolvedHost, originalHost) {
    const allowed = process.env.ALLOWED_HOSTS;
    if (!allowed) return;
    const list = allowed.split(",").map((h) => h.trim().toLowerCase());
    if (!list.includes(resolvedHost.toLowerCase())) {
        const tried = originalHost && originalHost !== resolvedHost
            ? `"${originalHost}" (resolved: ${resolvedHost})`
            : `"${resolvedHost}"`;
        throw new Error(
            `Host ${tried} not in ALLOWED_HOSTS. Permitted: ${list.join(", ")}`
        );
    }
}

// --------------- Path Validation ---------------

function normalizeRemotePlatform(remotePlatform = "auto") {
    if (remotePlatform === undefined || remotePlatform === null || remotePlatform === "") return "auto";
    if (remotePlatform === "auto" || remotePlatform === "posix" || remotePlatform === "windows") return remotePlatform;
    throw new Error(`BAD_REMOTE_PLATFORM: expected auto, posix, or windows; got "${remotePlatform}"`);
}

function detectRemotePlatform(raw) {
    if (/^(?:[a-zA-Z]:[\\/]|\/[a-zA-Z]:[\\/]|\\\\)/.test(raw) || raw.includes("\\")) return "windows";
    return "posix";
}

function canonicalizePosix(raw) {
    if (!raw.startsWith("/")) {
        throw new Error(`BAD_PATH: absolute POSIX remote path required, got "${raw}"`);
    }
    const canonical = pathPosix.normalize(raw);
    if (!canonical.startsWith("/")) {
        throw new Error(`BAD_PATH: absolute POSIX remote path required, got "${raw}"`);
    }
    return canonical;
}

function canonicalizeWindows(raw) {
    let candidate = raw;
    if (/^\/[a-zA-Z]:[\\/]/.test(candidate)) candidate = candidate.slice(1);
    candidate = candidate.replace(/\//g, "\\");
    if (!pathWin32.isAbsolute(candidate)) {
        throw new Error(`BAD_PATH: absolute Windows remote path required, got "${raw}"`);
    }
    return pathWin32.normalize(candidate);
}

function isWithinRemoteRoot(filePath, rootPath, remotePlatform) {
    if (remotePlatform === "windows") {
        const relativePath = pathWin32.relative(rootPath.toLowerCase(), filePath.toLowerCase());
        return relativePath === "" || (!relativePath.startsWith("..") && !pathWin32.isAbsolute(relativePath));
    }
    const relativePath = pathPosix.relative(rootPath, filePath);
    return relativePath === "" || (!relativePath.startsWith("..") && !pathPosix.isAbsolute(relativePath));
}

export function canonicalizeRemotePath(filePath, remotePlatform = "auto") {
    assertSafeArg("filePath", filePath);
    const normalizedPlatform = normalizeRemotePlatform(remotePlatform);
    const effectivePlatform = normalizedPlatform === "auto"
        ? detectRemotePlatform(filePath)
        : normalizedPlatform;
    const canonical = effectivePlatform === "windows"
        ? canonicalizeWindows(filePath)
        : canonicalizePosix(filePath);
    return { platform: effectivePlatform, canonical };
}

export function validateRemotePath(filePath, remotePlatform = "auto") {
    const { platform, canonical } = canonicalizeRemotePath(filePath, remotePlatform);

    const allowed = process.env.ALLOWED_DIRS;
    if (!allowed) return { platform, canonical };

    const dirs = allowed
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => canonicalizeRemotePath(d, platform).canonical);
    const ok = dirs.some((dir) => isWithinRemoteRoot(canonical, dir, platform));
    if (!ok) {
        throw new Error(
            `PATH_OUTSIDE_ROOT: "${filePath}" (resolved: "${canonical}") not under ALLOWED_DIRS. Permitted: ${dirs.join(", ")}`
        );
    }
    return { platform, canonical };
}

// --------------- Key Resolution ---------------

export function normalizeLocalKeyPath(keyPath) {
    if (typeof keyPath !== "string") return keyPath;
    if (/^[a-zA-Z]:[\\/]/.test(keyPath) || /^\\\\[^\\]+\\[^\\]+/.test(keyPath)) {
        return keyPath.replace(/\\/g, "/");
    }
    return keyPath;
}

function readKeyFile(keyPath) {
    const normalized = normalizeLocalKeyPath(keyPath);
    const candidates = normalized === keyPath ? [keyPath] : [normalized, keyPath];
    let lastError = null;

    for (const candidate of candidates) {
        try { return readFileSync(candidate); }
        catch (err) { lastError = err; }
    }

    const normalizedNote = normalized === keyPath ? "" : ` (normalized: ${normalized})`;
    throw new Error(`Cannot read key: ${keyPath}${normalizedNote} (${lastError.message})`);
}

/**
 * Get private key from: explicit path > config identityFiles > env > defaults.
 * Returns array of candidate keys for multi-key auth.
 */
function getCandidateKeys(keyPath, identityFiles = []) {
    const keys = [];

    // 1. Explicit keyPath (highest priority)
    if (keyPath) {
        keys.push(readKeyFile(keyPath));
        return keys;
    }

    // 2. Config-derived identityFiles (ordered, like OpenSSH)
    for (const p of identityFiles) {
        try { keys.push(readKeyFile(p)); }
        catch { continue; }
    }
    if (keys.length > 0) return keys;

    // 3. SSH_PRIVATE_KEY env var
    const envKey = process.env.SSH_PRIVATE_KEY;
    if (envKey) {
        if (envKey.startsWith("-----")) { keys.push(Buffer.from(envKey)); return keys; }
        try { keys.push(readKeyFile(envKey)); return keys; }
        catch { /* fall through */ }
    }

    // 4. Default key paths
    for (const p of DEFAULT_KEY_PATHS) {
        try { keys.push(readKeyFile(p)); }
        catch { continue; }
    }
    if (keys.length > 0) return keys;

    throw new Error(
        "No SSH private key found. Provide privateKeyPath, set SSH_PRIVATE_KEY, " +
        `or place key at: ${DEFAULT_KEY_PATHS.join(", ")}`
    );
}

// --------------- Connection + Execution ---------------

const SSH_ALGORITHMS = {
    kex: [
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group14-sha256",
    ],
};

/**
 * Establish an SSH connection with a specific key.
 * @returns {Promise<Client>} Connected ssh2 Client
 */
function connectOne({ host, user, port, privateKey, lookupHost, connectTimeoutMs, keepaliveIntervalMs }) {
    return new Promise((resolve, reject) => {
        const conn = _clientFactory();

        conn.on("ready", () => resolve(conn));
        conn.on("error", (err) => {
            reject(new Error(`SSH connection to ${host}:${port} failed: ${err.message}`));
        });

        conn.connect({
            host,
            port,
            username: user,
            privateKey,
            hostVerifier: buildHostVerifier(lookupHost, port),
            algorithms: SSH_ALGORITHMS,
            readyTimeout: connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
            keepaliveInterval: keepaliveIntervalMs ?? DEFAULT_KEEPALIVE_INTERVAL_MS,
        });
    });
}

/**
 * Acquire a pooled SSH connection and return the release key.
 * @returns {Promise<{ conn: Client, key: string }>}
 */
async function acquireConnection({
    host, user, port = 22, privateKeyPath,
    originalHost, identityFiles = [], hostKeyAlias,
    connectTimeoutMs, keepaliveIntervalMs,
}) {
    validateHost(host, originalHost);
    const lookupHost = hostKeyAlias || host;

    const effectiveConnectTimeoutMs = connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const effectiveKeepaliveIntervalMs = keepaliveIntervalMs ?? DEFAULT_KEEPALIVE_INTERVAL_MS;

    const candidateKeys = getCandidateKeys(privateKeyPath, identityFiles);
    const authId = createHash("sha256").update(candidateKeys[0]).digest("hex").slice(0, 8);
    const key = makePoolKey(host, user, port, authId, lookupHost, effectiveConnectTimeoutMs, effectiveKeepaliveIntervalMs);

    const conn = await acquirePooled(key, async () => {
        const { client } = await connectWithKeyFallback({
            host, user, port, candidateKeys, lookupHost,
            connectTimeoutMs: effectiveConnectTimeoutMs,
            keepaliveIntervalMs: effectiveKeepaliveIntervalMs,
        });
        client.on("error", () => evict(key));
        client.on("close", () => evict(key));
        return client;
    });

    return { conn, key };
}

/**
 * Try connecting with multiple candidate keys (like OpenSSH).
 * On auth failure, reconnect with the next key.
 * @returns {{ client: Client, privateKey: Buffer }} Winning connection + key
 */
async function connectWithKeyFallback({ host, user, port, candidateKeys, lookupHost, connectTimeoutMs, keepaliveIntervalMs }) {
    const errors = [];
    for (let i = 0; i < candidateKeys.length; i++) {
        try {
            const client = await connectOne({
                host, user, port,
                privateKey: candidateKeys[i],
                lookupHost,
                connectTimeoutMs,
                keepaliveIntervalMs,
            });
            return { client, privateKey: candidateKeys[i] };
        } catch (err) {
            errors.push(err);
            const isAuth = /auth|permission|publickey/i.test(err.message);
            if (isAuth && i < candidateKeys.length - 1) continue;
            throw err;
        }
    }
    throw errors[errors.length - 1];
}

/**
 * Execute a command on a remote host via SSH.
 * Uses connection pooling and multi-key auth.
 *
 * @param {object} opts
 * @param {string} opts.host - Resolved hostname or IP
 * @param {string} opts.user - SSH username
 * @param {string} opts.command - Shell command to execute
 * @param {string} [opts.privateKeyPath] - Explicit path to private key
 * @param {number} [opts.port=22] - SSH port
 * @param {string} [opts.originalHost] - Original alias (for error messages)
 * @param {string[]} [opts.identityFiles] - Config-derived IdentityFile paths
 * @param {string} [opts.hostKeyAlias] - HostKeyAlias for known_hosts lookup
 * @param {number} [opts.connectTimeoutMs] - Per-call SSH handshake timeout. Defaults to DEFAULT_CONNECT_TIMEOUT_MS. Included in pool key.
 * @param {number} [opts.keepaliveIntervalMs] - Per-call SSH keepalive interval. Defaults to DEFAULT_KEEPALIVE_INTERVAL_MS. Included in pool key.
 * @param {number} [opts.execTimeoutMs] - Per-call command execution timeout. Defaults to DEFAULT_EXEC_TIMEOUT_MS.
 * @returns {Promise<{output: string, error: string|null, exitCode: number}>}
 */
export async function executeCommand({
    host, user, command, privateKeyPath, port = 22,
    originalHost, identityFiles = [], hostKeyAlias,
    connectTimeoutMs, keepaliveIntervalMs, execTimeoutMs,
}) {
    const { conn, key } = await acquireConnection({
        host,
        user,
        port,
        privateKeyPath,
        originalHost,
        identityFiles,
        hostKeyAlias,
        connectTimeoutMs,
        keepaliveIntervalMs,
    });

    const effectiveExecTimeoutMs = execTimeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";

        conn.exec(command, (err, stream) => {
            if (err) {
                releasePooled(key);
                return reject(new Error(`Exec failed: ${err.message}`));
            }

            const timer = setTimeout(() => {
                stream.close();
                releasePooled(key);
                reject(new Error(`EXEC_TIMEOUT: command exceeded ${effectiveExecTimeoutMs}ms limit`));
            }, effectiveExecTimeoutMs);

            stream.on("close", (code) => {
                clearTimeout(timer);
                releasePooled(key);
                resolve({
                    output: stdout.trim(),
                    error: stderr.trim() || null,
                    exitCode: code || 0,
                });
            });
            stream.on("data", (data) => { stdout += data.toString(); });
            stream.stderr.on("data", (data) => { stderr += data.toString(); });
        });
    });
}

/**
 * Open an SFTP session on a pooled SSH connection.
 * The callback must resolve only after all stream work is complete.
 * Accepts optional per-call connectTimeoutMs and keepaliveIntervalMs which
 * participate in the pool key. SFTP transfer inactivity timeout is applied
 * per-call inside transfer.mjs (transferTimeoutMs).
 */
export async function withSftp({
    host, user, privateKeyPath, port = 22,
    originalHost, identityFiles = [], hostKeyAlias,
    connectTimeoutMs, keepaliveIntervalMs,
}, handler) {
    const { conn, key } = await acquireConnection({
        host,
        user,
        port,
        privateKeyPath,
        originalHost,
        identityFiles,
        hostKeyAlias,
        connectTimeoutMs,
        keepaliveIntervalMs,
    });

    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) {
                releasePooled(key);
                reject(new Error(`SFTP_INIT_FAILED: ${err.message}`));
                return;
            }

            Promise.resolve()
                .then(() => handler(sftp))
                .then(resolve, reject)
                .finally(() => {
                    try { sftp.end?.(); } catch { /* ignore close errors */ }
                    releasePooled(key);
                });
        });
    });
}
