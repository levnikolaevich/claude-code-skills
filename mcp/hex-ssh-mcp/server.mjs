#!/usr/bin/env node
/**
 * hex-ssh-mcp -- Token-efficient SSH MCP server with hash-verified file ops.
 *
 * 8 tools: remote-ssh, ssh-read-lines, ssh-edit-block, ssh-search-code,
 *          ssh-write-chunk, ssh-upload, ssh-download, ssh-verify
 *
 * FNV-1a hash annotations on reads, checksum verification on edits.
 * Security: ALLOWED_HOSTS, ALLOWED_DIRS env vars.
 * Output: deduplication, normalization, smart truncation.
 * Transport: stdio
 *
 * MCP SDK runtime + FNV-1a hash verification.
 */

import { z } from "zod";
const version = typeof __HEX_VERSION__ !== "undefined" ? __HEX_VERSION__ // eslint-disable-line no-undef
  : (await import("node:module")).createRequire(import.meta.url)("./package.json").version;
import { createServerRuntime } from "@levnikolaevich/hex-common/runtime/mcp-bootstrap";
import { flexBool, flexNum } from "@levnikolaevich/hex-common/runtime/schema";
import { result, errorResult } from "@levnikolaevich/hex-common/runtime/results";
import { checkForUpdates } from "@levnikolaevich/hex-common/runtime/update-check";
import { fnv1a, lineTag, rangeChecksum, parseChecksum, parseRef } from "@levnikolaevich/hex-common/text-protocol/hash";
import { deduplicateLines, normalizeOutput } from "@levnikolaevich/hex-common/output/normalize";

// SSH output schema — shared by all 8 tools (all interact with external servers)
const SSH_OUTPUT_SCHEMA = z.object({
    status: z.string(),
    host: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    exit_code: z.number().optional(),
    command: z.string().optional(),
    bytes_written: z.number().optional(),
    bytes_transferred: z.number().optional(),
    local_path: z.string().optional(),
    remote_path: z.string().optional(),
    duration_ms: z.number().optional(),
    revision: z.string().optional(),
    checksum: z.string().optional(),
    verify: z.any().optional(),
    error: z.object({ code: z.string(), message: z.string(), recovery: z.string() }).optional(),
});

// LLM clients may send booleans as strings ("true"/"false").
// z.coerce.boolean() is unsafe: Boolean("false") === true.
import { diffLines } from "diff";
import { executeCommand, validateRemotePath } from "./lib/ssh-client.mjs";
import { shellQuote, assertSafeArg } from "./lib/shell-escape.mjs";
import { validateCommand } from "./lib/command-policy.mjs";
import { validateEditArgs } from "./lib/edit-validation.mjs";
import { resolveHost } from "./lib/config-resolver.mjs";
import { downloadFile, formatTransferSummary, getMaxTransferBytes, uploadFile } from "./lib/transfer.mjs";

const { server, StdioServerTransport } = await createServerRuntime({
    name: "hex-ssh-mcp",
    version,
});

// --- Common connection args for reuse ---

const baseConnProps = {
    host: z.string().describe("SSH host - alias from ~/.ssh/config or hostname/IP"),
    user: z.string().optional().describe("SSH username (optional if set in ~/.ssh/config)"),
    privateKeyPath: z.string().optional().describe("Path to SSH private key (optional)"),
    port: flexNum().describe("SSH port (default: 22)"),
    remotePlatform: z.enum(["auto", "posix", "windows"]).optional().describe('Remote path platform. Use "windows" for paths like C:\\\\repo\\\\file.txt. Default: auto'),
    connectTimeoutMs: flexNum().describe("SSH handshake timeout in ms (default: 20000). Per-call override. Different values spawn separate pooled connections."),
    keepaliveIntervalMs: flexNum().describe("SSH keepalive interval in ms (default: 30000). Per-call override. Different values spawn separate pooled connections."),
};

