import {
    closeSync,
    createReadStream,
    createWriteStream,
    existsSync,
    fsyncSync,
    mkdirSync,
    openSync,
    renameSync,
    rmSync,
    statSync,
} from "node:fs";
import { once } from "node:events";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, posix as pathPosix, relative, resolve as resolvePath, win32 as pathWin32 } from "node:path";
import { pipeline } from "node:stream/promises";
import { withSftp, validateRemotePath } from "./ssh-client.mjs";
import { assertSafeArg } from "./shell-escape.mjs";

const DEFAULT_MAX_TRANSFER_BYTES = 128 * 1024 * 1024;
export const DEFAULT_TRANSFER_TIMEOUT_MS = 120_000;

function untildifyLocalPath(localPath) {
    if (localPath === "~") return homedir();
    if (localPath.startsWith("~/") || localPath.startsWith("~\\")) {
        return join(homedir(), localPath.slice(2));
    }
    return localPath;
}

function normalizeComparePath(filePath) {
    return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}

function isWithinRoot(filePath, rootPath) {
    const relativePath = relative(normalizeComparePath(rootPath), normalizeComparePath(filePath));
    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function remoteFileMissing(message) {
    return /no such file|not found|does not exist/i.test(message);
}

function unsupportedExtension(message) {
    return /does not support this extended request/i.test(message);
}

function tempRemotePath(remotePath) {
    return `${remotePath}.hex-transfer-${Date.now()}`;
}

function tempLocalPath(localPath) {
    return `${localPath}.hex-transfer-${Date.now()}`;
}

function sftpStat(sftp, remotePath) {
    return new Promise((resolve, reject) => {
        sftp.stat(remotePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
        });
    });
}

async function sftpStatMaybe(sftp, remotePath) {
    try {
        return await sftpStat(sftp, remotePath);
    } catch (err) {
        if (remoteFileMissing(err.message)) return null;
        throw err;
    }
}

