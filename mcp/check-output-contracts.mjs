#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { errorResult, result } from "./hex-common/src/runtime/results.mjs";
import { classifyMcpFailure } from "./hex-common/src/runtime/error-classifier.mjs";

const ROOT = resolve(import.meta.dirname, "..");

const requiredFiles = [
    "docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md",
    "docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md",
    ".claude/commands/publish-mcp.md",
    "mcp/hex-common/src/runtime/error-classifier.mjs",
    "mcp/hex-common/src/runtime/results.mjs",
    "mcp/hex-line-mcp/README.md",
    "mcp/hex-line-mcp/output-style.md",
    "mcp/hex-line-mcp/server.mjs",
    "mcp/hex-graph-mcp/README.md",
    "mcp/hex-graph-mcp/server.mjs",
    "mcp/hex-ssh-mcp/server.mjs",
    "mcp/hex-line-mcp/.gitignore",
    "mcp/hex-graph-mcp/.gitignore",
    "mcp/hex-ssh-mcp/.gitignore",
    "site/mcp/hex-line.html",
];

const checks = [
    {
        file: "docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md",
        includes: ["failure_class", "clean-cut migrations", "Cannot read properties of undefined"],
        excludes: ["DEPRECATED: use X instead", "Deprecate before removing"],
    },
    {
        file: "docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md",
        includes: ["failure_class", "fix_permissions", "install_tool", "authenticate", "defer_retry", "retry_after_wait"],
    },
    {
        file: "mcp/hex-common/src/runtime/error-classifier.mjs",
        includes: ["permission_denial", "tool_missing", "auth_missing", "rate_limited", "timeout_idle", "classifyMcpFailure"],
    },
    {
        file: "mcp/hex-common/src/runtime/results.mjs",
        includes: ["classifyMcpFailure", "failure_class", "next_action", "recovery"],
    },
    {
        file: ".claude/commands/publish-mcp.md",
        includes: ["MCP_OUTPUT_CONTRACT_GUIDE.md", "retry_plan", "status/reason/next_action vocabulary"],
    },
    {
        file: "mcp/hex-line-mcp/server.mjs",
        includes: ["retry_plan", "suggested_read_call", "canonical status, next_action", "validateEditPayload", "INVALID_EDIT_PAYLOAD", "failure_class"],
    },
    {
        file: "mcp/hex-line-mcp/test/smoke.mjs",
        includes: ["malformed nested payloads before raw TypeError", "INVALID_EDIT_PAYLOAD", "failure_class"],
    },
    {
        file: "mcp/hex-line-mcp/README.md",
        includes: ["next_action:", "retry_plan:"],
        excludes: ["Run hex-line setup_hooks"],
    },
    {
        file: "mcp/hex-line-mcp/output-style.md",
        includes: ["retry_plan", "next_action"],
    },
    {
        file: "site/mcp/hex-line.html",
        excludes: ["Run hex-line setup_hooks", "Read is blocked", "first 12 + last 12 lines"],
    },
    {
        file: "mcp/hex-graph-mcp/README.md",
        includes: ["next_action", "status"],
    },
    {
        file: "mcp/hex-graph-mcp/server.mjs",
        includes: ["status: STATUS.OK", "GRAPH_DB_BUSY", "classifyMcpFailure", "!failure_class"],
    },
    {
        file: "mcp/hex-ssh-mcp/server.mjs",
        includes: ["failure_class", "SSH_OUTPUT_SCHEMA", "SSH_RECOVERY_BY_CODE", "SSH_AUTH_MISSING", "REMOTE_SSH_DISABLED"],
    },
    {
        file: "mcp/hex-ssh-mcp/test/schema-contract.mjs",
        includes: ["recovery classification fields", "failure_class"],
    },
    {
        file: "mcp/package.json",
        includes: ["\"test\"", "check-output-contracts.mjs", "@levnikolaevich/hex-line-mcp", "@levnikolaevich/hex-graph-mcp", "@levnikolaevich/hex-ssh-mcp"],
    },
];

const failures = [];

function sectionBetween(text, startMarker, endMarker) {
    const start = text.indexOf(startMarker);
    if (start === -1) return "";
    const end = text.indexOf(endMarker, start + startMarker.length);
    return end === -1 ? text.slice(start) : text.slice(start, end);
}

for (const relPath of requiredFiles) {
    if (!existsSync(resolve(ROOT, relPath))) failures.push(`missing file: ${relPath}`);
}

for (const rule of checks) {
    const absPath = resolve(ROOT, rule.file);
    if (!existsSync(absPath)) continue;
    const text = readFileSync(absPath, "utf8");
    for (const token of rule.includes || []) {
        if (!text.includes(token)) failures.push(`${rule.file} missing token: ${token}`);
    }
    for (const token of rule.excludes || []) {
        if (text.includes(token)) failures.push(`${rule.file} still contains stale token: ${token}`);
    }
}