const execTimeoutProps = {
    execTimeoutMs: flexNum().describe("Per-command execution timeout in ms (default: 120000). Used by remote-ssh and hash-verified file tools."),
};

const transferTimeoutProps = {
    transferTimeoutMs: flexNum().describe("SFTP inactivity timeout in ms (default: 120000; env TRANSFER_TIMEOUT_MS overrides default). Used by ssh-upload/ssh-download."),
};

function connSchema(extraShape, timeoutProps = {}) {
    return z.object({
        ...baseConnProps,
        ...timeoutProps,
        ...extraShape,
    });
}

function sanitizeTimeoutMs(v) {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Build connection params from tool args with SSH config resolution.
 */
function connParams(args) {
    const resolved = resolveHost(args.host, {
        user: args.user,
        port: args.port,
        privateKeyPath: args.privateKeyPath,
    });
    if (!resolved.user) {
        throw new Error(
            `No user for host "${args.host}". Provide user param or set User in ~/.ssh/config.`
        );
    }
    return {
        ...resolved,
        connectTimeoutMs: sanitizeTimeoutMs(args.connectTimeoutMs),
        keepaliveIntervalMs: sanitizeTimeoutMs(args.keepaliveIntervalMs),
    };
}

/**
 * Run an SSH command and return { output, error, exitCode }.
 */
async function sshExec(args, command) {
    return executeCommand({
        ...connParams(args),
        command,
        execTimeoutMs: sanitizeTimeoutMs(args.execTimeoutMs),
    });
}

/**
 * Standard error response.
 */
function errResult(msg, code = "GENERIC") {
    return errorResult(code, msg, "Check SSH connection");
}

function sshError(code, message, recovery) {
    return errorResult(code, message, recovery);
}

function okResult(structured) {
    const payload = typeof structured === "string"
        ? { status: "OK", content: structured }
        : { status: "OK", ...structured };
    const textField = payload.content || payload.stdout || "";
    return result(payload, { large: textField.length > 50_000 });
}

function transferError(code, message) {
    if (code === "FILE_NOT_FOUND") {
        return sshError(code, message, "Check that the source path exists and is a regular file");
    }
    if (code === "PATH_OUTSIDE_ROOT") {
        return sshError(code, message, "Use a path inside ALLOWED_DIRS or ALLOWED_LOCAL_DIRS");
    }
    if (code === "FILE_TOO_LARGE") {
        return sshError(code, message, `Raise MAX_TRANSFER_BYTES (current default ${getMaxTransferBytes()} bytes) or transfer a smaller file`);
    }
    if (code === "TRANSFER_FAILED") {
        return sshError(code, message, "Check SSH permissions, disk space, and destination parent directory");
    }
    return errResult(message, code);
}

function requirePosixRemotePath(args, filePath, label = "filePath") {
    const { platform } = validateRemotePath(filePath, args.remotePlatform);
    if (platform !== "posix") {
        throw new Error(
            `UNSUPPORTED_REMOTE_PLATFORM: ${label}=${filePath} resolved as ${platform}. ` +
            "This tool uses POSIX shell commands on the remote host. Use remotePlatform=\"posix\" or use ssh-upload/ssh-download for Windows SFTP transfers."
        );
    }
}


// ==================== remote-ssh ====================

server.registerTool("remote-ssh", {
    title: "SSH Command",
    description:
        "Execute shell commands on remote servers. Disabled by default. " +
        "Set REMOTE_SSH_MODE=safe or REMOTE_SSH_MODE=open to enable.",
    inputSchema: connSchema({
        command: z.string().describe("Shell command to execute"),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.command) {
            return errResult("Required: host, command");
        }

        assertSafeArg("command", args.command);
        const blocked = validateCommand(args.command);
        if (blocked) return errResult(blocked);

        const result = await sshExec(args, args.command);
        const output = normalizeOutput(result.output || "", { deduplicate: true });

        const parts = [`$ ${args.command}`, output];
        if (result.error) parts.push(`stderr: ${result.error}`);
        if (result.exitCode) parts.push(`exit: ${result.exitCode}`);

        return okResult(parts.join("\n"));
    } catch (e) {
        return errResult(e.message);
    }
});


// ==================== ssh-read-lines ====================

server.registerTool("ssh-read-lines", {
    title: "SSH Read File",
    description:
        "Read remote file with hash-annotated lines. Use startLine/maxLines for large files. " +
        "Returns range checksums for edit verification.",
    inputSchema: connSchema({
        filePath: z.string().describe("Path to file on remote server"),
        startLine: flexNum().describe("Start line (1-based, default: 1)"),
        endLine: flexNum().describe("End line (optional, reads to limit if not set)"),
        maxLines: flexNum().describe("Max lines to read (default: 200)"),
        plain: flexBool().describe("Omit hashes (lineNum|content)"),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.filePath) {
            return errResult("Required: host, filePath");
        }

        assertSafeArg("filePath", args.filePath);
        requirePosixRemotePath(args, args.filePath);

        const startLine = args.startLine || 1;
        const maxLines = args.maxLines || 200;
        const plain = args.plain || false;

        // Get total lines + content in one command
        let readCmd;
        if (args.endLine) {
            readCmd = `wc -l < ${shellQuote(args.filePath)} && sed -n '${startLine},${args.endLine}p' ${shellQuote(args.filePath)}`;
        } else {
            readCmd = `wc -l < ${shellQuote(args.filePath)} && sed -n '${startLine},$p' ${shellQuote(args.filePath)} | head -${maxLines}`;
        }

        const check = `if [ ! -f ${shellQuote(args.filePath)} ]; then echo "FILE_NOT_FOUND" && exit 1; fi; ${readCmd}`;
        const result = await sshExec(args, check);

        if (result.exitCode !== 0 || result.output === "FILE_NOT_FOUND") {
            return sshError("FILE_NOT_FOUND", `${args.filePath} does not exist`, "Check path exists");
        }

        const outputLines = result.output.split("\n");
        const totalLines = parseInt(outputLines[0].trim(), 10) || 0;
        const contentLines = outputLines.slice(1);


        // Hash-annotate lines with character cap
        const MAX_OUTPUT_CHARS = 80000;
        const lineHashes = [];
        const formatted = [];
        let charCount = 0;
        let cappedAtLine = 0;

        for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i];
            const num = startLine + i;
            const hash32 = fnv1a(line);
            const entry = plain
                ? `${num}|${line}`
                : `${lineTag(hash32)}.${num}\t${line}`;

            if (charCount + entry.length > MAX_OUTPUT_CHARS && formatted.length > 0) {
                cappedAtLine = num;
                break;
            }
            lineHashes.push(hash32);
            formatted.push(entry);
            charCount += entry.length + 1;
        }

        // Update actual end to lines shown
        const shownEnd = formatted.length > 0
            ? startLine + formatted.length - 1
            : startLine;

        // Range checksum (only for lines actually shown)
        const cs = rangeChecksum(lineHashes, startLine, shownEnd);

        // Header
        let header = `File: ${args.filePath} (${totalLines} lines)`;
        if (startLine > 1 || shownEnd < totalLines) {
            header += ` [showing ${startLine}-${shownEnd}]`;
        }
        if (shownEnd < totalLines) {
            header += ` (${totalLines - shownEnd} more below)`;
        }

        let text = `${header}\n\n\`\`\`\n${formatted.join("\n")}\n\nchecksum: ${cs}\n\`\`\``;

        if (cappedAtLine) {
            text += `\n\nOUTPUT_CAPPED at line ${cappedAtLine} (${MAX_OUTPUT_CHARS} char limit). Use startLine=${cappedAtLine} to continue.`;
        }

        return okResult(text);
    } catch (e) {
        return errResult(e.message);
    }
});


