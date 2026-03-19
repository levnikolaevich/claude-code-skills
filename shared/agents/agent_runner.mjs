#!/usr/bin/env node
/**
 * Universal Agent Runner for Multi-Model Orchestration (Node.js ESM port).
 *
 * Calls external CLI AI agents (Codex, Gemini) via subprocess
 * and returns structured JSON to stdout for Claude Code consumption.
 *
 * Streams agent stdout to a log file for real-time visibility.
 * Writes process-level heartbeat.json every 30s (independent of agent).
 *
 * Supports session resume for multi-turn debate (challenge/follow-up rounds).
 *
 * Exit codes: 0 = success, 1 = agent error, 2 = agent not found/unavailable
 *
 * Usage:
 *     node agent_runner.mjs --agent gemini --prompt "Analyze scope..."
 *     node agent_runner.mjs --agent codex --prompt-file /tmp/prompt.md --cwd /project
 *     node agent_runner.mjs --agent codex-review --prompt-file prompt.md --output-file result.md --cwd /project
 *     node agent_runner.mjs --agent codex-review --resume-session abc-123 --prompt-file challenge.md --output-file result.md --cwd /project
 *     node agent_runner.mjs --health-check
 *     node agent_runner.mjs --list-agents
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const REGISTRY_PATH = path.join(SCRIPT_DIR, "agent_registry.json");
const IS_WINDOWS = process.platform === "win32";

const DEFAULT_HARD_TIMEOUT = 1800; // 30 minutes

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;


function loadRegistry() {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}


function buildEnv(agentCfg) {
    const env = Object.assign({}, process.env);
    const overrides = agentCfg.env_override || {};
    for (const [key, val] of Object.entries(overrides)) {
        env[key] = val;
    }
    return env;
}


const WINDOWS_PERFORMANCE_HINT =
    "\n## Platform Note (Windows)\n" +
    "You are running on Windows where shell commands use PowerShell " +
    "(5-15 seconds per invocation).\n" +
    "- **PREFER your built-in file read tool** over shell commands " +
    "(`cat`, `type`, `Get-Content`) for reading files. " +
    "Your built-in file read is instant.\n" +
    "- **BATCH shell operations**: combine related checks into one command " +
    "(e.g., `git log --oneline -10 && git diff --stat` instead of " +
    "separate calls).\n" +
    "- **AVOID grep/rg via shell** -- PowerShell escaping differs from bash " +
    "and often causes regex errors. Use your built-in file read to examine " +
    "specific files directly.\n" +
    "- **Shell budget**: each shell call costs 5-15 seconds. " +
    "Prioritize wisely.\n\n";


function preparePrompt(prompt) {
    if (IS_WINDOWS) {
        return WINDOWS_PERFORMANCE_HINT + prompt;
    }
    return prompt;
}


/**
 * Synchronous `which` replacement.
 * On Windows: search PATH for cmd with PATHEXT extensions.
 * On Unix: use `which` command.
 * Returns absolute path or null.
 */
function whichSync(cmd) {
    if (!cmd) return null;

    // If cmd is already an absolute path and exists, return it
    if (path.isAbsolute(cmd) && fs.existsSync(cmd)) {
        return cmd;
    }

    if (IS_WINDOWS) {
        const pathDirs = (process.env.PATH || "").split(path.delimiter);
        const pathExts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";");
        for (const dir of pathDirs) {
            // Try exact name first
            const full = path.join(dir, cmd);
            if (fs.existsSync(full)) return full;
            // Try with each extension
            for (const ext of pathExts) {
                const fullExt = path.join(dir, cmd + ext);
                if (fs.existsSync(fullExt)) return fullExt;
            }
        }
        return null;
    }

    // Unix
    try {
        const result = execSync("which " + cmd, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 5000,
        });
        const resolved = result.trim();
        return resolved || null;
    } catch {
        return null;
    }
}


/**
 * Replace {cwd}, {output_file}, {session_id} placeholders in args.
 *
 * If a placeholder value is empty/None, removes the flag AND its value.
 * E.g., args=["-C", "{cwd}", "-o", "{output_file}"] with output_file=""
 * becomes ["-C", "/project"] (removes -o and {output_file}).
 */
