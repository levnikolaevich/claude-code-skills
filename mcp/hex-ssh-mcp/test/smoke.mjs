import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, posix as pathPosix, win32 as pathWin32 } from "node:path";
import { tmpdir } from "node:os";

const defer = (callback) => process.nextTick(callback);

function makeExecStream(stdout = "", stderr = "", exitCode = 0) {
    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    stream.close = () => stream.emit("close", exitCode);
    defer(() => {
        if (stdout) stream.emit("data", Buffer.from(stdout));
        if (stderr) stream.stderr.emit("data", Buffer.from(stderr));
        stream.emit("close", exitCode);
    });
    return stream;
}

function remotePathLib(filePath) {
    return /^(?:[a-zA-Z]:\\|\\\\)/.test(filePath) ? pathWin32 : pathPosix;
}

function parentRemoteDir(filePath) {
    const lib = remotePathLib(filePath);
    const parent = lib.dirname(filePath);
    const root = lib.parse(filePath).root || "/";
    return parent === "." ? root : parent;
}

function seedRemoteDirs(remoteFiles, remoteDirs) {
    remoteDirs.add("/");
    for (const filePath of remoteFiles.keys()) {
        const lib = remotePathLib(filePath);
        const root = lib.parse(filePath).root || "/";
        remoteDirs.add(root);
        const parent = lib.dirname(filePath);
        if (parent === root || parent === ".") continue;
        const parts = parent.slice(root.length).split(lib === pathWin32 ? /[\\/]+/ : /\//).filter(Boolean);
        let current = root;
        for (const part of parts) {
            current = current ? lib.join(current, part) : part;
            remoteDirs.add(current);
        }
    }
}

function makeStats(size, kind = "file") {
    return {
        size,
        isFile: () => kind === "file",
        isDirectory: () => kind === "dir",
    };
}

function makeDelayedReadable(buffer, delayMs) {
    const stream = new PassThrough();
    setTimeout(() => stream.end(buffer), delayMs);
    return stream;
}

function makeFakeClient(remoteFiles, execLog, options = {}) {
    const remoteDirs = options.remoteDirs || new Set(["/"]);
    const sftpLog = options.sftpLog || [];
    const remoteMeta = options.remoteMeta || new Map();
    const statSizeOverrides = options.statSizeOverrides || new Map();
    const readDelayMs = options.readDelayMs || 0;
    const enablePosixRename = options.enablePosixRename || false;
    const enableFsync = options.enableFsync || false;
    seedRemoteDirs(remoteFiles, remoteDirs);

    const handlers = new Map();

    return {
        _sock: { writable: false },
        on(event, callback) {
            handlers.set(event, callback);
            return this;
        },
        connect() {
            this._sock.writable = true;
            defer(() => handlers.get("ready")?.());
        },
        end() {
            this._sock.writable = false;
        },
        exec(command, callback) {
            execLog.push(command);
            if (command.startsWith("rm -f --")) {
                const match = command.match(/rm -f -- '([^']+)'/);
                if (match) remoteFiles.delete(match[1]);
            }
            defer(() => callback(null, makeExecStream("", "", 0)));
        },
        sftp(callback) {
            const sftp = {
                createWriteStream(filePath, streamOptions = {}) {
                    const stream = new PassThrough();
                    const chunks = [];
                    defer(() => {
                        const parentDir = parentRemoteDir(filePath);
                        if (!remoteDirs.has(parentDir)) {
                            stream.destroy(new Error(`No such directory: ${parentDir}`));
                            return;
                        }
                        stream.handle = Buffer.from(filePath);
                        stream.emit("open", stream.handle);
                        stream.emit("ready");
                    });
                    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                    stream.on("finish", () => {
                        remoteFiles.set(filePath, Buffer.concat(chunks));
                        remoteMeta.set(filePath, {
                            ...(remoteMeta.get(filePath) || {}),
                            mode: streamOptions.mode,
                        });
                    });
                    return stream;
                },
                createReadStream(filePath) {
                    if (!remoteFiles.has(filePath)) {
                        const stream = new PassThrough();
                        defer(() => stream.destroy(new Error(`No such file: ${filePath}`)));
                        return stream;
                    }
                    const buffer = remoteFiles.get(filePath);
                    return readDelayMs > 0 ? makeDelayedReadable(buffer, readDelayMs) : Readable.from(buffer);
                },
                stat(filePath, callback) {
                    defer(() => {
                        if (remoteFiles.has(filePath)) {
                            callback(null, makeStats(
                                statSizeOverrides.has(filePath) ? statSizeOverrides.get(filePath) : remoteFiles.get(filePath).length,
                                "file"
                            ));
                            return;
                        }
                        if (remoteDirs.has(filePath)) {
                            callback(null, makeStats(0, "dir"));
                            return;
                        }
                        callback(new Error(`No such file: ${filePath}`));
                    });
                },
                rename(fromPath, toPath, callback) {
                    defer(() => {
                        if (!remoteFiles.has(fromPath)) {
                            callback(new Error(`No such file: ${fromPath}`));
                            return;
                        }
                        remoteFiles.set(toPath, remoteFiles.get(fromPath));
                        remoteFiles.delete(fromPath);
                        remoteMeta.set(toPath, remoteMeta.get(fromPath) || {});
                        remoteMeta.delete(fromPath);
                        callback(null);
                    });
                },
                ext_openssh_rename(fromPath, toPath, callback) {
                    if (!enablePosixRename) {
                        throw new Error("Server does not support this extended request");
                    }
                    sftpLog.push(`posix-rename:${fromPath}->${toPath}`);
                    return this.rename(fromPath, toPath, callback);
                },
                ext_openssh_fsync(handle, callback) {
                    if (!enableFsync) {
                        throw new Error("Server does not support this extended request");
                    }
                    sftpLog.push(`fsync:${handle.toString()}`);
                    defer(() => callback(null));
                },
                close(handle, callback) {
                    sftpLog.push(`close:${handle.toString()}`);
                    defer(() => callback(null));
                },
                chmod(filePath, mode, callback) {
                    remoteMeta.set(filePath, {
                        ...(remoteMeta.get(filePath) || {}),
                        mode,
                    });
                    sftpLog.push(`chmod:${filePath}:${mode}`);
                    defer(() => callback(null));
                },
                mkdir(filePath, callback) {
                    remoteDirs.add(filePath);
                    sftpLog.push(`mkdir:${filePath}`);
                    defer(() => callback(null));
                },
                unlink(filePath, callback) {
                    remoteFiles.delete(filePath);
                    remoteMeta.delete(filePath);
                    sftpLog.push(`unlink:${filePath}`);
                    defer(() => callback(null));
                },
                end() {},
            };
            defer(() => callback(null, sftp));
        },
    };
}