function sftpRename(sftp, fromPath, toPath) {
    return new Promise((resolve, reject) => {
        sftp.rename(fromPath, toPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpPosixRename(sftp, fromPath, toPath) {
    return new Promise((resolve, reject) => {
        sftp.ext_openssh_rename(fromPath, toPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpFsync(sftp, handle) {
    return new Promise((resolve, reject) => {
        sftp.ext_openssh_fsync(handle, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpClose(sftp, handle) {
    return new Promise((resolve, reject) => {
        sftp.close(handle, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpUnlink(sftp, remotePath) {
    return new Promise((resolve, reject) => {
        sftp.unlink(remotePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpMkdir(sftp, remotePath) {
    return new Promise((resolve, reject) => {
        sftp.mkdir(remotePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function sftpChmod(sftp, remotePath, mode) {
    return new Promise((resolve, reject) => {
        sftp.chmod(remotePath, mode, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function getHandle(stream) {
    return Buffer.isBuffer(stream.handle) ? stream.handle : null;
}

function closeLocalHandle(filePath) {
    const fd = openSync(filePath, "r+");
    try {
        fsyncSync(fd);
    } finally {
        closeSync(fd);
    }
}

function getTransferTimeoutMs(override) {
    if (Number.isFinite(override) && override > 0) return override;
    const parsed = Number(process.env.TRANSFER_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TRANSFER_TIMEOUT_MS;
}

function resettableTransferTimer(label, streams, timeoutMs) {
    let timer = null;
    let timeoutError = null;
    const listeners = [];

    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timeoutError = new Error(`TRANSFER_TIMEOUT: ${label} exceeded ${timeoutMs}ms`);
            for (const stream of streams) {
                if (!stream || typeof stream.destroy !== "function" || stream.destroyed) continue;
                try { stream.destroy(timeoutError); } catch { /* ignore destroy races */ }
            }
        }, timeoutMs);
    };

    const watch = (stream, event) => {
        if (!stream?.on) return;
        const handler = () => arm();
        stream.on(event, handler);
        listeners.push([stream, event, handler]);
    };

    for (const stream of streams) {
        watch(stream, "open");
        watch(stream, "ready");
        watch(stream, "data");
        watch(stream, "drain");
    }
    arm();

    return {
        getError() {
            return timeoutError;
        },
        stop() {
            clearTimeout(timer);
            for (const [stream, event, handler] of listeners) {
                stream.off?.(event, handler);
            }
        },
    };
}

async function runTimedPipeline(label, source, destination, timeoutMs) {
    const timer = resettableTransferTimer(label, [source, destination], timeoutMs);
    try {
        await pipeline(source, destination);
    } catch (err) {
        if (timer.getError()) throw timer.getError();
        throw err;
    } finally {
        timer.stop();
    }
}

async function cleanupRemoteStaged(sftp, stagedRemotePath) {
    try {
        await sftpUnlink(sftp, stagedRemotePath);
    } catch {
        /* best effort cleanup */
    }
}

async function ensureRemoteDirectoryRecursive(sftp, remotePath, remotePlatform = "posix") {
    const pathLib = remotePlatform === "windows" ? pathWin32 : pathPosix;
    const targetDir = pathLib.dirname(remotePath);
    const root = pathLib.parse(targetDir).root;
    if (targetDir === root || targetDir === ".") return;

    const parts = targetDir.slice(root.length).split(remotePlatform === "windows" ? /[\\/]+/ : /\//).filter(Boolean);
    let current = root;
    for (const part of parts) {
        current = current ? pathLib.join(current, part) : part;
        const existing = await sftpStatMaybe(sftp, current);
        if (existing) {
            if (typeof existing.isDirectory === "function" && !existing.isDirectory()) {
                throw new Error(`TRANSFER_FAILED: remote parent path ${current} exists but is not a directory`);
            }
            continue;
        }
        try {
            await sftpMkdir(sftp, current);
        } catch (err) {
            const raced = await sftpStatMaybe(sftp, current);
            if (!raced) throw err;
        }
    }
}

function maybeExistingLocalPath(localPath) {
    return existsSync(localPath);
}

function replaceLocalDestination(stagedLocalPath, finalLocalPath) {
    if (!existsSync(finalLocalPath)) {
        renameSync(stagedLocalPath, finalLocalPath);
        return;
    }

    try {
        renameSync(stagedLocalPath, finalLocalPath);
        return;
    } catch (err) {
        if (process.platform !== "win32") throw err;
    }

    const backupPath = `${tempLocalPath(finalLocalPath)}.backup`;
    renameSync(finalLocalPath, backupPath);
    try {
        renameSync(stagedLocalPath, finalLocalPath);
        rmSync(backupPath, { force: true });
    } catch (err) {
        try {
            if (!existsSync(finalLocalPath) && existsSync(backupPath)) {
                renameSync(backupPath, finalLocalPath);
            }
        } catch {
            /* rollback best effort */
        }
        throw err;
    }
}

function normalizeVerifyMode(verify) {
    if (verify === undefined || verify === null) return "stat";
    if (verify === "none" || verify === "stat") return verify;
    throw new Error(`BAD_VERIFY: unsupported verify mode "${verify}"`);
}

function parsePermissionsMode(permissions) {
    if (permissions === undefined || permissions === null) return undefined;
    if (typeof permissions === "number" && Number.isInteger(permissions) && permissions >= 0) {
        return permissions;
    }
    if (typeof permissions === "string" && /^[0-7]{3,4}$/.test(permissions)) {
        return Number.parseInt(permissions, 8);
    }
    throw new Error(`BAD_PERMISSIONS: expected octal string like "0644", got "${permissions}"`);
}

function finalizeTransferError(err, fallbackMessage) {
    if (/^(FILE_NOT_FOUND|PATH_OUTSIDE_ROOT|FILE_TOO_LARGE|DESTINATION_EXISTS|TRANSFER_TIMEOUT|VERIFY_FAILED|BAD_PATH|BAD_VERIFY|BAD_PERMISSIONS): /.test(err.message)) {
        throw err;
    }
    throw new Error(`TRANSFER_FAILED: ${fallbackMessage}: ${err.message}`);
}

async function verifyRemoteStatSize(sftp, remotePath, expectedSize) {
    const finalStats = await sftpStat(sftp, remotePath);
    const actualSize = Number(finalStats?.size || 0);
    if (actualSize !== expectedSize) {
        throw new Error(`VERIFY_FAILED: remote destination ${remotePath} size ${actualSize} does not match expected ${expectedSize}`);
    }
}

function verifyLocalStatSize(localPath, expectedSize) {
    const finalStats = statSync(localPath);
    const actualSize = Number(finalStats.size || 0);
    if (actualSize !== expectedSize) {
        throw new Error(`VERIFY_FAILED: local destination ${localPath} size ${actualSize} does not match expected ${expectedSize}`);
    }
}

async function durableRemoteRename(sftp, stagedRemotePath, remotePath) {
    let usedExtension = false;
    try {
        await sftpPosixRename(sftp, stagedRemotePath, remotePath);
        usedExtension = true;
    } catch (err) {
        if (!unsupportedExtension(err.message)) throw err;
        await sftpRename(sftp, stagedRemotePath, remotePath);
    }
    return usedExtension;
}

async function durableRemoteFlush(sftp, handle) {
    if (!handle) return false;
    try {
        await sftpFsync(sftp, handle);
        return true;
    } catch (err) {
        if (!unsupportedExtension(err.message)) throw err;
        return false;
    }
}

export function getMaxTransferBytes() {
    const parsed = Number(process.env.MAX_TRANSFER_BYTES);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TRANSFER_BYTES;
}

export function validateTransferSize(size, label) {
    const limit = getMaxTransferBytes();
    if (size > limit) {
        throw new Error(`FILE_TOO_LARGE: ${label} is ${size} bytes and exceeds MAX_TRANSFER_BYTES=${limit}`);
    }
}

export function resolveLocalPath(localPath) {
    const expanded = untildifyLocalPath(localPath);
    if (!isAbsolute(expanded)) {
        throw new Error(`BAD_PATH: absolute local path required, got "${localPath}"`);
    }
    return resolvePath(expanded);
}

export function validateLocalPath(localPath) {
    assertSafeArg("localPath", localPath);
    const canonical = resolveLocalPath(localPath);
    const allowed = process.env.ALLOWED_LOCAL_DIRS;
    if (!allowed) return canonical;

    const dirs = allowed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(resolveLocalPath);
    if (dirs.length === 0) return canonical;

    const ok = dirs.some((dir) => isWithinRoot(canonical, dir));
    if (!ok) {
        throw new Error(
            `PATH_OUTSIDE_ROOT: "${localPath}" (resolved: "${canonical}") not under ALLOWED_LOCAL_DIRS. Permitted: ${dirs.join(", ")}`
        );
    }
    return canonical;
}

export function formatTransferSummary(
    action,
    sourcePath,
    destinationPath,
    bytesTransferred,
    durationMs,
    verify = "none",
    durabilityPath = "standard"
) {
    return `${action} ${sourcePath} -> ${destinationPath}\nbytes=${bytesTransferred} durationMs=${durationMs} verify=${verify} durabilityPath=${durabilityPath}`;
}

export async function uploadFile(connectionArgs, {
    localPath,
    remotePath,
    overwrite = false,
    verify,
    permissions,
    remotePlatform = "auto",
    transferTimeoutMs,
}) {
    assertSafeArg("remotePath", remotePath);
    const { platform, canonical: canonicalRemotePath } = validateRemotePath(remotePath, remotePlatform);

    const verifyMode = normalizeVerifyMode(verify);
    const remoteMode = parsePermissionsMode(permissions);
    const canonicalLocalPath = validateLocalPath(localPath);
    let localStats;
    try {
        localStats = statSync(canonicalLocalPath);
    } catch (err) {
        if (err.code === "ENOENT") {
            throw new Error(`FILE_NOT_FOUND: local file ${canonicalLocalPath} does not exist`);
        }
        throw err;
    }
    if (!localStats.isFile()) {
        throw new Error(`FILE_NOT_FOUND: local path ${canonicalLocalPath} is not a regular file`);
    }
    validateTransferSize(localStats.size, canonicalLocalPath);

    const stagedRemotePath = tempRemotePath(canonicalRemotePath);
    const startedAt = Date.now();
    let durabilityPath = "standard";

    try {
        await withSftp(connectionArgs, async (sftp) => {
            await ensureRemoteDirectoryRecursive(sftp, canonicalRemotePath, platform);

            const existing = await sftpStatMaybe(sftp, canonicalRemotePath);
            if (existing && !overwrite) {
                throw new Error(`DESTINATION_EXISTS: remote destination ${canonicalRemotePath} already exists`);
            }

            const writer = sftp.createWriteStream(stagedRemotePath, {
                autoClose: false,
                ...(remoteMode !== undefined ? { mode: remoteMode } : {}),
            });
            const reader = createReadStream(canonicalLocalPath);

            try {
                await once(writer, "open");
                await runTimedPipeline(`upload ${canonicalLocalPath} -> ${canonicalRemotePath}`, reader, writer, getTransferTimeoutMs(transferTimeoutMs));
                const handle = getHandle(writer);
                const usedFsync = await durableRemoteFlush(sftp, handle);
                if (handle) await sftpClose(sftp, handle);
                const usedRenameExtension = await durableRemoteRename(sftp, stagedRemotePath, canonicalRemotePath);
                durabilityPath = usedFsync || usedRenameExtension ? "openssh-ext" : "standard";
            } catch (err) {
                const handle = getHandle(writer);
                if (handle) {
                    try { await sftpClose(sftp, handle); } catch { /* ignore close errors */ }
                }
                await cleanupRemoteStaged(sftp, stagedRemotePath);
                throw err;
            }

            if (remoteMode !== undefined) {
                await sftpChmod(sftp, canonicalRemotePath, remoteMode);
            }
            if (verifyMode === "stat") {
                await verifyRemoteStatSize(sftp, canonicalRemotePath, localStats.size);
            }
        });
    } catch (err) {
        finalizeTransferError(err, `upload to ${canonicalRemotePath} failed`);
    }

    return {
        localPath: canonicalLocalPath,
        remotePath: canonicalRemotePath,
        bytesTransferred: localStats.size,
        durationMs: Date.now() - startedAt,
        verify: verifyMode,
        durabilityPath,
    };
}

export async function downloadFile(connectionArgs, {
    remotePath,
    localPath,
    overwrite = false,
    verify,
    remotePlatform = "auto",
    transferTimeoutMs,
}) {
    assertSafeArg("remotePath", remotePath);
    const { canonical: canonicalRemotePath } = validateRemotePath(remotePath, remotePlatform);

    const verifyMode = normalizeVerifyMode(verify);
    const canonicalLocalPath = validateLocalPath(localPath);
    if (maybeExistingLocalPath(canonicalLocalPath) && !overwrite) {
        throw new Error(`DESTINATION_EXISTS: local destination ${canonicalLocalPath} already exists`);
    }
    mkdirSync(dirname(canonicalLocalPath), { recursive: true });

    const stagedLocalPath = tempLocalPath(canonicalLocalPath);
    const startedAt = Date.now();
    let remoteSize = 0;

    try {
        await withSftp(connectionArgs, async (sftp) => {
            let remoteStats;
            try {
                remoteStats = await sftpStat(sftp, canonicalRemotePath);
            } catch (err) {
                if (remoteFileMissing(err.message)) {
                    throw new Error(`FILE_NOT_FOUND: remote file ${canonicalRemotePath} does not exist`);
                }
                throw err;
            }

            remoteSize = Number(remoteStats?.size || 0);
            validateTransferSize(remoteSize, canonicalRemotePath);

            const reader = sftp.createReadStream(canonicalRemotePath);
            const writer = createWriteStream(stagedLocalPath);

            await runTimedPipeline(`download ${canonicalRemotePath} -> ${canonicalLocalPath}`, reader, writer, getTransferTimeoutMs(transferTimeoutMs));
        });

        closeLocalHandle(stagedLocalPath);
        replaceLocalDestination(stagedLocalPath, canonicalLocalPath);
        if (verifyMode === "stat") {
            verifyLocalStatSize(canonicalLocalPath, remoteSize);
        }
    } catch (err) {
        rmSync(stagedLocalPath, { force: true });
        finalizeTransferError(err, `download from ${canonicalRemotePath} failed`);
    }

    return {
        remotePath: canonicalRemotePath,
        localPath: canonicalLocalPath,
        bytesTransferred: remoteSize,
        durationMs: Date.now() - startedAt,
        verify: verifyMode,
        durabilityPath: "standard",
    };
}