function resolveArgPlaceholders(args, context) {
    const resolved = [];
    let skipNext = false;

    for (let i = 0; i < args.length; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const arg = args[i];
        const hasPlaceholder = arg.includes("{") && arg.includes("}");

        if (hasPlaceholder) {
            let value = arg;
            for (const [key, val] of Object.entries(context)) {
                value = value.replace(
                    new RegExp("\\{" + key + "\\}", "g"),
                    val ? String(val) : ""
                );
            }
            if (!value) {
                if (resolved.length > 0 && resolved[resolved.length - 1].startsWith("-")) {
                    resolved.pop();
                }
                continue;
            }
            resolved.push(value);
        } else {
            if (i + 1 < args.length) {
                const nextArg = args[i + 1];
                if (nextArg.includes("{") && nextArg.includes("}")) {
                    let nextVal = nextArg;
                    for (const [key, val] of Object.entries(context)) {
                        nextVal = nextVal.replace(
                            new RegExp("\\{" + key + "\\}", "g"),
                            val ? String(val) : ""
                        );
                    }
                    if (!nextVal) {
                        skipNext = true;
                        continue;
                    }
                }
            }
            resolved.push(arg);
        }
    }
    return resolved;
}


function buildCommand(agentCfg, resolvedArgs) {
    const cmdPath = whichSync(agentCfg.command) || agentCfg.command;
    if (IS_WINDOWS && /\.(cmd|bat)$/i.test(cmdPath)) {
        return ["cmd", "/c", cmdPath, ...resolvedArgs];
    }
    return [cmdPath, ...resolvedArgs];
}


/**
 * Extract session ID from agent output based on capture strategy.
 * Returns session_id string or null if not captured.
 */
function captureSessionId(agentCfg, rawOutput) {
    const captureCfg = agentCfg.session_id_capture;
    if (!captureCfg) return null;

    const strategy = captureCfg.strategy;

    if (strategy === "from_log") {
        const pattern = captureCfg.pattern;
        if (pattern) {
            const re = new RegExp(pattern, "i");
            const match = re.exec(rawOutput);
            if (match && match[1]) {
                return match[1];
            }
        }
        // Fallback: first UUID in output
        const uuidMatch = UUID_PATTERN.exec(rawOutput);
        return uuidMatch ? uuidMatch[0] : null;
    }

    if (strategy === "from_jsonl_field") {
        const fieldPath = captureCfg.field_path || "session_id";
        const lines = rawOutput.trim().split("\n");
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            try {
                let event = JSON.parse(line);
                let value = event;
                for (const part of fieldPath.split(".")) {
                    if (value && typeof value === "object" && !Array.isArray(value)) {
                        value = value[part];
                    } else {
                        value = null;
                        break;
                    }
                }
                if (value && typeof value === "string") {
                    return value;
                }
            } catch {
                continue;
            }
        }
        const uuidMatch = UUID_PATTERN.exec(rawOutput);
        return uuidMatch ? uuidMatch[0] : null;
    }

    if (strategy === "from_list_command") {
        const listCmd = captureCfg.command || "";
        if (!listCmd) return null;
        try {
            const parts = listCmd.split(/\s+/);
            const cmdPath = whichSync(parts[0]);
            if (!cmdPath) return null;
            let execParts;
            if (IS_WINDOWS && /\.(cmd|bat)$/i.test(cmdPath)) {
                execParts = ["cmd", "/c", cmdPath, ...parts.slice(1)];
            } else {
                execParts = [cmdPath, ...parts.slice(1)];
            }
            const result = execSync(execParts.join(" "), {
                encoding: "utf-8",
                timeout: 15000,
                stdio: ["pipe", "pipe", "pipe"],
            });
            const uuidMatch = UUID_PATTERN.exec(result);
            return uuidMatch ? uuidMatch[0] : null;
        } catch {
            return null;
        }
    }

    return null;
}