// ==================== hash cross-verification ====================

describe("FNV-1a hash (cross-verify with hex-line)", () => {
    it("produces same hashes as hex-line for same content", async () => {
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");

        const h1 = fnv1a("const x = 1;");
        const h2 = fnv1a("const x = 1;");
        assert.equal(h1, h2, "Same content same hash");

        const tag = lineTag(h1);
        assert.match(tag, /^[a-z2-7]{2}$/, "Tag is 2-char base32");

        const cs = rangeChecksum([h1, h2], 1, 2);
        assert.match(cs, /^\d+-\d+:[0-9a-f]{8}$/, "Checksum format: start-end:hex8");
    });
});

// ==================== normalize ====================

describe("normalize output", () => {
    it("deduplicates identical lines with (xN)", async () => {
        const { deduplicateLines } = await import("@levnikolaevich/hex-common/output/normalize");
        const lines = ["ok", "error: timeout", "error: timeout", "error: timeout", "done"];
        const result = deduplicateLines(lines);
        const joined = result.join("\n");
        assert.ok(joined.includes("(x3)"), "Repeated 3x gets count");
        assert.ok(joined.includes("ok"), "Unique lines kept");
    });

    it("smartTruncate keeps head + tail, omits middle", async () => {
        const { smartTruncate } = await import("@levnikolaevich/hex-common/output/normalize");
        const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
        const result = smartTruncate(text, 5, 3);
        assert.ok(result.includes("line 1"), "Head kept");
        assert.ok(result.includes("line 100"), "Tail kept");
        assert.ok(result.includes("omitted"), "Gap indicator");
        assert.ok(!result.includes("line 50"), "Middle omitted");
    });
});

// ==================== ssh-edit-block anchor-only contract ====================

describe("ssh-edit-block anchor-only contract", () => {
    let validateEditArgs;
    before(async () => {
        ({ validateEditArgs } = await import("../lib/edit-validation.mjs"));
    });

    it("accepts all valid anchor modes", () => {
        assert.equal(validateEditArgs({ anchor: "ab.42", newText: "y" }), null);
        assert.equal(validateEditArgs({ startAnchor: "ab.10", endAnchor: "cd.15", newText: "y" }), null);
        assert.equal(validateEditArgs({ insertAfter: "ab.20", newText: "y" }), null);
    });

    it("rejects invalid args (text-mode, partial range, missing newText, conflicting modes)", () => {
        assert.ok(validateEditArgs({ oldText: "x", newText: "y" })?.includes("Required: anchor"));
        assert.ok(validateEditArgs({ startAnchor: "ab.10", newText: "y" })?.includes("Incomplete range"));
        assert.ok(validateEditArgs({ endAnchor: "cd.15", newText: "y" })?.includes("Incomplete range"));
        assert.ok(validateEditArgs({ anchor: "ab.42" })?.includes("Required: newText"));
        assert.ok(validateEditArgs({ anchor: "ab.42", insertAfter: "cd.15", newText: "y" })?.includes("Conflicting"));
    });
});

// ==================== host key verification ====================

