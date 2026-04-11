import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = resolve(__dirname, "..", "hook.mjs");

// Regression guard for https://github.com/levnikolaevich/claude-code-skills commit 5a4b0ed
// (hex-line-mcp v1.7.0). That release dropped hookSpecificOutput.hookEventName from the
// PreToolUse block()/advise() output. Claude Code's hook schema validator rejects JSON
// without hookEventName, emits hook_non_blocking_error to the session transcript, and
// silently lets the tool proceed. PostToolUse RTK filtering kept working because it
// uses the legacy stderr+exit2 feedback path, not structured JSON. This test spawns
// hook.mjs with realistic PreToolUse payloads and asserts schema compliance.

const PRETOOLUSE_DECISIONS = new Set(["allow", "deny", "ask", "defer"]);

function runHook({ cwd, payload }) {
    const result = spawnSync(process.execPath, [HOOK_PATH], {
        cwd,
        input: JSON.stringify(payload),
        encoding: "utf8",
    });
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}

function parseStructuredOutput(stdout) {
    assert.ok(stdout && stdout.length > 0, `hook wrote no stdout. full result: ${stdout}`);
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    } catch (err) {
        throw new Error(`hook stdout was not valid JSON: ${err.message}\n---\n${stdout}\n---`);
    }
    return parsed;
}

function assertPreToolUseSchema(output, expectedDecision) {
    assert.ok(
        output.hookSpecificOutput,
        "PreToolUse response must include hookSpecificOutput (Claude Code schema contract)"
    );
    assert.equal(
        output.hookSpecificOutput.hookEventName,
        "PreToolUse",
        "hookSpecificOutput.hookEventName must be 'PreToolUse' — missing field makes Claude Code drop the decision and log hook_non_blocking_error"
    );
    assert.ok(
        PRETOOLUSE_DECISIONS.has(output.hookSpecificOutput.permissionDecision),
        `permissionDecision must be one of ${[...PRETOOLUSE_DECISIONS].join("/")}, got ${output.hookSpecificOutput.permissionDecision}`
    );
    if (expectedDecision) {
        assert.equal(output.hookSpecificOutput.permissionDecision, expectedDecision);
    }
    assert.equal(
        typeof output.hookSpecificOutput.permissionDecisionReason,
        "string",
        "permissionDecisionReason must be a string so Claude sees why the decision was made"
    );
    assert.ok(
        output.hookSpecificOutput.permissionDecisionReason.length > 0,
        "permissionDecisionReason must not be empty"
    );
}

describe("hook PreToolUse JSON schema", () => {
    let tmpRoot;

    before(() => {
        tmpRoot = mkdtempSync(join(tmpdir(), "hex-hook-contract-"));
        writeFileSync(join(tmpRoot, "README.md"), "# test\n", "utf8");
    });

    after(() => {
        rmSync(tmpRoot, { recursive: true, force: true });
    });

    it("block() emits hookEventName for dangerous Bash commands (regression for v1.7.0)", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Bash",
                tool_input: { command: "rm -rf /tmp/xyz" },
            },
        });
        assert.equal(result.status, 2, "dangerous command must exit with code 2 (block)");
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
        assert.match(
            output.systemMessage || "",
            /DANGEROUS/,
            "systemMessage must explain why"
        );
    });

    it("block() emits hookEventName for project-scoped Read", () => {
        const filePath = join(tmpRoot, "README.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Read",
                tool_input: { file_path: filePath },
            },
        });
        assert.equal(result.status, 2);
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
        assert.match(output.systemMessage || "", /mcp__hex-line__/);
    });

    it("block() emits hookEventName for project-scoped Edit", () => {
        const filePath = join(tmpRoot, "README.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Edit",
                tool_input: { file_path: filePath, old_string: "# test", new_string: "# test2" },
            },
        });
        assert.equal(result.status, 2);
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
    });

    it("advise() emits hookEventName when hooks.mode is advisory", () => {
        mkdirSync(join(tmpRoot, ".hex-skills"), { recursive: true });
        writeFileSync(
            join(tmpRoot, ".hex-skills", "environment_state.json"),
            JSON.stringify({ scanned_at: "2026-04-11T00:00:00Z", agents: { codex: { available: true }, gemini: { available: true } }, hooks: { mode: "advisory" } }),
            "utf8"
        );
        try {
            const filePath = join(tmpRoot, "README.md");
            const result = runHook({
                cwd: tmpRoot,
                payload: {
                    hook_event_name: "PreToolUse",
                    tool_name: "Read",
                    tool_input: { file_path: filePath },
                },
            });
            assert.equal(result.status, 0, "advisory mode must exit 0 (allow)");
            const output = parseStructuredOutput(result.stdout);
            assertPreToolUseSchema(output, "allow");
        } finally {
            rmSync(join(tmpRoot, ".hex-skills"), { recursive: true, force: true });
        }
    });

    it("passes through mcp__hex-line__* tools without writing stdout", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "mcp__hex-line__read_file",
                tool_input: { path: join(tmpRoot, "README.md") },
            },
        });
        assert.equal(result.status, 0, "mcp__hex-line__ tools must always pass through");
        assert.equal(result.stdout, "", "pass-through must not write stdout");
    });

    it("passes through Read on files outside the current project root", () => {
        const outsidePath = process.platform === "win32"
            ? "C:/Windows/System32/drivers/etc/hosts"
            : "/etc/hosts";
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Read",
                tool_input: { file_path: outsidePath },
            },
        });
        assert.equal(result.status, 0);
        assert.equal(result.stdout, "", "paths outside project root must pass through silently");
    });
});
