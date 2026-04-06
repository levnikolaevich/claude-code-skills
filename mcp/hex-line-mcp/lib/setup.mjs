/**
 * Auto-sync hex-line hooks and output-style on MCP server startup.
 *
 * On every startup: compares source hook.mjs / output-style.md with installed copies.
 * If files differ or don't exist — runs full setup (copy files, write settings.json hooks).
 * If identical — no-op.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

// Stable hook location outside npm/npx cache.
const STABLE_HOOK_DIR = resolve(homedir(), ".claude", "hex-line");
const STABLE_HOOK_PATH = join(STABLE_HOOK_DIR, "hook.mjs").replace(/\\/g, "/");
const NODE_COMMAND = process.execPath.replace(/\\/g, "/");
const HOOK_COMMAND = `"${NODE_COMMAND}" "${STABLE_HOOK_PATH}"`;

// Source hook.mjs location (for copying).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE_HOOK = resolve(__dirname, "..", "hook.mjs");
const DIST_HOOK = resolve(__dirname, "hook.mjs");
const SOURCE_STYLE = resolve(__dirname, "..", "output-style.md");
const INSTALLED_STYLE = resolve(homedir(), ".claude", "output-styles", "hex-line.md");

const HOOK_SIGNATURE = "hex-line";

const CLAUDE_HOOKS = {
    SessionStart: {
        matcher: "*",
        hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 5 }],
    },
    PreToolUse: {
        matcher: "Read|Edit|Write|Grep|Bash|mcp__hex-line__.*",
        hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 5 }],
    },
    PostToolUse: {
        matcher: "Bash",
        hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 10 }],
    },
};

// ---- Helpers ----

function readJson(filePath) {
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
        process.stderr.write(`hex-line: warning — failed to parse ${filePath}, skipping\n`);
        return null;
    }
}

function writeJson(filePath, data) {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.hexline-tmp-${process.pid}`;
    try {
        writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
        renameSync(tmp, filePath);
    } catch (err) {
        try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
        throw err;
    }
}

function findEntryByCommand(entries) {
    return entries.findIndex(
        (e) => Array.isArray(e.hooks) && e.hooks.some((h) =>
            typeof h.command === "string" && h.command.includes(HOOK_SIGNATURE)
        )
    );
}

function safeRead(filePath) {
    try { return readFileSync(filePath, "utf-8"); } catch { return null; }
}

// ---- Core: write hooks to settings file ----

function writeHooksToFile(settingsPath) {
    const config = readJson(settingsPath) || {};
    if (!config.hooks || typeof config.hooks !== "object") config.hooks = {};

    let changed = false;
    for (const [event, desired] of Object.entries(CLAUDE_HOOKS)) {
        if (!Array.isArray(config.hooks[event])) config.hooks[event] = [];

        const entries = config.hooks[event];
        const idx = findEntryByCommand(entries);

        if (idx >= 0) {
            const existing = entries[idx];
            if (existing.matcher === desired.matcher &&
                existing.hooks.length === desired.hooks.length &&
                existing.hooks[0].command === HOOK_COMMAND &&
                existing.hooks[0].timeout === desired.hooks[0].timeout) {
                continue;
            }
            entries[idx] = { matcher: desired.matcher, hooks: [...desired.hooks] };
            changed = true;
        } else {
            entries.push({ matcher: desired.matcher, hooks: [...desired.hooks] });
            changed = true;
        }
    }


    if (changed) writeJson(settingsPath, config);
    return changed;
}

function cleanLocalHooks() {
    const localPath = resolve(process.cwd(), ".claude/settings.local.json");
    const config = readJson(localPath);
    if (!config || !config.hooks || typeof config.hooks !== "object") return;

    let changed = false;
    for (const event of Object.keys(CLAUDE_HOOKS)) {
        if (!Array.isArray(config.hooks[event])) continue;
        const idx = findEntryByCommand(config.hooks[event]);
        if (idx >= 0) {
            config.hooks[event].splice(idx, 1);
            changed = true;
        }
        if (config.hooks[event].length === 0) delete config.hooks[event];
    }
    if (Object.keys(config.hooks).length === 0) delete config.hooks;
    if (changed) writeJson(localPath, config);
}

function syncOutputStyle() {
    const source = safeRead(SOURCE_STYLE);
    if (!source) return false;

    const installed = safeRead(INSTALLED_STYLE);
    if (installed === source) return false;

    mkdirSync(dirname(INSTALLED_STYLE), { recursive: true });
    writeFileSync(INSTALLED_STYLE, source, "utf-8");

    // Activate style if none set
    const userSettings = resolve(homedir(), ".claude/settings.json");
    const config = readJson(userSettings) || {};
    if (!config.outputStyle) {
        config.outputStyle = "hex-line";
        writeJson(userSettings, config);
    }
    return true;
}

// ---- Public API ----

/**
 * Auto-sync hook + output-style on MCP server startup.
 * Compares source vs installed content. Updates only when different.
 * First run: full install (copy files, write settings.json hooks).
 */
export function autoSync() {
    const hookSource = existsSync(DIST_HOOK) ? DIST_HOOK : SOURCE_HOOK;
    if (!existsSync(hookSource)) return;

    const changes = [];

    // Sync hook.mjs
    const srcHook = safeRead(hookSource);
    const dstHook = safeRead(STABLE_HOOK_PATH);
    if (srcHook && srcHook !== dstHook) {
        mkdirSync(STABLE_HOOK_DIR, { recursive: true });
        copyFileSync(hookSource, STABLE_HOOK_PATH);
        changes.push("hook");
    }

    // Sync output-style.md
    if (syncOutputStyle()) changes.push("style");

    // Ensure hooks in settings.json
    const globalPath = resolve(homedir(), ".claude/settings.json");
    if (writeHooksToFile(globalPath)) changes.push("settings");

    // Clean per-project leftovers
    cleanLocalHooks();

    if (changes.length > 0) {
        process.stderr.write(`hex-line: synced ${changes.join(", ")}\n`);
    }
}