// ==================== ssh-edit-block ====================

server.registerTool("ssh-edit-block", {
    title: "SSH Edit File",
    description:
        "Edit remote files using hash-verified anchors. Use ssh-read-lines first to get hash anchors and checksums.",
    inputSchema: connSchema({
        filePath: z.string().describe("Path to file on remote server"),
        newText: z.string().optional().describe("Replacement text (for anchor/range/insert edits)"),
        checksum: z.string().optional().describe("Range checksum from ssh-read-lines (e.g. '1-50:f7e2a1b0'). If provided, verifies file unchanged before edit."),
        anchor: z.string().optional().describe("Hash anchor 'ab.42' to set single line (from ssh-read-lines)"),
        startAnchor: z.string().optional().describe("Start hash anchor 'ab.42' for range replace"),
        endAnchor: z.string().optional().describe("End hash anchor 'cd.45' for range replace"),
        insertAfter: z.string().optional().describe("Hash anchor 'ab.42' to insert after"),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.filePath) {
            return errResult("Required: host, filePath");
        }
        const validationError = validateEditArgs(args);
        if (validationError) return errResult(validationError);

        assertSafeArg("filePath", args.filePath);
        requirePosixRemotePath(args, args.filePath);

        // If checksum provided, verify file hasn't changed
        if (args.checksum) {
            const parsed = parseChecksum(args.checksum);
            const readCmd = `sed -n '${parsed.start},${parsed.end}p' ${shellQuote(args.filePath)}`;
            const readResult = await sshExec(args, readCmd);

            if (readResult.exitCode !== 0) {
                return sshError("FILE_NOT_FOUND", `Cannot read ${args.filePath} for verification`, "Check path exists");
            }

            const currentLines = readResult.output.split("\n");
            const currentHashes = currentLines.map((l) => fnv1a(l));
            const currentCs = rangeChecksum(currentHashes, parsed.start, parsed.end);
            const currentHex = currentCs.split(":")[1];

            if (currentHex !== parsed.hex) {
                return sshError(
                    "STALE_CHECKSUM",
                    `expected ${args.checksum}, current ${currentCs}. File changed since last read.`,
                    "Re-read with ssh-read-lines"
                );
            }
        }

        // Anchor-based editing (preferred path)
        if (args.anchor || args.startAnchor || args.insertAfter) {
            // Parse anchor ref: "ab.42" -> { tag: "ab", line: 42 }
            function parseRemoteRef(ref) {
                try {
                    return parseRef(ref);
                } catch {
                    return errResult(`Bad anchor: "${ref}". Expected "ab.42"`);
                }
            }

            // Read current content with line context
            const readResult = await sshExec(args, `cat ${shellQuote(args.filePath)}`);
            if (readResult.exitCode !== 0) {
                return sshError("FILE_NOT_FOUND", `Cannot read ${args.filePath}`, "Check path exists");
            }
            const allLines = readResult.output.replace(/\r\n/g, "\n").split("\n");

            // Verify anchor hash matches
            function verifyAnchor(ref) {
                const parsedRef = parseRemoteRef(ref);
                if (parsedRef.content) return parsedRef;
                const { tag, line } = parsedRef;
                const idx = line - 1;
                if (idx < 0 || idx >= allLines.length) {
                    const start = idx >= allLines.length
                        ? Math.max(0, allLines.length - 10) : 0;
                    const end = idx >= allLines.length
                        ? allLines.length : Math.min(allLines.length, 10);
                    const snippet = allLines.slice(start, end).map((l, i) => {
                        const n = start + i + 1;
                        return `${lineTag(fnv1a(l))}.${n}\t${l}`;
                    }).join("\n");
                    return errResult(
                        `Line ${line} out of range (1-${allLines.length}).\n\n` +
                        `Current content (lines ${start + 1}-${end}):\n${snippet}\n\n` +
                        `Tip: Re-read with ssh-read-lines for updated hashes.`
                    );
                }
                const actual = lineTag(fnv1a(allLines[idx]));
                if (actual !== tag) {
                    // Fuzzy +/-5
                    for (let d = 1; d <= 5; d++) {
                        for (const off of [d, -d]) {
                            const c = idx + off;
                            if (c >= 0 && c < allLines.length && lineTag(fnv1a(allLines[c])) === tag) {
                                return { idx: c };
                            }
                        }
                    }
                    // Build snippet for retry
                    const start = Math.max(0, idx - 3);
                    const end = Math.min(allLines.length, idx + 4);
                    const snippet = allLines.slice(start, end).map((l, i) => {
                        const n = start + i + 1;
                        return `${lineTag(fnv1a(l))}.${n}\t${l}`;
                    }).join("\n");
                    return errResult(
                        `Hash mismatch line ${line}: expected ${tag}, got ${actual}.\n\n` +
                        `Current (lines ${start + 1}-${end}):\n${snippet}\n\n` +
                        `Tip: Re-read with ssh-read-lines for updated hashes.`
                    );
                }
                return { idx };
            }

            let updated;
            if (args.anchor) {
                const v = verifyAnchor(args.anchor);
                if (v.content) return v; // error
                const newLines = (args.newText || "").split("\n");
                updated = [...allLines];
                updated.splice(v.idx, 1, ...newLines);
            } else if (args.startAnchor && args.endAnchor) {
                const vs = verifyAnchor(args.startAnchor);
                if (vs.content) return vs;
                const ve = verifyAnchor(args.endAnchor);
                if (ve.content) return ve;
                const newLines = (args.newText || "").split("\n");
                updated = [...allLines];
                updated.splice(vs.idx, ve.idx - vs.idx + 1, ...newLines);
            } else if (args.insertAfter) {
                const v = verifyAnchor(args.insertAfter);
                if (v.content) return v;
                const insertLines = (args.newText || "").split("\n");
                updated = [...allLines];
                updated.splice(v.idx + 1, 0, ...insertLines);
            }

            const updatedContent = updated.join("\n");
            const b64 = Buffer.from(updatedContent, "utf-8").toString("base64");
            const tmpPath = args.filePath + ".hex-tmp-" + Date.now();
            const writeCmd = `echo ${shellQuote(b64)} | (base64 -d 2>/dev/null || base64 -D) > ${shellQuote(tmpPath)} && mv ${shellQuote(tmpPath)} ${shellQuote(args.filePath)}`;
            const writeResult = await sshExec(args, writeCmd);
            if (writeResult.exitCode !== 0) {
                return sshError("WRITE_FAILED", `Write to ${args.filePath} failed: ${writeResult.error || "unknown"}`, "Check permissions and disk space");
            }

            // Diff
            const original = allLines.join("\n") + "\n";
            const parts = diffLines(original, updatedContent + "\n");
            const diffParts = [];
            let oldNum = 1, newNum = 1;
            for (const part of parts) {
                const pLines = part.value.replace(/\n$/, "").split("\n");
                if (part.added || part.removed) {
                    for (const line of pLines) {
                        if (part.removed) { diffParts.push(`-${oldNum}| ${line}`); oldNum++; }
                        else { diffParts.push(`+${newNum}| ${line}`); newNum++; }
                    }
                } else {
                    oldNum += pLines.length; newNum += pLines.length;
                }
            }

            let msg = `Updated ${args.filePath} (anchor-based edit)`;
            if (diffParts.length > 0) {
                msg += `\n\n\`\`\`diff\n${diffParts.slice(0, 40).join("\n")}\n\`\`\``;
            }
            return okResult(msg);
        }
    } catch (e) {
        return errResult(e.message);
    }
});