describe("host key verification", () => {
    let buildHostVerifier;
    before(async () => {
        ({ buildHostVerifier } = await import("../lib/host-verify.mjs"));
    });

    it("rejects unknown host (fail-closed)", () => {
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        const verifier = buildHostVerifier("unknown.host");
        assert.equal(verifier(Buffer.from("fake-key")), false);
        delete process.env.KNOWN_HOSTS_PATH;
    });

    it("accepts matching SHA256 fingerprint from env", () => {
        const fakeKey = Buffer.from("test-key-data");
        const fp = "SHA256:" + createHash("sha256").update(fakeKey).digest("base64").replace(/=+$/, "");
        process.env.ALLOWED_HOST_FINGERPRINTS = fp;
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        const verifier = buildHostVerifier("any.host");
        assert.equal(verifier(fakeKey), true);
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        delete process.env.KNOWN_HOSTS_PATH;
    });

    it("rejects non-matching fingerprint", () => {
        process.env.ALLOWED_HOST_FINGERPRINTS = "SHA256:wrongwrongwrong";
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        const verifier = buildHostVerifier("any.host");
        assert.equal(verifier(Buffer.from("actual-key")), false);
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        delete process.env.KNOWN_HOSTS_PATH;
    });

    it("accepts matching fingerprint from a hashed known_hosts entry", () => {
        const fakeKey = Buffer.from("hashed-host-key");
        const salt = Buffer.from("0123456789abcdef0123");
        const host = "hashed.example.test";
        const hostHash = createHmac("sha1", salt).update(host).digest("base64");
        const keyB64 = fakeKey.toString("base64");
        const dir = mkdtempSync(join(tmpdir(), "hex-ssh-known-hosts-"));
        const knownHostsPath = join(dir, "known_hosts");
        writeFileSync(knownHostsPath, `|1|${salt.toString("base64")}|${hostHash} ssh-ed25519 ${keyB64}\n`);
        process.env.KNOWN_HOSTS_PATH = knownHostsPath;
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        try {
            const verifier = buildHostVerifier(host);
            assert.equal(verifier(fakeKey), true);
        } finally {
            delete process.env.KNOWN_HOSTS_PATH;
        }
    });
});

// ==================== shell escaping ====================

describe("shell escaping", () => {
    let shellQuote, assertSafeArg;
    before(async () => {
        ({ shellQuote, assertSafeArg } = await import("../lib/shell-escape.mjs"));
    });

    it("shellQuote handles quotes, backticks and $() injection", () => {
        assert.equal(shellQuote("it's"), "'it'\\''s'");
        assert.equal(shellQuote("$(whoami)"), "'$(whoami)'");
        assert.equal(shellQuote("`id`"), "'`id`'");
    });

    it("assertSafeArg rejects null bytes and newlines", () => {
        assert.throws(() => assertSafeArg("p", "/var\0/etc"), /UNSAFE_ARG/);
        assert.throws(() => assertSafeArg("p", "/var\n/etc"), /UNSAFE_ARG/);
        assertSafeArg("p", "/var/www/app/file.js"); // normal path — no throw
    });
});

// ==================== path validation ====================

describe("path validation", () => {
    let validateRemotePath;
    before(async () => {
        ({ validateRemotePath } = await import("../lib/ssh-client.mjs"));
    });

    it("rejects relative path and .. traversal", () => {
        assert.throws(() => validateRemotePath("relative/path"), /BAD_PATH/);
        process.env.ALLOWED_DIRS = "/home/deploy";
        assert.throws(() => validateRemotePath("/home/deploy/../../etc/passwd"), /PATH_OUTSIDE_ROOT/);
        delete process.env.ALLOWED_DIRS;
    });

    it("accepts valid paths and canonicalizes both sides", () => {
        process.env.ALLOWED_DIRS = "/home/deploy/../deploy";
        assert.doesNotThrow(() => validateRemotePath("/home/deploy/app/server.js"));
        delete process.env.ALLOWED_DIRS;
    });

    it("supports Windows remote paths with auto-detection or explicit remotePlatform", () => {
        process.env.ALLOWED_DIRS = "C:\\deploy";
        try {
            const autoDetected = validateRemotePath("C:/deploy/app/server.js");
            assert.equal(autoDetected.platform, "windows");
            assert.equal(autoDetected.canonical, "C:\\deploy\\app\\server.js");

            const explicit = validateRemotePath("/C:/deploy/app/server.js", "windows");
            assert.equal(explicit.canonical, "C:\\deploy\\app\\server.js");

            assert.throws(() => validateRemotePath("C:\\other\\server.js", "windows"), /PATH_OUTSIDE_ROOT/);
        } finally {
            delete process.env.ALLOWED_DIRS;
        }
    });
});

// ==================== command policy ====================

describe("command policy", () => {
    let validateCommand;
    before(async () => {
        ({ validateCommand } = await import("../lib/command-policy.mjs"));
    });

    it("disabled by default, blocks in safe mode", () => {
        delete process.env.REMOTE_SSH_MODE;
        assert.ok(validateCommand("ls")?.includes("REMOTE_SSH_DISABLED"));
        process.env.REMOTE_SSH_MODE = "safe";
        assert.ok(validateCommand("rm -rf /")?.includes("BLOCKED_COMMAND"));
        assert.ok(validateCommand(":(){ :|:& };:")?.includes("BLOCKED_COMMAND"));
        assert.equal(validateCommand("ls -la /home/deploy"), null);
        delete process.env.REMOTE_SSH_MODE;
    });

    it("allows everything in open mode", () => {
        process.env.REMOTE_SSH_MODE = "open";
        assert.equal(validateCommand("rm -rf /"), null);
        delete process.env.REMOTE_SSH_MODE;
    });
});