const hexLineServerPath = resolve(ROOT, "mcp/hex-line-mcp/server.mjs");
if (existsSync(hexLineServerPath)) {
    const text = readFileSync(hexLineServerPath, "utf8");
    for (const [tool, endMarker] of [
        ["edit_file", "// ==================== write_file ===================="],
        ["verify", "// ==================== inspect_path ===================="],
        ["changes", "// ==================== bulk_replace ===================="],
        ["bulk_replace", "// --- Start ---"],
    ]) {
        const section = sectionBetween(text, `// ==================== ${tool} ====================`, endMarker);
        if (!section.includes("lineReportResult(")) {
            failures.push(`mcp/hex-line-mcp/server.mjs ${tool} must expose line-report status through structuredContent`);
        }
    }
}

const hexLineSmokePath = resolve(ROOT, "mcp/hex-line-mcp/test/smoke.mjs");
if (existsSync(hexLineSmokePath)) {
    const text = readFileSync(hexLineSmokePath, "utf8");
    for (const status of ["NO_CHANGES", "CHANGED", "STALE", "AUTO_REBASED", "CONFLICT"]) {
        if (!text.includes(`structuredContent.status, "${status}"`)) {
            failures.push(`mcp/hex-line-mcp/test/smoke.mjs missing structured status assertion: ${status}`);
        }
    }
}

function assertBehavior(name, fn) {
    try {
        fn();
    } catch (error) {
        failures.push(`${name}: ${error.message}`);
    }
}

function assertCanonicalErrorEnvelope(payload) {
    assert.equal(payload.status, "ERROR");
    assert.equal(typeof payload.code, "string");
    assert.equal(typeof payload.summary, "string");
    assert.equal(typeof payload.next_action, "string");
    assert.equal(typeof payload.recovery, "string");
    assert.equal(typeof payload.failure_class, "string");
    assert.deepEqual(Object.keys(payload.error).sort(), ["code", "message", "recovery"]);
}

assertBehavior("hex-common result() mirrors structuredContent as JSON text", () => {
    const ok = result({ status: "OK", content: "value" });
    assert.deepEqual(JSON.parse(ok.content[0].text), ok.structuredContent);
    assert.equal(ok.isError, undefined);
});

assertBehavior("hex-common errorResult() emits behavior contract fields", () => {
    const denied = errorResult("REMOTE_SSH_DISABLED", "remote-ssh disabled", "enable mode");
    assertCanonicalErrorEnvelope(denied.structuredContent);
    assert.equal(denied.isError, true);
    assert.equal(denied.structuredContent.failure_class, "permission_denial");
    assert.equal(denied.structuredContent.next_action, "fix_permissions");
    assert.deepEqual(JSON.parse(denied.content[0].text), denied.structuredContent);

    const timeout = errorResult("GRAPH_DB_BUSY", "database is locked", "wait");
    assert.equal(timeout.structuredContent.failure_class, "timeout_idle");
    assert.equal(timeout.structuredContent.next_action, "retry_after_wait");
});

assertBehavior("classifyMcpFailure maps MCP recovery signals deterministically", () => {
    assert.equal(classifyMcpFailure({ code: "SSH_AUTH_MISSING", message: "No user for host" }).failure_class, "auth_missing");
    assert.equal(classifyMcpFailure({ code: "GRAPH_PROVIDER_SETUP_FAILED", message: "missing provider" }).failure_class, "tool_missing");
    assert.equal(classifyMcpFailure({ code: "RATE_LIMITED", message: "429 too many requests" }).next_action, "defer_retry");
    assert.equal(classifyMcpFailure({ code: "BAD_REMOTE_PLATFORM", message: "bad platform" }).next_action, "fix_inputs");
});

assertBehavior("root MCP package exposes aggregate workflows", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "mcp/package.json"), "utf8"));
    assert.match(pkg.scripts.test, /check-output-contracts\.mjs/);
    assert.match(pkg.scripts.test, /hex-common/);
    assert.match(pkg.scripts.test, /hex-line-mcp/);
    assert.match(pkg.scripts.test, /hex-graph-mcp/);
    assert.match(pkg.scripts.test, /hex-ssh-mcp/);
    assert.match(pkg.scripts.check, /check-output-contracts\.mjs/);
    assert.match(pkg.scripts.build, /--workspaces/);
});

for (const relPath of [
    "mcp/hex-line-mcp/.gitignore",
    "mcp/hex-graph-mcp/.gitignore",
    "mcp/hex-ssh-mcp/.gitignore",
]) {
    assertBehavior(`${relPath} ignores package-local generated artifacts`, () => {
        const text = readFileSync(resolve(ROOT, relPath), "utf8");
        for (const token of ["node_modules/", "dist/", ".hex-skills/", ".codegraph/"]) {
            assert.ok(text.includes(token), `${relPath} missing ${token}`);
        }
    });
}

if (failures.length) {
    console.error("MCP output contract drift detected:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log("MCP output contract checks passed.");