// ==================== ssh-search-code ====================

server.registerTool("ssh-search-code", {
    title: "SSH Search",
    description:
        "Search remote files with grep. Returns hash-annotated matches with deduplication. " +
        "Use for finding code before ssh-edit-block.",
    inputSchema: connSchema({
        path: z.string().describe("Directory to search on remote server"),
        pattern: z.string().describe("Text/regex pattern to search"),
        filePattern: z.string().optional().describe('Glob filter (e.g. "*.js", "*.py")'),
        ignoreCase: flexBool().describe("Case-insensitive search (default: false)"),
        maxResults: flexNum().describe("Max result lines (default: 50)"),
        contextLines: flexNum().describe("Context lines around matches (default: 0)"),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.path || !args.pattern) {
            return errResult("Required: host, path, pattern");
        }

        assertSafeArg("path", args.path);
        assertSafeArg("pattern", args.pattern);
        if (args.filePattern) assertSafeArg("filePattern", args.filePattern);
        requirePosixRemotePath(args, args.path, "path");

        const maxResults = args.maxResults || 50;
        const contextLines = args.contextLines || 0;

        let grepOpts = "-rn";
        if (args.ignoreCase) grepOpts += "i";
        if (contextLines > 0) grepOpts += ` -C${contextLines}`;

        let includeOpt = "";
        if (args.filePattern) {
            includeOpt = ` --include=${shellQuote(args.filePattern)}`;
        }

        const cmd = [
            `if [ ! -d ${shellQuote(args.path)} ]; then echo "DIR_NOT_FOUND" && exit 1; fi`,
            `grep ${grepOpts}${includeOpt} ${shellQuote(args.pattern)} ${shellQuote(args.path)} 2>/dev/null | head -${maxResults * 2}`,
        ].join("; ");

        const result = await sshExec(args, cmd);

        if (result.output === "DIR_NOT_FOUND") {
            return sshError("DIR_NOT_FOUND", `${args.path} does not exist`, "Check directory path");
        }

        if (!result.output || result.output.trim() === "") {
            return okResult(`No matches for "${args.pattern}" in ${args.path}`);
        }

        // Hash-annotate and deduplicate results
        const rawLines = result.output.split("\n");
        const matchRe = /^(.+?):(\d+):(.*)$/;
        const annotated = [];
        for (const rl of rawLines) {
            const m = matchRe.exec(rl);
            if (m) {
                const tag = lineTag(fnv1a(m[3]));
                annotated.push(`${m[1]}:>>${tag}.${m[2]}\t${m[3]}`);
            } else {
                annotated.push(rl);
            }
        }
        const deduped = deduplicateLines(annotated);

        // Truncate to maxResults
        const limited = deduped.slice(0, maxResults);
        const skipped = deduped.length - limited.length;

        let text = limited.join("\n");
        if (skipped > 0) {
            text += `\n\n(${skipped} more results omitted)`;
        }

        return okResult(text);
    } catch (e) {
        return errResult(e.message);
    }
});