// ==================== persistent sessions ====================

describe("persistent session helpers", () => {
    let session;
    before(async () => {
        session = await import("../lib/session.mjs");
    });

    it("generates safe session ids and tmux names", () => {
        const sid = session.newSessionId();
        assert.match(sid, /^[a-f0-9]{8}$/);
        assert.equal(session.tmuxNameForSid("abcdef12"), "hex_ssh_abcdef12");
        assert.throws(() => session.tmuxNameForSid("bad/session"), /INVALID_SESSION/);
    });

    it("builds trusted metadata and cleanup guards", () => {
        const metadata = session.buildSessionMetadata({
            sid: "abcdef12",
            name: "deploy",
            ttlSeconds: 60,
            now: new Date("2026-05-19T00:00:00Z"),
        });
        assert.equal(metadata.created_by, "hex-ssh-mcp");
        assert.equal(metadata.tmux_name, "hex_ssh_abcdef12");
        assert.equal(metadata.expires_at_epoch, metadata.created_at_epoch + 60);

        const closeCommand = session.closeSessionCommand("abcdef12");
        assert.match(closeCommand, /created_by/);
        assert.match(closeCommand, /grep -Fq/);
        assert.match(closeCommand, /METADATA_VALIDATION_FAILED/);
        assert.match(closeCommand, /tmux kill-session/);
        assert.throws(() => session.closeSessionCommand("../bad"), /INVALID_SESSION/);
    });

    it("generates guarded session exec and sequence commands", () => {
        const openCommand = session.openSessionCommand(session.buildSessionMetadata({ sid: "abcdef12" }));
        assert.match(openCommand, /tmux new-session/);

        const execCommand = session.execSessionCommand({ sid: "abcdef12", seq: 1, command: "pwd", waitSeconds: 1 });
        assert.match(execCommand, /__hex_ssh_session_dir/);
        assert.doesNotMatch(execCommand, /HEX_SSH_SESSION_DIR:-/);
        assert.match(execCommand, /unalias -a/);
        assert.match(execCommand, /send-keys -l/);
        assert.match(execCommand, /tmux kill-session/);
        assert.match(execCommand, /__HEX_SSH_TIMEOUT__/);

        const seqCommand = session.nextSessionSeqCommand("abcdef12");
        assert.match(seqCommand, /seq\.lock/);
        assert.match(seqCommand, /SESSION_BUSY/);
    });

    it("parses session exec metadata and read pagination", () => {
        const exec = session.parseSessionExecOutput("__HEX_SSH_RC__=7\n__HEX_SSH_STDOUT_LINES__=2\n__HEX_SSH_STDERR_LINES__=1\n");
        assert.deepEqual(exec, { rc: 7, stdout_lines: 2, stderr_lines: 1 });
        assert.throws(() => session.parseSessionExecOutput("no markers"), /BAD_SESSION_STATE/);

        const page = session.parseSessionReadOutput("a\nb\n__HEX_SSH_TOTAL_LINES__=5\n");
        assert.deepEqual(page, { content: "a\nb", total_lines: 5 });
        assert.throws(() => session.parseSessionReadOutput("__HEX_SSH_NOT_FOUND__\n"), /OUTPUT_NOT_FOUND/);
    });

    it("validates session read arguments and parses gc output", () => {
        assert.throws(() => session.readSessionCommand({ sid: "abcdef12", seq: 1, stream: "bad", offset: 0, limit: 1 }), /INVALID_STREAM/);
        assert.throws(() => session.readSessionCommand({ sid: "abcdef12", seq: 1, stream: "stdout", offset: -1, limit: 1 }), /INVALID_PAGINATION/);
        assert.deepEqual(session.parseGcOutput("abcdef12\n\nabcdef13\n"), ["abcdef12", "abcdef13"]);
    });

    it("rejects terminal control characters in session commands", () => {
        assert.doesNotThrow(() => session.assertSafeSessionCommand("printf 'ok'"));
        assert.throws(() => session.assertSafeSessionCommand("\u0015echo owned"), /terminal control characters/);
        assert.throws(() => session.execSessionCommand({ sid: "abcdef12", seq: 1, command: "echo\u0003owned", waitSeconds: 1 }), /terminal control characters/);
    });
});


// ==================== SSH config resolution ====================