function checkAgentHealth(agentName, registry) {
    const agentCfg = registry.agents[agentName];
    if (!agentCfg) {
        return { ok: false, info: "Agent not found in registry" };
    }

    const cmdPath = whichSync(agentCfg.command);
    if (!cmdPath) {
        return { ok: false, info: "Command not found in PATH" };
    }

    try {
        const healthCmd = agentCfg.health_check.split(/\s+/);
        let execCmd;
        if (IS_WINDOWS) {
            const hcPath = whichSync(healthCmd[0]);
            if (hcPath && /\.(cmd|bat)$/i.test(hcPath)) {
                execCmd = ["cmd", "/c", hcPath, ...healthCmd.slice(1)];
            } else {
                execCmd = healthCmd;
            }
        } else {
            execCmd = healthCmd;
        }

        const result = execSync(execCmd.join(" "), {
            encoding: "utf-8",
            timeout: 15000,
            env: buildEnv(agentCfg),
            stdio: ["pipe", "pipe", "pipe"],
        });
        const version = (result || "").trim();
        return { ok: true, info: version.split("\n")[0].slice(0, 80) };
    } catch (e) {
        // Try stderr from the error object
        const stderr = e.stderr ? e.stderr.toString().trim() : "";
        const info = stderr.split("\n")[0].slice(0, 80) || String(e.message || e);
        return { ok: false, info: info };
    }
}


function writeResultFile(outputFile, agentName, response, duration, exitCode,
                         sessionId) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    let header =
        "<!-- AGENT_REVIEW_RESULT -->\n" +
        "<!-- agent: " + agentName + " -->\n" +
        "<!-- timestamp: " + timestamp + " -->\n" +
        "<!-- duration_seconds: " + duration.toFixed(2) + " -->\n" +
        "<!-- exit_code: " + exitCode + " -->\n";
    if (sessionId) {
        header += "<!-- session_id: " + sessionId + " -->\n";
    }
    header += "\n";
    const footer = "\n\n<!-- END_AGENT_REVIEW_RESULT -->\n";

    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    fs.writeFileSync(outputFile, header + (response || "") + footer, "utf-8");
}


// ---------------------------------------------------------------------------
// Streaming execution with heartbeat
// ---------------------------------------------------------------------------

function getLogPath(outputFile) {
    if (!outputFile) return null;
    if (outputFile.endsWith("_result.md")) {
        return outputFile.slice(0, -"_result.md".length) + ".log";
    }
    const parsed = path.parse(outputFile);
    return path.join(parsed.dir, parsed.name + ".log");
}


function writeHeartbeat(heartbeatPath, data) {
    if (!heartbeatPath) return;
    const tmpPath = heartbeatPath + ".tmp";
    try {
        fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
        fs.writeFileSync(tmpPath, JSON.stringify(data), "utf-8");
        fs.renameSync(tmpPath, heartbeatPath);
    } catch {
        // best-effort
    }
}


function killProcessTree(pid) {
    if (IS_WINDOWS) {
        try {
            execSync("taskkill /T /F /PID " + pid, {
                timeout: 10000,
                stdio: ["pipe", "pipe", "pipe"],
            });
        } catch {
            // best-effort
        }
    } else {
        try {
            process.kill(-pid, "SIGKILL");
        } catch {
            // best-effort
        }
    }
}


function isProcessAlive(pid) {
    if (IS_WINDOWS) {
        try {
            const result = execSync(
                "tasklist /FI \"PID eq " + pid + "\" /NH",
                { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
            );
            return result.includes(String(pid));
        } catch {
            return false;
        }
    } else {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }
}


function utcTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}


/**
 * Run agent subprocess with streaming stdout and process heartbeat.
 *
 * Returns a Promise that resolves to the result object.
 */
