import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import {
    chmodSync,
    closeSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readFileSync,
    readSync,
    renameSync,
    rmSync,
    statSync,
    unlinkSync,
    writeFileSync,
    writeSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { posix as pathPosix } from "node:path";
import { fileURLToPath } from "node:url";
import ssh2 from "ssh2";

const { Server, utils } = ssh2;

const {
    parseKey,
    sftp: {
        OPEN_MODE,
        STATUS_CODE,
        flagsToString,
    },
} = utils;

const TEST_USER = "tester";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENSSH_FIXTURE_DIR = join(__dirname, "fixtures", "openssh");
const CLIENT_PRIVATE_KEY_PATH = join(OPENSSH_FIXTURE_DIR, "client_ed25519");
const CLIENT_PUBLIC_KEY_PATH = join(OPENSSH_FIXTURE_DIR, "client_ed25519.pub");
const HOST_PRIVATE_KEY_PATH = join(OPENSSH_FIXTURE_DIR, "ssh_host_ed25519_key");
const HOST_PUBLIC_KEY_PATH = join(OPENSSH_FIXTURE_DIR, "ssh_host_ed25519_key.pub");

function runProcess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0 || options.allowFailure) {
                resolve({ code, stdout, stderr });
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} failed (${code}): ${stderr || stdout}`));
        });
    });
}

function normalizeRemotePath(remotePath) {
    const normalized = pathPosix.normalize(remotePath || "/");
    if (!normalized.startsWith("/")) {
        throw new Error(`Expected absolute remote path, got ${remotePath}`);
    }
    return normalized;
}

function toAttrs(stats, sizeOverride) {
    return {
        mode: stats.mode,
        uid: 1000,
        gid: 1000,
        size: sizeOverride ?? stats.size,
        atime: Math.floor(stats.atimeMs / 1000),
        mtime: Math.floor(stats.mtimeMs / 1000),
    };
}

function mapStatusCode(err) {
    if (err?.code === "ENOENT") return STATUS_CODE.NO_SUCH_FILE;
    if (err?.code === "EACCES" || err?.code === "EPERM") return STATUS_CODE.PERMISSION_DENIED;
    return STATUS_CODE.FAILURE;
}

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on("error", reject);
    });
}

async function waitForPort(port, timeoutMs = 15_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const ready = await new Promise((resolve) => {
            const socket = net.connect({ host: "127.0.0.1", port });
            socket.once("connect", () => {
                socket.destroy();
                resolve(true);
            });
            socket.once("error", () => resolve(false));
        });
        if (ready) return;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Timed out waiting for 127.0.0.1:${port}`);
}