// ==================== ssh-write-chunk ====================

server.registerTool("ssh-write-chunk", {
    title: "SSH Write File",
    description:
        "Write or append to remote files. Rewrite mode is atomic (temp file + rename). " +
        "Append mode is non-atomic (direct >>). Auto-creates parent directories.",
    inputSchema: connSchema({
        filePath: z.string().describe("Path to file on remote server"),
        content: z.string().describe("Content to write"),
        mode: z.enum(["rewrite", "append"]).optional().describe("Write mode (default: rewrite)"),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.filePath || args.content === undefined) {
            return errResult("Required: host, filePath, content");
        }

        assertSafeArg("filePath", args.filePath);
        requirePosixRemotePath(args, args.filePath);

        const mode = args.mode || "rewrite";
        const b64 = Buffer.from(args.content, "utf-8").toString("base64");
        const tmpPath = args.filePath + ".hex-tmp-" + Date.now();

        let cmd;
        if (mode === "append") {
            cmd = [
                `dir=$(dirname -- ${shellQuote(args.filePath)}) && mkdir -p -- "$dir"`,
                `echo ${shellQuote(b64)} | (base64 -d 2>/dev/null || base64 -D) >> ${shellQuote(args.filePath)}`,
                `echo "bytes=$(wc -c < ${shellQuote(args.filePath)}) lines=$(wc -l < ${shellQuote(args.filePath)})"`,
            ].join(" && ");
        } else {
            cmd = [
                `dir=$(dirname -- ${shellQuote(args.filePath)}) && mkdir -p -- "$dir"`,
                `echo ${shellQuote(b64)} | (base64 -d 2>/dev/null || base64 -D) > ${shellQuote(tmpPath)} && mv ${shellQuote(tmpPath)} ${shellQuote(args.filePath)}`,
                `echo "bytes=$(wc -c < ${shellQuote(args.filePath)}) lines=$(wc -l < ${shellQuote(args.filePath)})"`,
            ].join(" && ");
        }

        const result = await sshExec(args, cmd);

        if (result.exitCode !== 0) {
            return sshError("WRITE_FAILED", `Write to ${args.filePath} failed: ${result.error || "unknown error"}`, "Check permissions and disk space");
        }

        const lineCount = args.content.split("\n").length;
        return okResult(`Written ${args.filePath} (${mode}, ~${lineCount} lines)\n${result.output}`);
    } catch (e) {
        return errResult(e.message);
    }
});


