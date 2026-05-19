import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadFile, uploadFile } from "../lib/transfer.mjs";
import { closeAllConnections, executeCommand } from "../lib/ssh-client.mjs";
import {
    buildSessionMetadata,
    capabilitiesCommand,
    closeSessionCommand,
    execSessionCommand,
    gcSessionsCommand,
    newSessionId,
    nextSessionSeqCommand,
    openSessionCommand,
    parseCapabilitiesOutput,
    parseGcOutput,
    parseNextSeqOutput,
    parseSessionExecOutput,
    parseSessionReadOutput,
    readSessionCommand,
} from "../lib/session.mjs";
import { isDockerConfigured, startFallbackServer, startOpenSshFixture } from "./interop-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, "..");

const ENV_KEYS = [
    "ALLOWED_DIRS",
    "ALLOWED_HOST_FINGERPRINTS",
    "ALLOWED_LOCAL_DIRS",
    "KNOWN_HOSTS_PATH",
    "MAX_TRANSFER_BYTES",
    "SSH_PRIVATE_KEY",
    "TRANSFER_TIMEOUT_MS",
    "REMOTE_SSH_MODE",
];

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
let dockerAvailable = false;
let opensshFixture;

function restoreInteropEnv() {
    for (const key of ENV_KEYS) {
        if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
        else process.env[key] = ORIGINAL_ENV[key];
    }
}

function primeInteropEnv(fingerprint) {
    restoreInteropEnv();
    process.env.ALLOWED_HOST_FINGERPRINTS = fingerprint;
    delete process.env.KNOWN_HOSTS_PATH;
    delete process.env.SSH_PRIVATE_KEY;
}

async function withOpenSshLogsOnFailure(callback) {
    try {
        return await callback();
    } catch (err) {
        if (opensshFixture) {
            const logs = await opensshFixture.logs();
            if (logs) console.error(logs);
        }
        throw err;
    }
}

async function withMcpClient(callback, env = {}) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-ssh-interop", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "node",
        args: ["server.mjs"],
        cwd: CWD,
        stderr: "pipe",
        env: { ...process.env, ...env },
    });
    try {
        await client.connect(transport);
        return await callback(client);
    } finally {
        await transport.close().catch(() => {});
    }
}

function structuredContent(result) {
    return result.structuredContent || JSON.parse(result.content[0].text);
}

before(async () => {
    dockerAvailable = await isDockerConfigured();
    if (!dockerAvailable) {
        if (process.env.CI) {
            throw new Error("Docker Compose is required for hex-ssh interop tests in CI");
        }
        return;
    }
    opensshFixture = await startOpenSshFixture();
});

after(async () => {
    closeAllConnections();
    restoreInteropEnv();
    await opensshFixture?.stop();
});

afterEach(() => {
    closeAllConnections();
    restoreInteropEnv();
});