function loadParsedPublicKey(filePath) {
    const parsed = parseKey(readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed[0];
    return parsed;
}

function computeFingerprint(publicKeyPath) {
    const [, keyData] = readFileSync(publicKeyPath, "utf8").trim().split(/\s+/);
    return "SHA256:" + createHash("sha256").update(Buffer.from(keyData, "base64")).digest("base64").replace(/=+$/, "");
}

function createConnectionArgs(port) {
    return {
        host: "127.0.0.1",
        user: TEST_USER,
        port,
        privateKeyPath: CLIENT_PRIVATE_KEY_PATH,
        identityFiles: [],
    };
}

async function waitForSshReady(port, timeoutMs = 15_000) {
    const startedAt = Date.now();
    const privateKey = readFileSync(CLIENT_PRIVATE_KEY_PATH);

    while (Date.now() - startedAt < timeoutMs) {
        const ready = await new Promise((resolve) => {
            const client = new ssh2.Client();
            let settled = false;

            const finish = (value) => {
                if (settled) return;
                settled = true;
                try { client.end(); } catch { /* ignore close races */ }
                resolve(value);
            };

            client.on("ready", () => {
                client.sftp((err, sftp) => {
                    if (err) {
                        finish(false);
                        return;
                    }
                    try { sftp.end?.(); } catch { /* ignore close races */ }
                    finish(true);
                });
            });
            client.on("error", () => finish(false));
            client.on("close", () => finish(false));

            try {
                client.connect({
                    host: "127.0.0.1",
                    port,
                    username: TEST_USER,
                    privateKey,
                    readyTimeout: 2_000,
                });
            } catch {
                finish(false);
            }
        });

        if (ready) return;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for SSH readiness on 127.0.0.1:${port}`);
}

export async function isDockerConfigured() {
    try {
        const result = await runProcess("docker", ["compose", "version"], { allowFailure: true });
        return result.code === 0;
    } catch {
        return false;
    }
}

export function getInteropFingerprint() {
    return computeFingerprint(HOST_PUBLIC_KEY_PATH);
}

export async function startOpenSshFixture() {
    const port = await getFreePort();
    const composeEnv = { ...process.env, OPENSSH_PORT: String(port) };

    await runProcess("docker", ["compose", "up", "-d", "--build"], {
        cwd: OPENSSH_FIXTURE_DIR,
        env: composeEnv,
    });

    try {
        await waitForPort(port);
        await waitForSshReady(port);
    } catch (err) {
        const logs = await runProcess("docker", ["compose", "logs", "--no-color"], {
            cwd: OPENSSH_FIXTURE_DIR,
            env: composeEnv,
            allowFailure: true,
        });
        await runProcess("docker", ["compose", "down", "--volumes", "--remove-orphans"], {
            cwd: OPENSSH_FIXTURE_DIR,
            env: composeEnv,
            allowFailure: true,
        });
        throw new Error(`${err.message}\n${logs.stdout}${logs.stderr}`);
    }

    return {
        fingerprint: getInteropFingerprint(),
        port,
        connectionArgs: createConnectionArgs(port),
        async logs() {
            const result = await runProcess("docker", ["compose", "logs", "--no-color"], {
                cwd: OPENSSH_FIXTURE_DIR,
                env: composeEnv,
                allowFailure: true,
            });
            return `${result.stdout}${result.stderr}`.trim();
        },
        async stop() {
            await runProcess("docker", ["compose", "down", "--volumes", "--remove-orphans"], {
                cwd: OPENSSH_FIXTURE_DIR,
                env: composeEnv,
                allowFailure: true,
            });
        },
    };
}

export async function startFallbackServer(options = {}) {
    const rootDir = mkdtempSync(join(tmpdir(), "hex-ssh-fallback-"));
    const allowedPubKey = loadParsedPublicKey(CLIENT_PUBLIC_KEY_PATH);
    const openHandles = new Map();
    const clientConnections = new Set();
    const readDelayMs = options.readDelayMs || 0;
    const writeDelayMs = options.writeDelayMs || 0;
    const statSizeOverrides = options.statSizeOverrides || new Map();

    function toLocalPath(remotePath) {
        const normalized = normalizeRemotePath(remotePath);
        const segments = normalized.split("/").filter(Boolean);
        return {
            localPath: join(rootDir, ...segments),
            normalized,
        };
    }

    function allocateHandle(entry) {
        const handle = Buffer.alloc(4);
        const id = openHandles.size + 1;
        handle.writeUInt32BE(id, 0);
        openHandles.set(id, entry);
        return handle;
    }

    function getHandleEntry(handle) {
        if (!Buffer.isBuffer(handle) || handle.length !== 4) return null;
        return openHandles.get(handle.readUInt32BE(0)) || null;
    }

    for (const [remotePath, content] of options.files || []) {
        const { localPath } = toLocalPath(remotePath);
        mkdirSync(dirname(localPath), { recursive: true });
        writeFileSync(localPath, Buffer.isBuffer(content) ? content : Buffer.from(content));
    }

    const server = new Server({
        hostKeys: [readFileSync(HOST_PRIVATE_KEY_PATH)],
    }, (client) => {
        clientConnections.add(client);
        client.on("authentication", (ctx) => {
            if (ctx.method !== "publickey") {
                ctx.reject();
                return;
            }

            const user = Buffer.from(ctx.username);
            const allowedUser = Buffer.from(TEST_USER);
            const sameLength = user.length === allowedUser.length;
            const sameUser = sameLength && timingSafeEqual(user, allowedUser);
            const expectedKey = allowedPubKey.getPublicSSH();
            const sameAlgo = ctx.key.algo === allowedPubKey.type;
            const sameKey = Buffer.isBuffer(ctx.key.data)
                && Buffer.isBuffer(expectedKey)
                && ctx.key.data.length === expectedKey.length
                && timingSafeEqual(ctx.key.data, expectedKey);
            const validSignature = !ctx.signature
                || allowedPubKey.verify(ctx.blob, ctx.signature, ctx.hashAlgo) === true;

            if (sameUser && sameAlgo && sameKey && validSignature) {
                ctx.accept();
                return;
            }
            ctx.reject();
        }).on("ready", () => {
            client.on("session", (accept) => {
                const session = accept();
                session.on("sftp", (acceptSftp) => {
                    const sftp = acceptSftp();

                    sftp.on("REALPATH", (reqid, requestedPath) => {
                        const normalized = normalizeRemotePath(requestedPath || "/");
                        sftp.name(reqid, [{ filename: normalized, longname: normalized, attrs: {} }]);
                    }).on("STAT", (reqid, requestedPath) => {
                        const { localPath, normalized } = toLocalPath(requestedPath);
                        try {
                            const stats = statSync(localPath);
                            sftp.attrs(reqid, toAttrs(stats, statSizeOverrides.get(normalized)));
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("LSTAT", (reqid, requestedPath) => {
                        const { localPath, normalized } = toLocalPath(requestedPath);
                        try {
                            const stats = statSync(localPath);
                            sftp.attrs(reqid, toAttrs(stats, statSizeOverrides.get(normalized)));
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("FSTAT", (reqid, handle) => {
                        const entry = getHandleEntry(handle);
                        if (!entry || entry.type !== "file") {
                            sftp.status(reqid, STATUS_CODE.FAILURE);
                            return;
                        }
                        try {
                            const stats = statSync(entry.localPath);
                            sftp.attrs(reqid, toAttrs(stats, statSizeOverrides.get(entry.remotePath)));
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("OPEN", (reqid, filename, flags) => {
                        const { localPath, normalized } = toLocalPath(filename);
                        const fsFlags = flagsToString(flags);
                        if (!fsFlags) {
                            sftp.status(reqid, STATUS_CODE.FAILURE);
                            return;
                        }
                        try {
                            if (flags & (OPEN_MODE.WRITE | OPEN_MODE.CREAT | OPEN_MODE.APPEND | OPEN_MODE.TRUNC)) {
                                mkdirSync(dirname(localPath), { recursive: true });
                            }
                            const fd = openSync(localPath, fsFlags);
                            const handle = allocateHandle({ type: "file", fd, localPath, remotePath: normalized });
                            sftp.handle(reqid, handle);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("READ", (reqid, handle, offset, length) => {
                        const entry = getHandleEntry(handle);
                        if (!entry || entry.type !== "file") {
                            sftp.status(reqid, STATUS_CODE.FAILURE);
                            return;
                        }
                        const respond = () => {
                            try {
                                const stats = statSync(entry.localPath);
                                if (offset >= stats.size) {
                                    sftp.status(reqid, STATUS_CODE.EOF);
                                    return;
                                }
                                const size = Math.min(length, stats.size - offset);
                                const buffer = Buffer.alloc(size);
                                const bytesRead = readSync(entry.fd, buffer, 0, size, offset);
                                sftp.data(reqid, buffer.subarray(0, bytesRead));
                            } catch (err) {
                                sftp.status(reqid, mapStatusCode(err));
                            }
                        };
                        if (readDelayMs > 0) {
                            setTimeout(respond, readDelayMs);
                            return;
                        }
                        respond();
                    }).on("WRITE", (reqid, handle, offset, data) => {
                        const entry = getHandleEntry(handle);
                        if (!entry || entry.type !== "file") {
                            sftp.status(reqid, STATUS_CODE.FAILURE);
                            return;
                        }
                        const respond = () => {
                            try {
                                writeSync(entry.fd, data, 0, data.length, offset);
                                sftp.status(reqid, STATUS_CODE.OK);
                            } catch (err) {
                                sftp.status(reqid, mapStatusCode(err));
                            }
                        };
                        if (writeDelayMs > 0) {
                            setTimeout(respond, writeDelayMs);
                            return;
                        }
                        respond();
                    }).on("CLOSE", (reqid, handle) => {
                        const handleId = Buffer.isBuffer(handle) && handle.length === 4 ? handle.readUInt32BE(0) : null;
                        const entry = handleId !== null ? openHandles.get(handleId) : null;
                        if (!entry) {
                            sftp.status(reqid, STATUS_CODE.FAILURE);
                            return;
                        }
                        try {
                            if (entry.type === "file") closeSync(entry.fd);
                            openHandles.delete(handleId);
                            sftp.status(reqid, STATUS_CODE.OK);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("MKDIR", (reqid, requestedPath) => {
                        const { localPath } = toLocalPath(requestedPath);
                        try {
                            mkdirSync(localPath);
                            sftp.status(reqid, STATUS_CODE.OK);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("RENAME", (reqid, oldPath, newPath) => {
                        const from = toLocalPath(oldPath).localPath;
                        const to = toLocalPath(newPath).localPath;
                        try {
                            mkdirSync(dirname(to), { recursive: true });
                            renameSync(from, to);
                            sftp.status(reqid, STATUS_CODE.OK);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("REMOVE", (reqid, requestedPath) => {
                        const { localPath } = toLocalPath(requestedPath);
                        try {
                            unlinkSync(localPath);
                            sftp.status(reqid, STATUS_CODE.OK);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("SETSTAT", (reqid, requestedPath, attrs) => {
                        const { localPath } = toLocalPath(requestedPath);
                        try {
                            if (typeof attrs.mode === "number" && existsSync(localPath)) {
                                try { chmodSync(localPath, attrs.mode); } catch { /* best effort */ }
                            }
                            sftp.status(reqid, STATUS_CODE.OK);
                        } catch (err) {
                            sftp.status(reqid, mapStatusCode(err));
                        }
                    }).on("FSETSTAT", (reqid) => {
                        sftp.status(reqid, STATUS_CODE.OK);
                    });
                });
            });
        }).on("close", () => {
            clientConnections.delete(client);
        });
    });

    await new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => resolve());
        server.on("error", reject);
    });

    return {
        fingerprint: getInteropFingerprint(),
        port: server.address().port,
        connectionArgs: createConnectionArgs(server.address().port),
        async stop() {
            for (const client of clientConnections) {
                try { client.end(); } catch { /* ignore close races */ }
            }
            for (const entry of openHandles.values()) {
                if (entry.type === "file") {
                    try { closeSync(entry.fd); } catch { /* ignore double close */ }
                }
            }
            await new Promise((resolve) => server.close(() => resolve()));
            rmSync(rootDir, { recursive: true, force: true });
        },
    };
}