// ==================== ssh-upload ====================

server.registerTool("ssh-upload", {
    title: "SSH Upload File",
    description:
        "Upload a local file to a remote server over SFTP. Supports text and binary files, " +
        "rejects existing destinations by default, validates path boundaries, and stages via the strongest available remote finalize path.",
    inputSchema: connSchema({
        localPath: z.string().describe("Absolute local file path or ~/path to upload"),
        remotePath: z.string().describe("Absolute destination path on remote server"),
        overwrite: z.boolean().optional().describe("Replace existing destination when true. Default: false"),
        verify: z.enum(["none", "stat"]).optional().describe("Post-transfer verification mode. Default: stat"),
        permissions: z.string().optional().describe("Optional octal file mode for uploaded file, e.g. 0644"),
    }, transferTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.localPath || !args.remotePath) {
            return errResult("Required: host, localPath, remotePath");
        }

        const result = await uploadFile(connParams(args), {
            localPath: args.localPath,
            remotePath: args.remotePath,
            overwrite: args.overwrite,
            verify: args.verify,
            permissions: args.permissions,
            remotePlatform: args.remotePlatform,
            transferTimeoutMs: sanitizeTimeoutMs(args.transferTimeoutMs),
        });
        return okResult(
            formatTransferSummary(
                "Uploaded",
                result.localPath,
                result.remotePath,
                result.bytesTransferred,
                result.durationMs,
                result.verify,
                result.durabilityPath
            )
        );
    } catch (e) {
        const [code, ...rest] = e.message.split(": ");
        if (["FILE_NOT_FOUND", "PATH_OUTSIDE_ROOT", "FILE_TOO_LARGE", "TRANSFER_FAILED", "DESTINATION_EXISTS", "TRANSFER_TIMEOUT", "VERIFY_FAILED"].includes(code)) {
            return transferError(code, rest.join(": "));
        }
        return errResult(e.message);
    }
});