describe("SSH config resolution", () => {
    let resolveHost;
    before(async () => {
        ({ resolveHost } = await import("../lib/config-resolver.mjs"));
    });

    it("resolves alias from SSH config content", async () => {
        // Use SSH_CONFIG_PATH to point at a test fixture
        const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const tmpDir = mkdtempSync(join(os.tmpdir(), "ssh-test-"));
        const configPath = join(tmpDir, "config");
        writeFileSync(configPath, [
            "Host myserver",
            "  HostName 10.0.0.1",
            "  User deploy",
            "  Port 2222",
            `  IdentityFile ${join(tmpDir, "key")}`,
            "",
        ].join("\n"));
        // Create a fake key file so identityFiles resolves
        writeFileSync(join(tmpDir, "key"), "fake-key");

        process.env.SSH_CONFIG_PATH = configPath;
        try {
            const result = resolveHost("myserver");
            assert.equal(result.host, "10.0.0.1");
            assert.equal(result.user, "deploy");
            assert.equal(result.port, 2222);
            assert.equal(result.originalHost, "myserver");
            assert.ok(result.identityFiles.length >= 1);
            assert.ok(typeof result.port === "number", "Port must be number, not string");
        } finally {
            delete process.env.SSH_CONFIG_PATH;
            rmSync(tmpDir, { recursive: true });
        }
    });

    it("explicit args override config values", async () => {
        const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const tmpDir = mkdtempSync(join(os.tmpdir(), "ssh-test-"));
        const configPath = join(tmpDir, "config");
        writeFileSync(configPath, "Host myserver\n  HostName 10.0.0.1\n  User deploy\n  Port 2222\n");

        process.env.SSH_CONFIG_PATH = configPath;
        try {
            const result = resolveHost("myserver", { user: "admin", port: 3333 });
            assert.equal(result.user, "admin");
            assert.equal(result.port, 3333);
        } finally {
            delete process.env.SSH_CONFIG_PATH;
            rmSync(tmpDir, { recursive: true });
        }
    });

    it("missing config file returns fallback", async () => {
        process.env.SSH_CONFIG_PATH = "/nonexistent/ssh_config";
        try {
            const result = resolveHost("somehost", { user: "root" });
            assert.equal(result.host, "somehost");
            assert.equal(result.user, "root");
            assert.equal(result.port, 22);
        } finally {
            delete process.env.SSH_CONFIG_PATH;
        }
    });

    it("ProxyJump throws UNSUPPORTED_SSH_CONFIG", async () => {
        const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const tmpDir = mkdtempSync(join(os.tmpdir(), "ssh-test-"));
        const configPath = join(tmpDir, "config");
        writeFileSync(configPath, "Host jumphost\n  HostName 10.0.0.1\n  ProxyJump bastion\n");

        process.env.SSH_CONFIG_PATH = configPath;
        try {
            assert.throws(() => resolveHost("jumphost"), /UNSUPPORTED_SSH_CONFIG/);
        } finally {
            delete process.env.SSH_CONFIG_PATH;
            rmSync(tmpDir, { recursive: true });
        }
    });
});

// ==================== Host authorization (resolved-only) ====================

describe("host authorization", () => {

    it("ALLOWED_HOSTS checks resolved host only", async () => {
        const { resolveHost } = await import("../lib/config-resolver.mjs");
        const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const tmpDir = mkdtempSync(join(os.tmpdir(), "ssh-test-"));
        const configPath = join(tmpDir, "config");
        writeFileSync(configPath, "Host myalias\n  HostName 10.0.0.99\n  User root\n");

        process.env.SSH_CONFIG_PATH = configPath;
        try {
            const resolved = resolveHost("myalias");
            // The resolved host should be 10.0.0.99, not the alias
            assert.equal(resolved.host, "10.0.0.99");
            assert.equal(resolved.originalHost, "myalias");
            // ALLOWED_HOSTS would check 10.0.0.99, not myalias
        } finally {
            delete process.env.SSH_CONFIG_PATH;
            rmSync(tmpDir, { recursive: true });
        }
    });
});

// ==================== Connection pool ====================

describe("connection pool", () => {
    it("_setClientFactory exists as test seam", async () => {
        const { _setClientFactory } = await import("../lib/ssh-client.mjs");
        assert.equal(typeof _setClientFactory, "function");
    });

    it("closeAllConnections is exported", async () => {
        const { closeAllConnections } = await import("../lib/ssh-client.mjs");
        assert.equal(typeof closeAllConnections, "function");
        // Should not throw when pool is empty
        closeAllConnections();
    });
});


// ==================== Key resolution ====================

