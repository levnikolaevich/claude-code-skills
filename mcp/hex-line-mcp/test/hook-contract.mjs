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

function assertAdvisoryHint(output) {
    assert.ok(
        output.hookSpecificOutput,
        "Advisory response must include hookSpecificOutput"
    );
    assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.equal(
        output.hookSpecificOutput.permissionDecision,
        undefined,
        "advisory mode must NOT set permissionDecision"
    );
    assert.equal(
        typeof output.hookSpecificOutput.additionalContext,
        "string",
        "advisory mode must set hookSpecificOutput.additionalContext"
    );
    assert.ok(output.hookSpecificOutput.additionalContext.length > 0);
    assert.equal(typeof output.systemMessage, "string", "advisory must set systemMessage");
}

function setHookMode(cwd, mode) {
    mkdirSync(join(cwd, ".hex-skills"), { recursive: true });
    writeFileSync(
        join(cwd, ".hex-skills", "environment_state.json"),
        JSON.stringify({
            scanned_at: "2026-04-16T00:00:00Z",
            agents: { codex: { available: true } },
            hooks: { mode },
        }),
        "utf8"
    );
}

function clearHookMode(cwd) {
    rmSync(join(cwd, ".hex-skills"), { recursive: true, force: true });
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

    it("default mode advises for project-scoped Read without blocking", () => {
        clearHookMode(tmpRoot);
        const filePath = join(tmpRoot, "README.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Read",
                tool_input: { file_path: filePath },
            },
        });
        assert.equal(result.status, 0);
        const output = parseStructuredOutput(result.stdout);
        assertAdvisoryHint(output);
        assert.match(output.systemMessage || "", /edit_ready=true/);
    });

    it("explicit blocking mode emits hookEventName for project-scoped Read", () => {
        setHookMode(tmpRoot, "blocking");
        const filePath = join(tmpRoot, "README.md");
        try {
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
        } finally {
            clearHookMode(tmpRoot);
        }
    });

    it("default mode advises for project-scoped Edit without blocking", () => {
        clearHookMode(tmpRoot);
        const filePath = join(tmpRoot, "README.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                tool_name: "Edit",
                tool_input: { file_path: filePath, old_string: "# test", new_string: "# test2" },
            },
        });
        assert.equal(result.status, 0);
        const output = parseStructuredOutput(result.stdout);
        assertAdvisoryHint(output);
        assert.match(output.systemMessage || "", /set_line/);
    });

    it("explicit blocking mode emits hookEventName for project-scoped Edit", () => {
        setHookMode(tmpRoot, "blocking");
        const filePath = join(tmpRoot, "README.md");
        try {
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
        } finally {
            clearHookMode(tmpRoot);
        }
    });

    it("advise() omits permissionDecision and uses additionalContext in advisory mode", () => {
        setHookMode(tmpRoot, "advisory");
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
            assert.equal(result.status, 0, "advisory mode must exit 0");
            const output = parseStructuredOutput(result.stdout);
            assertAdvisoryHint(output);
        } finally {
            clearHookMode(tmpRoot);
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

    // ---- Plan mode enforcement ----

    it("blocks mutating hex-line tools in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__edit_file",
                tool_input: { file_path: "foo.md" },
            },
        });
        assert.equal(result.status, 2, "plan mode must hard-block mutating hex-line tools");
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
        assert.ok(
            output.hookSpecificOutput.permissionDecisionReason.includes("PLAN_MODE"),
            "reason must mention PLAN_MODE"
        );
    });

    it("blocks write_file in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__write_file",
                tool_input: { file_path: "foo.md", content: "x" },
            },
        });
        assert.equal(result.status, 2);
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
    });

    it("blocks bulk_replace in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__bulk_replace",
                tool_input: { path: ".", replacements: [] },
            },
        });
        assert.equal(result.status, 2);
        const output = parseStructuredOutput(result.stdout);
        assertPreToolUseSchema(output, "deny");
    });

    it("allows read-only hex-line tools in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__read_file",
                tool_input: { path: "foo.md" },
            },
        });
        assert.equal(result.status, 0, "read-only hex-line tools must pass in plan mode");
    });

    it("allows built-in Read on plan markdown files in plan mode", () => {
        const filePath = join(tmpRoot, "plan_hook_fix.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "Read",
                tool_input: { file_path: filePath },
            },
        });
        assert.equal(result.status, 0);
        assert.equal(result.stdout, "", "plan file Read must pass through silently");
    });

    it("allows built-in Edit on plan markdown files in plan mode", () => {
        const filePath = join(tmpRoot, "plan_hook_fix.md");
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "Edit",
                tool_input: { file_path: filePath, old_string: "a", new_string: "b" },
            },
        });
        assert.equal(result.status, 0);
        assert.equal(result.stdout, "", "plan file Edit must pass through silently");
    });

    it("allows hex-line write to .hex-skills/ in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__write_file",
                tool_input: { file_path: ".hex-skills/agent-review/codex/result.md", content: "x" },
            },
        });
        assert.equal(result.status, 0, ".hex-skills/ writes must pass in plan mode");
    });

    it("allows hex-line edit to .claude/ in plan mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "plan",
                tool_name: "mcp__hex-line__edit_file",
                tool_input: { path: "C:\\Users\\test\\.claude\\plans\\myplan.md", edits: [] },
            },
        });
        assert.equal(result.status, 0, ".claude/ writes must pass in plan mode");
    });

    it("does not block hex-line edit in default mode", () => {
        const result = runHook({
            cwd: tmpRoot,
            payload: {
                hook_event_name: "PreToolUse",
                permission_mode: "default",
                tool_name: "mcp__hex-line__edit_file",
                tool_input: { path: "foo.md" },
            },
        });
        assert.equal(result.status, 0, "edit_file must pass in default mode");
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