// ==================== ssh-download ====================

server.registerTool("ssh-download", {
    title: "SSH Download File",
    description:
        "Download a remote file to the local machine over SFTP. Supports text and binary files, " +
        "rejects existing destinations by default, validates path boundaries, and stages to a verified local finalize path.",
    inputSchema: connSchema({
        remotePath: z.string().describe("Absolute file path on remote server"),
        localPath: z.string().describe("Absolute local destination path or ~/path"),
        overwrite: z.boolean().optional().describe("Replace existing destination when true. Default: false"),
        verify: z.enum(["none", "stat"]).optional().describe("Post-transfer verification mode. Default: stat"),
    }, transferTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.remotePath || !args.localPath) {
            return errResult("Required: host, remotePath, localPath");
        }

        const result = await downloadFile(connParams(args), {
            remotePath: args.remotePath,
            localPath: args.localPath,
            overwrite: args.overwrite,
            verify: args.verify,
            remotePlatform: args.remotePlatform,
            transferTimeoutMs: sanitizeTimeoutMs(args.transferTimeoutMs),
        });
        return okResult(
            formatTransferSummary(
                "Downloaded",
                result.remotePath,
                result.localPath,
                result.bytesTransferred,
                result.durationMs,
                result.verify,
                result.durabilityPath
            )
        );
    } catch (e) {
        const [code, ...rest] = e.message.split(": ");
        if (["FILE_NOT_FOUND", "PATH_OUTSIDE_ROOT", "FILE_TOO_LARGE", "TRANSFER_FAILED", "DESTINATION_EXISTS", "TRANSFER_TIMEOUT", "VERIFY_FAILED"].includes(code)) {
            return transferError(code, rest.join(": "));
        }
        return errResult(e.message);
    }
});