describe("hex-ssh interop", () => {
    it("runs persistent tmux sessions with paginated output and trusted cleanup", async (t) => {
        if (!dockerAvailable || !opensshFixture) {
            t.skip("Docker-backed OpenSSH fixture is unavailable");
            return;
        }
        await withOpenSshLogsOnFailure(async () => {
            primeInteropEnv(opensshFixture.fingerprint);
            const conn = opensshFixture.connectionArgs;

            const capabilitiesResult = await executeCommand({ ...conn, command: capabilitiesCommand() });
            assert.equal(capabilitiesResult.exitCode, 0);
            const capabilities = parseCapabilitiesOutput(capabilitiesResult.output);
            assert.equal(capabilities.tmux_installed, true);
            assert.equal(capabilities.session_backend, "tmux");

            const sid = newSessionId();
            const metadata = buildSessionMetadata({ sid, name: "interop", ttlSeconds: 60 });
            const open = await executeCommand({ ...conn, command: openSessionCommand(metadata) });
            assert.equal(open.exitCode, 0, open.error || open.output);

            try {
                const seq1 = parseNextSeqOutput((await executeCommand({ ...conn, command: nextSessionSeqCommand(sid) })).output);
                const exec1 = await executeCommand({
                    ...conn,
                    command: execSessionCommand({ sid, seq: seq1, command: "pwd", waitSeconds: 10 }),
                    execTimeoutMs: 20_000,
                });
                assert.equal(exec1.exitCode, 0, exec1.error || exec1.output);
                const meta1 = parseSessionExecOutput(exec1.output);
                assert.equal(meta1.rc, 0);

                const read1 = await executeCommand({ ...conn, command: readSessionCommand({ sid, seq: seq1, stream: "stdout", offset: 0, limit: 10 }) });
                assert.match(parseSessionReadOutput(read1.output).content.trim(), /^\/home\/tester$/);

                const seq2 = parseNextSeqOutput((await executeCommand({ ...conn, command: nextSessionSeqCommand(sid) })).output);
                const exec2 = await executeCommand({
                    ...conn,
                    command: execSessionCommand({ sid, seq: seq2, command: "cd /tmp && pwd", waitSeconds: 10 }),
                    execTimeoutMs: 20_000,
                });
                assert.equal(exec2.exitCode, 0, exec2.error || exec2.output);

                const seq3 = parseNextSeqOutput((await executeCommand({ ...conn, command: nextSessionSeqCommand(sid) })).output);
                const exec3 = await executeCommand({
                    ...conn,
                    command: execSessionCommand({ sid, seq: seq3, command: "pwd; seq 1 120", waitSeconds: 10 }),
                    execTimeoutMs: 20_000,
                });
                assert.equal(exec3.exitCode, 0, exec3.error || exec3.output);
                const meta3 = parseSessionExecOutput(exec3.output);
                assert.equal(meta3.stdout_lines, 121);

                const firstPage = parseSessionReadOutput((await executeCommand({
                    ...conn,
                    command: readSessionCommand({ sid, seq: seq3, stream: "stdout", offset: 0, limit: 3 }),
                })).output);
                assert.deepEqual(firstPage.content.trim().split("\n"), ["/tmp", "1", "2"]);
                assert.equal(firstPage.total_lines, 121);

                const secondPage = parseSessionReadOutput((await executeCommand({
                    ...conn,
                    command: readSessionCommand({ sid, seq: seq3, stream: "stdout", offset: 119, limit: 5 }),
                })).output);
                assert.deepEqual(secondPage.content.trim().split("\n"), ["119", "120"]);
            } finally {
                const close = await executeCommand({ ...conn, command: closeSessionCommand(sid) });
                assert.equal(close.exitCode, 0, close.error || close.output);
            }
        });
    });

    it("runs the public MCP session workflow through returned next_commands", async (t) => {
        if (!dockerAvailable || !opensshFixture) {
            t.skip("Docker-backed OpenSSH fixture is unavailable");
            return;
        }
        await withOpenSshLogsOnFailure(async () => {
            primeInteropEnv(opensshFixture.fingerprint);
            const { host, user, port, privateKeyPath } = opensshFixture.connectionArgs;
            const connArgs = { host, user, port, privateKeyPath, execTimeoutMs: 20_000 };

            await withMcpClient(async (client) => {
                const opened = structuredContent(await client.callTool({
                    name: "ssh-session-open",
                    arguments: { ...connArgs, name: "public-interop", ttlSeconds: 60 },
                }));
                assert.equal(opened.status, "OK");
                assert.equal(opened.next_commands.exec.arguments.port, port);
                assert.equal(opened.next_commands.exec.arguments.privateKeyPath, privateKeyPath);
                assert.equal(opened.next_commands.exec.arguments.user, user);
                assert.equal(opened.next_commands.exec.arguments.execTimeoutMs, 20_000);
                assert.equal(opened.next_commands.exec.arguments.waitSeconds, 18);

                try {
                    const execArgs = opened.next_commands.exec.arguments;
                    const executed = structuredContent(await client.callTool({ name: "ssh-session-exec", arguments: execArgs }));
                    assert.equal(executed.status, "OK");
                    assert.equal(executed.rc, 0);

                    const readArgs = { ...opened.next_commands.read.arguments, seq: executed.seq, stream: "stdout", limit: 10 };
                    const read = structuredContent(await client.callTool({ name: "ssh-session-read", arguments: readArgs }));
                    assert.equal(read.status, "OK");
                    assert.match(read.content.trim(), /^\/home\/tester$/);
                } finally {
                    await client.callTool({ name: "ssh-session-close", arguments: opened.next_commands.close.arguments });
                }
            }, { REMOTE_SSH_MODE: "safe" });
        });
    });

    it("garbage-collects only expired trusted sessions", async (t) => {
        if (!dockerAvailable || !opensshFixture) {
            t.skip("Docker-backed OpenSSH fixture is unavailable");
            return;
        }
        await withOpenSshLogsOnFailure(async () => {
            primeInteropEnv(opensshFixture.fingerprint);
            const conn = opensshFixture.connectionArgs;
            const expiredSid = newSessionId();
            const activeSid = newSessionId();
            const expired = buildSessionMetadata({
                sid: expiredSid,
                ttlSeconds: 1,
                now: new Date(Date.now() - 120_000),
            });
            const active = buildSessionMetadata({ sid: activeSid, ttlSeconds: 3600 });

            const expiredOpen = await executeCommand({ ...conn, command: openSessionCommand(expired) });
            const activeOpen = await executeCommand({ ...conn, command: openSessionCommand(active) });
            assert.equal(expiredOpen.exitCode, 0, expiredOpen.error || expiredOpen.output);
            assert.equal(activeOpen.exitCode, 0, activeOpen.error || activeOpen.output);

            try {
                const gc = await executeCommand({ ...conn, command: gcSessionsCommand() });
                assert.equal(gc.exitCode, 0, gc.error || gc.output);
                assert.deepEqual(parseGcOutput(gc.output), [expiredSid]);

                const activeSeq = parseNextSeqOutput((await executeCommand({ ...conn, command: nextSessionSeqCommand(activeSid) })).output);
                const activeCheck = await executeCommand({
                    ...conn,
                    command: execSessionCommand({ sid: activeSid, seq: activeSeq, command: "pwd", waitSeconds: 10 }),
                    execTimeoutMs: 20_000,
                });
                assert.equal(activeCheck.exitCode, 0, activeCheck.error || activeCheck.output);
            } finally {
                await executeCommand({ ...conn, command: closeSessionCommand(activeSid) });
                await executeCommand({ ...conn, command: closeSessionCommand(expiredSid) });
            }
        });
    });

    it("exercises OpenSSH upload durability, overwrite handling, and remote allowlists", async (t) => {
        if (!dockerAvailable || !opensshFixture) {
            t.skip("Docker-backed OpenSSH fixture is unavailable");
            return;
        }
        await withOpenSshLogsOnFailure(async () => {
            primeInteropEnv(opensshFixture.fingerprint);
            process.env.ALLOWED_DIRS = "/tmp/hex-ssh-allowed";

            const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-open-upload-"));
            const localPath = join(tmpDir, "payload.bin");
            const remotePath = `/tmp/hex-ssh-allowed/${randomUUID()}/nested/payload.bin`;
            writeFileSync(localPath, "hello openssh");

            try {
                const first = await uploadFile(opensshFixture.connectionArgs, {
                    localPath,
                    remotePath,
                    verify: "stat",
                });
                assert.equal(first.durabilityPath, "openssh-ext");
                assert.equal(first.verify, "stat");

                await assert.rejects(
                    () => uploadFile(opensshFixture.connectionArgs, { localPath, remotePath }),
                    /DESTINATION_EXISTS/
                );

                writeFileSync(localPath, "replacement");
                const replaced = await uploadFile(opensshFixture.connectionArgs, {
                    localPath,
                    remotePath,
                    overwrite: true,
                    verify: "stat",
                });
                assert.equal(replaced.durabilityPath, "openssh-ext");

                await assert.rejects(
                    () => uploadFile(opensshFixture.connectionArgs, {
                        localPath,
                        remotePath: `/tmp/hex-ssh-denied/${randomUUID()}/payload.bin`,
                    }),
                    /PATH_OUTSIDE_ROOT/
                );
            } finally {
                rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });

    it("exercises OpenSSH download success and local allowlists", async (t) => {
        if (!dockerAvailable || !opensshFixture) {
            t.skip("Docker-backed OpenSSH fixture is unavailable");
            return;
        }
        await withOpenSshLogsOnFailure(async () => {
            primeInteropEnv(opensshFixture.fingerprint);

            const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-open-download-"));
            const allowedDir = join(tmpDir, "allowed");
            mkdirSync(allowedDir, { recursive: true });
            process.env.ALLOWED_LOCAL_DIRS = allowedDir;

            const localPath = join(allowedDir, "app.log");
            const result = await downloadFile(opensshFixture.connectionArgs, {
                remotePath: "/tmp/hex-ssh-download/app.log",
                localPath,
                verify: "stat",
            });

            try {
                assert.equal(result.verify, "stat");
                assert.equal(result.durabilityPath, "standard");
                assert.match(readFileSync(localPath, "utf8"), /remote log from openssh/);

                await assert.rejects(
                    () => downloadFile(opensshFixture.connectionArgs, {
                        remotePath: "/tmp/hex-ssh-download/app.log",
                        localPath: join(tmpDir, "outside", "app.log"),
                    }),
                    /PATH_OUTSIDE_ROOT/
                );
            } finally {
                rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });

    it("uses the standard finalize path when OpenSSH durability extensions are unavailable", async () => {
        const uploadFallback = await startFallbackServer();
        const remotePath = `/srv/${randomUUID()}/download.bin`;
        const downloadFallback = await startFallbackServer({
            files: new Map([[remotePath, Buffer.from("fallback download", "utf8")]]),
        });
        const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-fallback-success-"));
        const localUploadPath = join(tmpDir, "upload.bin");
        const localDownloadPath = join(tmpDir, "download.bin");
        writeFileSync(localUploadPath, "fallback upload");

        try {
            primeInteropEnv(uploadFallback.fingerprint);
            const upload = await uploadFile(uploadFallback.connectionArgs, {
                localPath: localUploadPath,
                remotePath: `/srv/${randomUUID()}/payload.bin`,
                verify: "stat",
            });
            assert.equal(upload.durabilityPath, "standard");

            primeInteropEnv(downloadFallback.fingerprint);
            const download = await downloadFile(downloadFallback.connectionArgs, {
                remotePath,
                localPath: localDownloadPath,
                verify: "stat",
            });
            assert.equal(download.durabilityPath, "standard");
            assert.equal(readFileSync(localDownloadPath, "utf8"), "fallback download");
        } finally {
            rmSync(tmpDir, { recursive: true, force: true });
            await uploadFallback.stop();
            await downloadFallback.stop();
        }
    });

    it("reports FILE_NOT_FOUND against the fallback backend", async () => {
        const fallback = await startFallbackServer();
        const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-fallback-missing-"));

        try {
            primeInteropEnv(fallback.fingerprint);
            await assert.rejects(
                () => downloadFile(fallback.connectionArgs, {
                    remotePath: "/srv/missing.bin",
                    localPath: join(tmpDir, "missing.bin"),
                }),
                /FILE_NOT_FOUND/
            );
        } finally {
            rmSync(tmpDir, { recursive: true, force: true });
            await fallback.stop();
        }
    });

    it("reports VERIFY_FAILED when fallback stat data disagrees with the uploaded size", async () => {
        const remotePath = `/srv/${randomUUID()}/verify.bin`;
        const fallback = await startFallbackServer({
            statSizeOverrides: new Map([[remotePath, 1]]),
        });
        const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-fallback-verify-"));
        const localPath = join(tmpDir, "verify.bin");
        writeFileSync(localPath, "verify me");

        try {
            primeInteropEnv(fallback.fingerprint);
            await assert.rejects(
                () => uploadFile(fallback.connectionArgs, {
                    localPath,
                    remotePath,
                    verify: "stat",
                }),
                /VERIFY_FAILED/
            );
        } finally {
            rmSync(tmpDir, { recursive: true, force: true });
            await fallback.stop();
        }
    });

    it("reports TRANSFER_TIMEOUT when the fallback backend stalls a download", async () => {
        const remotePath = `/srv/${randomUUID()}/timeout.bin`;
        const fallback = await startFallbackServer({
            files: new Map([[remotePath, Buffer.from("timeout payload", "utf8")]]),
            readDelayMs: 80,
        });
        const tmpDir = mkdtempSync(join(tmpdir(), "hex-ssh-fallback-timeout-"));

        try {
            primeInteropEnv(fallback.fingerprint);
            process.env.TRANSFER_TIMEOUT_MS = "20";
            await assert.rejects(
                () => downloadFile(fallback.connectionArgs, {
                    remotePath,
                    localPath: join(tmpDir, "timeout.bin"),
                }),
                /TRANSFER_TIMEOUT/
            );
        } finally {
            rmSync(tmpDir, { recursive: true, force: true });
            await fallback.stop();
        }
    });
});
