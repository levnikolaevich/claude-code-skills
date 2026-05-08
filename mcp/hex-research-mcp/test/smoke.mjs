import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PACKAGE_ROOT, assertStructuredMirror, copyFixture, cleanup } from "./helpers.mjs";
import { TOOL_NAMES } from "../lib/constants.mjs";

async function withClient(run) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-research-smoke", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "node",
        args: ["server.mjs"],
        cwd: PACKAGE_ROOT,
        stderr: "pipe",
    });
    try {
        await client.connect(transport);
        return await run(client);
    } finally {
        await transport.close().catch(() => {});
    }
}

describe("server smoke", () => {
    it("starts and exposes exactly the registered annotated tools", async () => {
        await withClient(async (client) => {
            const listed = await client.listTools();
            const names = listed.tools.map(t => t.name).sort();
            assert.deepEqual(names, [...TOOL_NAMES].sort());
            for (const tool of listed.tools) {
                assert.ok(tool.inputSchema, `${tool.name} has input schema`);
                assert.ok(tool.outputSchema, `${tool.name} has output schema`);
                assert.ok(tool.annotations, `${tool.name} has annotations`);
            }
            const byName = Object.fromEntries(listed.tools.map(t => [t.name, t]));
            assert.equal(byName.index_hypotheses.annotations.readOnlyHint, false);
            assert.equal(byName.export_canvas.annotations.readOnlyHint, false);
            assert.equal(byName.find_hypotheses.annotations.readOnlyHint, true);
        });
    });

    it("returns structuredContent mirrored in text content", async () => {
        const dir = copyFixture("smoke");
        try {
            await withClient(async (client) => {
                const result = await client.callTool({ name: "index_hypotheses", arguments: { path: dir } });
                assertStructuredMirror(result);
                assert.equal(result.structuredContent.status, "OK");
            });
        } finally {
            cleanup(dir);
        }
    });
});
