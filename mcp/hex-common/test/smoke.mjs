import test from "node:test";
import assert from "node:assert/strict";

import { fnv1a, lineTag, rangeChecksum, parseChecksum, parseRef } from "../src/text-protocol/hash.mjs";
import { deduplicateLines, smartTruncate } from "../src/output/normalize.mjs";
import { grammarForExtension, isSupportedExtension, supportedExtensions } from "../src/parser/languages.mjs";
import { getParser, getLanguage, treeSitterArtifactManifest, treeSitterArtifactPath } from "../src/parser/tree-sitter.mjs";
import { existsSync } from "node:fs";

import { result, errorResult } from "../src/runtime/results.mjs";


test("hash protocol stays stable", () => {
    const hash = fnv1a("const x = 1;");
    assert.equal(lineTag(hash).length, 2);
    assert.equal(parseChecksum(rangeChecksum([hash], 1, 1)).start, 1);
    assert.deepEqual(parseRef("ab.12"), { tag: "ab", line: 12 });
});

test("normalize helpers deduplicate and truncate", () => {
    assert.deepEqual(deduplicateLines(["error 123", "error 456"]), ["error 123  (x2)"]);
    assert.match(smartTruncate(Array.from({ length: 80 }, (_, i) => `l${i}`).join("\n")), /omitted/);
});

test("runtime and parser helpers are stable", () => {
    assert.equal(grammarForExtension(".ts"), "typescript");
    assert.equal(isSupportedExtension(".tsx"), true);
});

test("tree-sitter artifacts: manifest covers all supported grammars", () => {
    const manifest = treeSitterArtifactManifest();
    const grammars = [...new Set(supportedExtensions().map(ext => grammarForExtension(ext)))];
    const declared = new Set((manifest.grammars || []).map(item => item.grammar));
    assert.deepEqual([...declared].sort(), [...grammars].sort(), "manifest matches languages.mjs grammar set");
});

test("tree-sitter artifacts: WASM files exist for all supported grammars", () => {
    const grammars = [...new Set(supportedExtensions().map(ext => grammarForExtension(ext)))];
    const missing = grammars.filter(g => {
        const wasm = treeSitterArtifactPath(g);
        return !existsSync(wasm);
    });
    assert.deepEqual(missing, [], `WASM files missing for: ${missing.join(", ")}`);
});

test("tree-sitter: parser loads and parses JS source", async () => {
    const parser = await getParser();
    assert.ok(parser, "getParser() returned null");
    const lang = await getLanguage("javascript");
    assert.ok(lang, "getLanguage('javascript') returned null");
    parser.setLanguage(lang);
    const tree = parser.parse("const x = 1;");
    assert.ok(tree.rootNode, "parse returned no rootNode");
    assert.equal(tree.rootNode.type, "program");
});

test("SDK subpath imports resolve", async () => {
    const mcp = await import("@modelcontextprotocol/sdk/server/mcp.js");
    assert.ok(mcp.McpServer, "McpServer not exported from SDK");
    const stdio = await import("@modelcontextprotocol/sdk/server/stdio.js");
    assert.ok(stdio.StdioServerTransport, "StdioServerTransport not exported from SDK");
});

test("result() returns canonical MCP envelope", () => {
    const r = result({ status: "OK", path: "test.txt", content: "hello" });
    assert.deepEqual(r.content, [{ type: "text", text: JSON.stringify(r.structuredContent) }]);
    assert.deepEqual(r.structuredContent, { status: "OK", path: "test.txt", content: "hello" });
    assert.equal(r.isError, undefined);
    assert.equal(r._meta, undefined);
});

test("result() with large=true sets _meta", () => {
    const r = result({ status: "OK" }, { large: true });
    assert.deepEqual(r._meta, { "anthropic/maxResultSizeChars": 500_000 });
});

test("result() with status ERROR sets isError", () => {
    const r = result({ status: "ERROR", error: { code: "X", message: "fail", recovery: "fix" } });
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent.status, "ERROR");
});

test("errorResult() builds canonical error envelope", () => {
    const r = errorResult("NOT_FOUND", "file missing", "check path");
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent.status, "ERROR");
    assert.equal(r.structuredContent.code, "NOT_FOUND");
    assert.equal(r.structuredContent.summary, "file missing");
    assert.equal(r.structuredContent.next_action, "fix_inputs");
    assert.equal(r.structuredContent.recovery, "check path");
    assert.equal(r.structuredContent.failure_class, "unknown");
    assert.equal(r.structuredContent.error.code, "NOT_FOUND");
    assert.equal(r.structuredContent.error.message, "file missing");
    assert.equal(r.structuredContent.error.recovery, "check path");
    assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent);
});

test("errorResult() with extra preserves domain fields", () => {
    const r = errorResult("SSH_ERROR", "conn fail", "retry", {
        extra: { host: "server1", exit_code: 1, next_action: "fix_connection" },
    });
    assert.equal(r.structuredContent.host, "server1");
    assert.equal(r.structuredContent.exit_code, 1);
    assert.equal(r.structuredContent.next_action, "fix_connection");
    assert.equal(r.structuredContent.error.code, "SSH_ERROR");
});

test("errorResult() classifies recoverable MCP failure classes", () => {
    assert.equal(errorResult("EACCES", "permission denied", "fix perms").structuredContent.failure_class, "permission_denial");
    assert.equal(errorResult("ENOENT", "command not found: rg", "install rg").structuredContent.failure_class, "tool_missing");
    assert.equal(errorResult("AUTH_FAILED", "permission denied (publickey)", "configure key").structuredContent.failure_class, "auth_missing");
    assert.equal(errorResult("RATE_LIMITED", "429 too many requests", "wait").structuredContent.failure_class, "rate_limited");
    assert.equal(errorResult("TRANSFER_TIMEOUT", "operation timed out", "retry later").structuredContent.failure_class, "timeout_idle");
    assert.equal(errorResult("GRAPH_DB_BUSY", "database is locked", "close DB clients").structuredContent.failure_class, "timeout_idle");
    assert.equal(errorResult("GRAPH_PROVIDER_SETUP_FAILED", "provider setup failed", "install provider").structuredContent.failure_class, "tool_missing");
    assert.equal(errorResult("SSH_AUTH_FAILED", "No user for host", "configure ssh user").structuredContent.failure_class, "auth_missing");
    assert.equal(errorResult("REMOTE_SSH_DISABLED", "remote-ssh disabled", "enable mode").structuredContent.failure_class, "permission_denial");
    assert.equal(errorResult("SSH_HOST_NOT_ALLOWED", "host not in ALLOWED_HOSTS", "allow host").structuredContent.failure_class, "permission_denial");
    assert.equal(errorResult("SSH_EXEC_TIMEOUT", "command exceeded limit", "retry later").structuredContent.failure_class, "timeout_idle");
    assert.equal(errorResult("BAD_REMOTE_PLATFORM", "bad platform", "fix input").structuredContent.next_action, "fix_inputs");
    assert.equal(errorResult("INVALID_INPUT", "missing edits field", "fix input").structuredContent.next_action, "fix_inputs");
});