function executeAgent(agentCfg, cmd, stdinPrompt, hardTimeout,
                      heartbeatInterval, subprocessCwd, env,
                      outputFile, logPath, agentName) {
    return new Promise((resolve) => {
        let heartbeatPath = null;
        if (logPath) {
            heartbeatPath = path.join(
                path.dirname(path.resolve(logPath)), "heartbeat.json");
        }

        const startTime = Date.now();
        let logFh = null;
        let timedOut = false;
        let rawStdout = "";
        let childExited = false;
        let childExitCode = null;
        let heartbeatTimer = null;
        let hardTimeoutTimer = null;

        // Cleanup helper
        function cleanup() {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            if (hardTimeoutTimer) {
                clearTimeout(hardTimeoutTimer);
                hardTimeoutTimer = null;
            }
        }

        // Open log file
        if (logPath) {
            try {
                fs.mkdirSync(path.dirname(path.resolve(logPath)), { recursive: true });
                logFh = fs.createWriteStream(logPath, { encoding: "utf-8" });
            } catch {
                logFh = null;
            }
        }

        // Spawn options
        const spawnOpts = {
            cwd: subprocessCwd || undefined,
            env: env,
            stdio: [
                stdinPrompt ? "pipe" : "ignore",   // stdin
                logFh ? "pipe" : "pipe",            // stdout (always pipe, we route manually)
                "pipe",                             // stderr (merge into stdout stream)
            ],
        };

        // Unix: new session so process.kill(-pid) can kill the entire tree
        if (!IS_WINDOWS) {
            spawnOpts.detached = true;
        }

        let child;
        try {
            child = spawn(cmd[0], cmd.slice(1), spawnOpts);
        } catch (e) {
            cleanup();
            if (logFh) logFh.end();
            resolve({
                success: false,
                agent: agentName,
                response: null,
                duration_seconds: 0,
                error: "Command '" + agentCfg.command + "' not found",
                session_id: null,
            });
            return;
        }

        // Handle spawn error (e.g., ENOENT)
        child.on("error", (err) => {
            if (childExited) return;
            childExited = true;
            childExitCode = -1;
            cleanup();
            if (logFh) logFh.end();
            resolve({
                success: false,
                agent: agentName,
                response: null,
                duration_seconds: 0,
                error: "Command '" + agentCfg.command + "' not found: " + err.message,
                session_id: null,
            });
        });

        // Initial heartbeat
        writeHeartbeat(heartbeatPath, {
            pid: child.pid,
            alive: true,
            elapsed_seconds: 0,
            log_size_bytes: 0,
            updated_at: utcTimestamp(),
        });

        // Send prompt via stdin
        if (stdinPrompt && child.stdin) {
            try {
                child.stdin.write(stdinPrompt);
                child.stdin.end();
            } catch {
                // ignore broken pipe
            }
        }

        // Route stdout
        if (child.stdout) {
            if (logFh) {
                child.stdout.pipe(logFh);
            } else {
                child.stdout.on("data", (chunk) => {
                    rawStdout += chunk.toString("utf-8");
                });
            }
        }

        // Route stderr into same stream
        if (child.stderr) {
            if (logFh) {
                child.stderr.pipe(logFh, { end: false });
            } else {
                child.stderr.on("data", (chunk) => {
                    rawStdout += chunk.toString("utf-8");
                });
            }
        }

        // Heartbeat interval
        heartbeatTimer = setInterval(() => {
            const elapsed = Math.round((Date.now() - startTime) / 100) / 10;
            let logSize = 0;
            if (logPath) {
                try {
                    logSize = fs.statSync(logPath).size;
                } catch {
                    // ignore
                }
            }
            writeHeartbeat(heartbeatPath, {
                pid: child.pid,
                alive: !childExited,
                elapsed_seconds: elapsed,
                log_size_bytes: logSize,
                updated_at: utcTimestamp(),
            });
        }, heartbeatInterval * 1000);

        // Hard timeout
        hardTimeoutTimer = setTimeout(() => {
            if (!childExited) {
                timedOut = true;
                killProcessTree(child.pid);
                // Give it a moment then force kill the child directly
                setTimeout(() => {
                    if (!childExited) {
                        try {
                            child.kill("SIGKILL");
                        } catch {
                            // ignore
                        }
                    }
                }, 5000);
            }
        }, hardTimeout * 1000);

        // On exit
        child.on("close", (code) => {
            if (childExited) return;
            childExited = true;
            childExitCode = code;
            cleanup();

            // Close log file handle
            if (logFh) {
                logFh.end();
            }

            const duration = Math.round((Date.now() - startTime) / 10) / 100;

            // Clean up orphaned child processes after normal exit
            killProcessTree(child.pid);

            // Read log content
            let logContent = "";
            if (logPath && fs.existsSync(logPath)) {
                try {
                    logContent = fs.readFileSync(logPath, "utf-8");
                } catch {
                    // ignore
                }
            }

            // For agents with log files, log content serves as raw output
            if (logFh && !rawStdout) {
                rawStdout = logContent;
            }

            // Final heartbeat
            const finalStatus = timedOut ? "timeout" : (code === 0 ? "done" : "error");
            const logSize = logContent ? Buffer.byteLength(logContent, "utf-8") : 0;
            writeHeartbeat(heartbeatPath, {
                pid: child.pid,
                alive: false,
                elapsed_seconds: duration,
                log_size_bytes: logSize,
                status: finalStatus,
                exit_code: code,
                updated_at: utcTimestamp(),
            });

            if (timedOut) {
                resolve({
                    success: false,
                    agent: agentName,
                    response: null,
                    duration_seconds: duration,
                    error: "Hard timeout after " + hardTimeout + " seconds",
                    session_id: null,
                });
                return;
            }

            // Capture session ID
            const sessionId = captureSessionId(agentCfg, rawStdout);

            // Parse response
            let agentWroteFile = false;
            if (outputFile) {
                try {
                    const stat = fs.statSync(outputFile);
                    agentWroteFile = stat.size > 0;
                } catch {
                    agentWroteFile = false;
                }
            }

            let response;
            if (agentWroteFile) {
                response = fs.readFileSync(outputFile, "utf-8").trim();
                writeResultFile(outputFile, agentName, response,
                    duration, code, sessionId);
            } else {
                response = rawStdout ? rawStdout.trim() : null;
                if (outputFile && response) {
                    writeResultFile(outputFile, agentName, response,
                        duration, code, sessionId);
                }
            }

            if (code !== 0) {
                resolve({
                    success: false,
                    agent: agentName,
                    response: response || null,
                    duration_seconds: duration,
                    error: "Exit code " + code,
                    session_id: sessionId,
                });
                return;
            }

            resolve({
                success: true,
                agent: agentName,
                response: response,
                duration_seconds: duration,
                error: null,
                session_id: sessionId,
            });
        });
    });
}


// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function runAgent(agentName, prompt, cwd, timeout, registry,
                        outputFile, resumeSession, logFile) {
    const agentCfg = registry.agents[agentName];
    if (!agentCfg) {
        return {
            success: false, agent: agentName,
            response: null, duration_seconds: 0,
            error: "Agent '" + agentName + "' not found in registry",
            session_id: null, session_resumed: false,
        };
    }

    const cmdPath = whichSync(agentCfg.command);
    if (!cmdPath) {
        return {
            success: false, agent: agentName,
            response: null, duration_seconds: 0,
            error: "Command '" + agentCfg.command + "' not found in PATH",
            session_id: null, session_resumed: false,
        };
    }

    const context = {
        cwd: cwd || process.cwd(),
        output_file: outputFile || "",
        session_id: resumeSession || "",
    };

    // Determine hard timeout
    const cfgTimeout = agentCfg.hard_timeout_seconds != null
        ? agentCfg.hard_timeout_seconds
        : (agentCfg.timeout_seconds != null
            ? agentCfg.timeout_seconds
            : DEFAULT_HARD_TIMEOUT);
    let hardTimeout;
    if (timeout) {
        hardTimeout = timeout;
    } else if (cfgTimeout === 0) {
        hardTimeout = DEFAULT_HARD_TIMEOUT;
    } else {
        hardTimeout = cfgTimeout;
    }

    const heartbeatInterval = agentCfg.heartbeat_interval_seconds || 30;
    const logPath = logFile || getLogPath(outputFile);
    const env = buildEnv(agentCfg);

    // Try resume mode if session ID provided and agent supports it
    const useResume = resumeSession && agentCfg.resume_args;

    if (useResume) {
        const resumeArgsTemplate = agentCfg.resume_args;
        const resolvedArgs = resolveArgPlaceholders(resumeArgsTemplate, context);

        // Prompt delivery: positional (append to args) or flag/stdin
        const delivery = agentCfg.resume_prompt_delivery || "flag";
        let stdinPrompt;
        if (delivery === "positional") {
            resolvedArgs.push(prompt);
            stdinPrompt = null;
        } else {
            stdinPrompt = prompt;
        }

        const subprocessCwd = resolvedArgs.includes("-C") ? null : cwd;
        const cmd = buildCommand(agentCfg, resolvedArgs);

        let result = await executeAgent(
            agentCfg, cmd, stdinPrompt, hardTimeout,
            heartbeatInterval, subprocessCwd, env,
            outputFile, logPath, agentName
        );

        // Check if resume actually worked
        const errorText = (
            (result.error || "") + " " + (result.response || "")
        ).toLowerCase();
        const resumeFailed = (
            !result.success
            && errorText.trim()
            && (errorText.includes("session")
                || errorText.includes("not found")
                || errorText.includes("expired")
                || errorText.includes("unexpected argument")
                || errorText.includes("unrecognized")
                || errorText.includes("invalid option")
                || errorText.includes("unknown flag"))
        );

        if (resumeFailed) {
            process.stderr.write(
                "WARNING: Session resume failed for " + agentName +
                " (session=" + resumeSession + "), " +
                "falling back to stateless. Error: " + result.error + "\n"
            );
            if (outputFile) {
                try {
                    fs.unlinkSync(outputFile);
                } catch {
                    // ignore
                }
            }
        } else {
            result.session_resumed = true;
            return result;
        }
    }

    // Normal (stateless) execution
    const resolvedArgs = resolveArgPlaceholders(
        agentCfg.args || [], context
    );
    const subprocessCwd = resolvedArgs.includes("-C") ? null : cwd;
    const cmd = buildCommand(agentCfg, resolvedArgs);

    const result = await executeAgent(
        agentCfg, cmd, prompt, hardTimeout,
        heartbeatInterval, subprocessCwd, env,
        outputFile, logPath, agentName
    );
    result.session_resumed = false;
    return result;
}


// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function printUsageAndExit(msg) {
    process.stderr.write("Error: " + msg + "\n");
    process.stderr.write(
        "Usage: node agent_runner.mjs --agent NAME --prompt TEXT\n" +
        "       node agent_runner.mjs --health-check\n" +
        "       node agent_runner.mjs --list-agents\n" +
        "       node agent_runner.mjs --verify-dead PID\n"
    );
    process.exit(2);
}


async function main() {
    let parsed;
    try {
        parsed = parseArgs({
            options: {
                agent: { type: "string" },
                prompt: { type: "string" },
                "prompt-file": { type: "string" },
                "output-file": { type: "string" },
                "log-file": { type: "string" },
                cwd: { type: "string" },
                timeout: { type: "string" },
                "resume-session": { type: "string" },
                "health-check": { type: "boolean", default: false },
                "list-agents": { type: "boolean", default: false },
                "verify-dead": { type: "string" },
            },
            strict: true,
            allowPositionals: false,
        });
    } catch (e) {
        printUsageAndExit(e.message);
        return; // unreachable, satisfies linter
    }

    const opts = parsed.values;
    const registry = loadRegistry();

    // --list-agents
    if (opts["list-agents"]) {
        for (const [name, cfg] of Object.entries(registry.agents)) {
            const groups = (cfg.skill_groups || []).join(", ") || "none";
            process.stdout.write(name + ": " + cfg.name + " (groups: " + groups + ")\n");
        }
        process.exit(0);
    }

    // --verify-dead PID
    if (opts["verify-dead"] != null) {
        const pid = parseInt(opts["verify-dead"], 10);
        if (isNaN(pid)) {
            printUsageAndExit("--verify-dead requires a numeric PID");
        }
        let alive = isProcessAlive(pid);
        if (alive) {
            process.stderr.write("PID " + pid + " still alive, attempting tree kill\n");
            killProcessTree(pid);
            // Brief wait for kill to take effect
            await new Promise((r) => setTimeout(r, 1000));
            alive = isProcessAlive(pid);
        }
        const status = alive ? "ALIVE" : "DEAD";
        process.stdout.write(JSON.stringify({ pid: pid, status: status }) + "\n");
        process.exit(alive ? 1 : 0);
    }

    // --health-check
    if (opts["health-check"]) {
        let allOk = true;
        for (const name of Object.keys(registry.agents)) {
            const { ok, info } = checkAgentHealth(name, registry);
            const status = ok ? "OK" : "UNAVAILABLE";
            process.stdout.write(name + ": " + status + " -- " + info + "\n");
            if (!ok) allOk = false;
        }
        process.exit(allOk ? 0 : 1);
    }

    // --agent required for execution
    if (!opts.agent) {
        printUsageAndExit("--agent is required (or use --health-check / --list-agents)");
    }

    // Resolve prompt
    let prompt = opts.prompt || null;
    if (opts["prompt-file"]) {
        prompt = fs.readFileSync(opts["prompt-file"], "utf-8");
    }
    if (!prompt) {
        printUsageAndExit("--prompt or --prompt-file is required");
    }
    prompt = preparePrompt(prompt);

    const timeoutVal = opts.timeout ? parseInt(opts.timeout, 10) : null;

    const result = await runAgent(
        opts.agent, prompt, opts.cwd || null, timeoutVal, registry,
        opts["output-file"] || null,
        opts["resume-session"] || null,
        opts["log-file"] || null
    );

    process.stdout.write(JSON.stringify(result) + "\n");

    const exitCode = result.success
        ? 0
        : ((result.error || "").includes("not found") ? 2 : 1);
    process.exit(exitCode);
}


main();