describe("key resolution", () => {
    it("normalizes Windows privateKeyPath backslashes to slash-compatible paths", async () => {
        const { normalizeLocalKeyPath } = await import("../lib/ssh-client.mjs");

        assert.equal(
            normalizeLocalKeyPath("C:\\Users\\levni\\.ssh\\my_contabo_vm"),
            "C:/Users/levni/.ssh/my_contabo_vm"
        );
        assert.equal(
            normalizeLocalKeyPath("C:/Users/levni/.ssh/my_contabo_vm"),
            "C:/Users/levni/.ssh/my_contabo_vm"
        );
        assert.equal(normalizeLocalKeyPath("/home/levni/.ssh/id_ed25519"), "/home/levni/.ssh/id_ed25519");
    });

    it("uses explicit privateKeyPath with Windows backslashes", { skip: process.platform !== "win32" }, async () => {
        const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { _setClientFactory, closeAllConnections, executeCommand } = await import("../lib/ssh-client.mjs");
        const keyContent = "fake-private-key-fixture\n";
        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-win-key-"));
        const keyPath = join(tmpDir, "id_fake");
        const connectOptions = [];

        writeFileSync(keyPath, keyContent);
        _setClientFactory(() => {
            const handlers = new Map();
            return {
                _sock: { writable: false },
                on(event, cb) { handlers.set(event, cb); return this; },
                connect(options) {
                    connectOptions.push(options);
                    this._sock.writable = true;
                    defer(() => handlers.get("ready")?.());
                },
                end() { this._sock.writable = false; },
                exec(_command, callback) {
                    defer(() => callback(null, makeExecStream("ok\n", "", 0)));
                },
            };
        });

        try {
            await executeCommand({
                host: "example.com",
                user: "deploy",
                port: 22,
                privateKeyPath: keyPath.replace(/\//g, "\\"),
                command: "true",
            });

            assert.equal(connectOptions.length, 1);
            assert.equal(connectOptions[0].privateKey.toString("utf8"), keyContent);
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

// ==================== Local transfer validation ====================

describe("local transfer validation", () => {
    it("rejects relative local paths and enforces ALLOWED_LOCAL_DIRS", async () => {
        const { mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { validateLocalPath } = await import("../lib/transfer.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-local-"));
        const allowedDir = join(tmpDir, "allowed");
        try {
            assert.throws(() => validateLocalPath("relative/file.txt"), /BAD_PATH/);
            process.env.ALLOWED_LOCAL_DIRS = allowedDir;
            assert.throws(() => validateLocalPath(join(tmpDir, "other", "file.txt")), /PATH_OUTSIDE_ROOT/);
            assert.equal(validateLocalPath(join(allowedDir, "nested", "file.txt")), join(allowedDir, "nested", "file.txt"));
        } finally {
            delete process.env.ALLOWED_LOCAL_DIRS;
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("uses MAX_TRANSFER_BYTES when validating size", async () => {
        const { validateTransferSize } = await import("../lib/transfer.mjs");
        process.env.MAX_TRANSFER_BYTES = "4";
        try {
            assert.throws(() => validateTransferSize(5, "payload.bin"), /FILE_TOO_LARGE/);
            assert.doesNotThrow(() => validateTransferSize(4, "payload.bin"));
        } finally {
            delete process.env.MAX_TRANSFER_BYTES;
        }
    });
});

// ==================== SFTP transfers ====================

describe("sftp transfers", () => {
    const _fakeKeyDir = mkdtempSync(join(tmpdir(), "hex-ssh-fakekey-"));
    const FAKE_KEY = join(_fakeKeyDir, "id_fake");
    writeFileSync(FAKE_KEY, "fake-private-key-fixture\n");
    it("uploads a local file with durable OpenSSH finalize and metadata", async () => {
        const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { uploadFile, formatTransferSummary } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-upload-"));
        const localPath = join(tmpDir, "payload.bin");
        const remoteFiles = new Map();
        const execLog = [];
        const sftpLog = [];
        const remoteMeta = new Map();
        writeFileSync(localPath, "hello upload");
        _setClientFactory(() => makeFakeClient(remoteFiles, execLog, {
            sftpLog,
            remoteMeta,
            enableFsync: true,
            enablePosixRename: true,
        }));

        try {
            const result = await uploadFile(
                { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                {
                    localPath,
                    remotePath: "/srv/app/nested/payload.bin",
                    permissions: "0640",
                    verify: "stat",
                }
            );

            assert.equal(remoteFiles.get("/srv/app/nested/payload.bin").toString("utf8"), "hello upload");
            assert.equal(execLog.length, 0, "upload should not need remote exec");
            assert.ok(sftpLog.includes("mkdir:/srv"), "recursive mkdir should create /srv");
            assert.ok(sftpLog.includes("mkdir:/srv/app"), "recursive mkdir should create /srv/app");
            assert.ok(sftpLog.includes("mkdir:/srv/app/nested"), "recursive mkdir should create nested dir");
            assert.ok(sftpLog.some((entry) => entry.startsWith("fsync:")), "OpenSSH fsync should run when available");
            assert.ok(sftpLog.some((entry) => entry.startsWith("posix-rename:")), "OpenSSH rename should run when available");
            assert.equal([...remoteFiles.keys()].filter((key) => key.includes(".hex-transfer-")).length, 0);
            assert.equal(result.bytesTransferred, "hello upload".length);
            assert.equal(result.verify, "stat");
            assert.equal(result.durabilityPath, "openssh-ext");
            assert.equal(remoteMeta.get("/srv/app/nested/payload.bin").mode, Number.parseInt("0640", 8));
            assert.match(
                formatTransferSummary(
                    "Uploaded",
                    result.localPath,
                    result.remotePath,
                    result.bytesTransferred,
                    result.durationMs,
                    result.verify,
                    result.durabilityPath
                ),
                /verify=stat durabilityPath=openssh-ext/
            );
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("rejects upload overwrite by default and allows it explicitly", async () => {
        const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { uploadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-upload-overwrite-"));
        const localPath = join(tmpDir, "payload.bin");
        const remoteFiles = new Map([
            ["/srv/app/payload.bin", Buffer.from("old", "utf8")],
        ]);
        writeFileSync(localPath, "new");
        _setClientFactory(() => makeFakeClient(remoteFiles, []));

        try {
            await assert.rejects(
                () => uploadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                    { localPath, remotePath: "/srv/app/payload.bin" }
                ),
                /DESTINATION_EXISTS/
            );
            await uploadFile(
                { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                { localPath, remotePath: "/srv/app/payload.bin", overwrite: true, verify: "none" }
            );
            assert.equal(remoteFiles.get("/srv/app/payload.bin").toString("utf8"), "new");
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("downloads a remote file to the local machine with verification", async () => {
        const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { downloadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-download-"));
        const localPath = join(tmpDir, "logs", "app.log");
        const remoteFiles = new Map([
            ["/var/log/app.log", Buffer.from("remote log", "utf8")],
        ]);
        const execLog = [];
        _setClientFactory(() => makeFakeClient(remoteFiles, execLog));

        try {
            const result = await downloadFile(
                { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                { remotePath: "/var/log/app.log", localPath, verify: "stat" }
            );

            assert.equal(readFileSync(localPath, "utf8"), "remote log");
            assert.equal(result.bytesTransferred, "remote log".length);
            assert.equal(result.verify, "stat");
            assert.equal(result.durabilityPath, "standard");
            assert.equal(execLog.length, 0, "download should not need remote exec");
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("uploads to a Windows remote path over SFTP", async () => {
        const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { uploadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-upload-win-"));
        const localPath = join(tmpDir, "payload.bin");
        const remoteFiles = new Map();
        const remoteDirs = new Set(["C:\\"]);
        writeFileSync(localPath, "windows upload");
        _setClientFactory(() => makeFakeClient(remoteFiles, [], { remoteDirs }));

        try {
            const result = await uploadFile(
                { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                { localPath, remotePath: "C:\\srv\\app\\payload.bin", overwrite: true, verify: "none", remotePlatform: "windows" }
            );
            assert.equal(result.remotePath, "C:\\srv\\app\\payload.bin");
            assert.equal(remoteFiles.get("C:\\srv\\app\\payload.bin").toString("utf8"), "windows upload");
            assert.ok(remoteDirs.has("C:\\srv"), "intermediate Windows directory created");
            assert.ok(remoteDirs.has("C:\\srv\\app"), "nested Windows directory created");
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("rejects download overwrite by default and allows it explicitly", async () => {
        const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { downloadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-download-overwrite-"));
        const localPath = join(tmpDir, "existing.log");
        const remoteFiles = new Map([
            ["/var/log/existing.log", Buffer.from("replacement", "utf8")],
        ]);
        writeFileSync(localPath, "old");
        _setClientFactory(() => makeFakeClient(remoteFiles, []));

        try {
            await assert.rejects(
                () => downloadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                    { remotePath: "/var/log/existing.log", localPath }
                ),
                /DESTINATION_EXISTS/
            );
            await downloadFile(
                { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                { remotePath: "/var/log/existing.log", localPath, overwrite: true, verify: "none" }
            );
            assert.equal(readFileSync(localPath, "utf8"), "replacement");
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("rejects oversized downloads before writing local content", async () => {
        const { existsSync, mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { downloadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-limit-"));
        const localPath = join(tmpDir, "large.bin");
        const remoteFiles = new Map([
            ["/srv/large.bin", Buffer.from("123456", "utf8")],
        ]);
        _setClientFactory(() => makeFakeClient(remoteFiles, []));
        process.env.MAX_TRANSFER_BYTES = "4";

        try {
            await assert.rejects(
                () => downloadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                    { remotePath: "/srv/large.bin", localPath }
                ),
                /FILE_TOO_LARGE/
            );
            assert.equal(existsSync(localPath), false);
        } finally {
            delete process.env.MAX_TRANSFER_BYTES;
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("fails verification when final remote size does not match expected upload size", async () => {
        const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { uploadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-verify-upload-"));
        const localPath = join(tmpDir, "payload.bin");
        const remoteFiles = new Map();
        const statSizeOverrides = new Map([
            ["/srv/app/payload.bin", 1],
        ]);
        writeFileSync(localPath, "abcdef");
        _setClientFactory(() => makeFakeClient(remoteFiles, [], { statSizeOverrides }));

        try {
            await assert.rejects(
                () => uploadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                    { localPath, remotePath: "/srv/app/payload.bin", verify: "stat" }
                ),
                /VERIFY_FAILED/
            );
        } finally {
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("fails with TRANSFER_TIMEOUT when download stalls", async () => {
        const { mkdtempSync, rmSync } = await import("node:fs");
        const { join } = await import("node:path");
        const os = await import("node:os");
        const { downloadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hex-ssh-timeout-"));
        const localPath = join(tmpDir, "timeout.bin");
        const remoteFiles = new Map([
            ["/srv/timeout.bin", Buffer.from("payload", "utf8")],
        ]);
        process.env.TRANSFER_TIMEOUT_MS = "20";
        _setClientFactory(() => makeFakeClient(remoteFiles, [], { readDelayMs: 60 }));

        try {
            await assert.rejects(
                () => downloadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [FAKE_KEY] },
                    { remotePath: "/srv/timeout.bin", localPath }
                ),
                /TRANSFER_TIMEOUT/
            );
        } finally {
            delete process.env.TRANSFER_TIMEOUT_MS;
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

// ==================== Per-call timeouts ====================

describe("per-call timeouts", () => {
    const _tmKeyDir = mkdtempSync(join(tmpdir(), "hex-ssh-tm-key-"));
    const TM_KEY = join(_tmKeyDir, "id_fake");
    writeFileSync(TM_KEY, "fake-private-key-fixture\n");

    it("exports DEFAULT_* timeout constants", async () => {
        const ssh = await import("../lib/ssh-client.mjs");
        assert.equal(ssh.DEFAULT_CONNECT_TIMEOUT_MS, 20_000);
        assert.equal(ssh.DEFAULT_KEEPALIVE_INTERVAL_MS, 30_000);
        assert.equal(ssh.DEFAULT_EXEC_TIMEOUT_MS, 120_000);
        const transfer = await import("../lib/transfer.mjs");
        assert.equal(transfer.DEFAULT_TRANSFER_TIMEOUT_MS, 120_000);
    });

    it("passes connect and keepalive timeouts to ssh2 and separates pooled connections", async () => {
        const { _setClientFactory, closeAllConnections, executeCommand } = await import("../lib/ssh-client.mjs");
        const connectOptions = [];
        _setClientFactory(() => {
            const handlers = new Map();
            return {
                _sock: { writable: false },
                on(event, cb) { handlers.set(event, cb); return this; },
                connect(options) {
                    connectOptions.push(options);
                    this._sock.writable = true;
                    defer(() => handlers.get("ready")?.());
                },
                end() { this._sock.writable = false; },
                exec(_command, callback) {
                    defer(() => callback(null, makeExecStream("ok\n", "", 0)));
                },
            };
        });
        try {
            const base = {
                host: "example.com",
                user: "deploy",
                port: 22,
                identityFiles: [TM_KEY],
                command: "true",
            };
            await executeCommand({ ...base, connectTimeoutMs: 1000, keepaliveIntervalMs: 11000 });
            await executeCommand({ ...base, connectTimeoutMs: 1000, keepaliveIntervalMs: 11000 });
            await executeCommand({ ...base, connectTimeoutMs: 2000, keepaliveIntervalMs: 22000 });

            assert.equal(connectOptions.length, 2, "same timeout tuple reuses pool; changed tuple opens a new connection");
            assert.equal(connectOptions[0].readyTimeout, 1000);
            assert.equal(connectOptions[0].keepaliveInterval, 11000);
            assert.equal(connectOptions[1].readyTimeout, 2000);
            assert.equal(connectOptions[1].keepaliveInterval, 22000);
        } finally {
            closeAllConnections();
        }
    });

    it("executeCommand rejects with EXEC_TIMEOUT when execTimeoutMs elapses", async () => {
        const { _setClientFactory, closeAllConnections, executeCommand } = await import("../lib/ssh-client.mjs");
        _setClientFactory(() => {
            const handlers = new Map();
            return {
                _sock: { writable: false },
                on(event, cb) { handlers.set(event, cb); return this; },
                connect() { this._sock.writable = true; defer(() => handlers.get("ready")?.()); },
                end() { this._sock.writable = false; },
                exec(_command, callback) {
                    // Stream that never emits "close" on its own — forces exec timeout to fire.
                    const stream = new EventEmitter();
                    stream.stderr = new EventEmitter();
                    stream.close = () => { /* real ssh2 close() is async; no-op here lets the exec timeout reject cleanly */ };
                    defer(() => callback(null, stream));
                },
            };
        });
        try {
            await assert.rejects(
                () => executeCommand({
                    host: "example.com", user: "deploy", port: 22,
                    identityFiles: [TM_KEY],
                    command: "sleep 5",
                    execTimeoutMs: 25,
                }),
                /EXEC_TIMEOUT: command exceeded 25ms limit/
            );
        } finally {
            closeAllConnections();
        }
    });

    it("downloadFile honors per-call transferTimeoutMs overriding env default", async () => {
        const { rmSync } = await import("node:fs");
        const { downloadFile } = await import("../lib/transfer.mjs");
        const { _setClientFactory, closeAllConnections } = await import("../lib/ssh-client.mjs");

        const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-percall-"));
        const localPath = join(tmpDir, "timeout.bin");
        const remoteFiles = new Map([["/srv/timeout.bin", Buffer.from("payload", "utf8")]]);
        process.env.TRANSFER_TIMEOUT_MS = "10000";
        _setClientFactory(() => makeFakeClient(remoteFiles, [], { readDelayMs: 80 }));
        try {
            await assert.rejects(
                () => downloadFile(
                    { host: "example.com", user: "deploy", port: 22, identityFiles: [TM_KEY] },
                    { remotePath: "/srv/timeout.bin", localPath, transferTimeoutMs: 20 }
                ),
                /TRANSFER_TIMEOUT: .* exceeded 20ms/
            );
        } finally {
            delete process.env.TRANSFER_TIMEOUT_MS;
            closeAllConnections();
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