// ==================== ssh-verify ====================

server.registerTool("ssh-verify", {
    title: "SSH Verify Checksums",
    description:
        "Check if range checksums still match remote file. Single-line response avoids full re-read. " +
        "Use before editing after a pause.",
    inputSchema: connSchema({
        filePath: z.string().describe("Path to file on remote server"),
        checksums: z.string().describe('JSON array of checksum strings, e.g. ["1-50:f7e2a1b0", "51-100:abcd1234"]'),
    }, execTimeoutProps),
    outputSchema: SSH_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawArgs) => {
    const args = rawArgs ?? {};
    try {
        if (!args.host || !args.filePath || !args.checksums) {
            return errResult("Required: host, filePath, checksums");
        }

        assertSafeArg("filePath", args.filePath);
        requirePosixRemotePath(args, args.filePath);

        const checksums = JSON.parse(args.checksums);
        if (!Array.isArray(checksums) || checksums.length === 0) {
            return errResult("checksums must be a non-empty JSON array of strings");
        }

        // Parse all checksums to find the full range needed
        const parsed = checksums.map((cs) => parseChecksum(cs));
        const minLine = Math.min(...parsed.map((p) => p.start));
        const maxLine = Math.max(...parsed.map((p) => p.end));

        // Read just the needed range
        const readCmd = [
            `if [ ! -f ${shellQuote(args.filePath)} ]; then echo "FILE_NOT_FOUND" && exit 1; fi`,
            `total=$(wc -l < ${shellQuote(args.filePath)})`,
            `echo "$total"`,
            `sed -n '${minLine},${maxLine}p' ${shellQuote(args.filePath)}`,
        ].join("; ");

        const result = await sshExec(args, readCmd);

        if (result.exitCode !== 0 || result.output === "FILE_NOT_FOUND") {
            return sshError("FILE_NOT_FOUND", `${args.filePath} does not exist`, "Check path exists");
        }

        const outputLines = result.output.split("\n");
        const totalLines = parseInt(outputLines[0].trim(), 10);
        const contentLines = outputLines.slice(1);

        // Pre-compute hashes for the fetched range
        const lineHashes = contentLines.map((l) => fnv1a(l));

        const results = [];
        let allValid = true;

        for (let i = 0; i < parsed.length; i++) {
            const p = parsed[i];
            const cs = checksums[i];

            if (p.start < 1 || p.end > totalLines) {
                results.push(`${cs}: INVALID (range exceeds ${totalLines} lines)`);
                allValid = false;
                continue;
            }

            // Slice from fetched range (adjust offset: minLine-based)
            const offset = p.start - minLine;
            const count = p.end - p.start + 1;
            const currentHashes = lineHashes.slice(offset, offset + count);
            const current = rangeChecksum(currentHashes, p.start, p.end);
            const currentHex = current.split(":")[1];

            if (currentHex === p.hex) {
                results.push(`${cs}: valid`);
            } else {
                results.push(`${cs}: STALE -> current: ${current}`);
                allValid = false;
            }
        }

        if (allValid) {
            return okResult(`All ${checksums.length} checksum(s) valid for ${args.filePath}`);
        }

        return okResult(results.join("\n"));
    } catch (e) {
        return errResult(e.message);
    }
});


// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-ssh-mcp", version);
