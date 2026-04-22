import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadFile, uploadFile } from "../lib/transfer.mjs";
import { closeAllConnections } from "../lib/ssh-client.mjs";
import { isDockerConfigured, startFallbackServer, startOpenSshFixture } from "./interop-fixtures.mjs";

const ENV_KEYS = [
    "ALLOWED_DIRS",
    "ALLOWED_HOST_FINGERPRINTS",
    "ALLOWED_LOCAL_DIRS",
    "KNOWN_HOSTS_PATH",
    "MAX_TRANSFER_BYTES",
    "SSH_PRIVATE_KEY",
    "TRANSFER_TIMEOUT_MS",
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
