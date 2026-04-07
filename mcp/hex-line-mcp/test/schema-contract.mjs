import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, "..");

async function withMcpClient(run) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-line-schema-contract", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "node",
        args: ["server.mjs"],
        cwd: CWD,
        stderr: "pipe",
    });
    try {
        await client.connect(transport);
        return await run(client);
    } finally {
        await transport.close().catch(() => {});
    }
}

function toolByName(tools, name) {
    const tool = tools.find(entry => entry.name === name);
    assert.ok(tool, `Tool '${name}' must exist`);
    return tool;
}

describe("schema descriptions", () => {
    it("listTools preserves discovery-first read/search property descriptions under Zod 4", async () => {
        await withMcpClient(async (client) => {
            const result = await client.listTools();
            assert.equal(result.tools.length, 9, "hex-line exposes the compact 9-tool surface");
            const inspectPath = toolByName(result.tools, "inspect_path");
            const readFile = toolByName(result.tools, "read_file");
            const readProps = readFile.inputSchema.properties || {};
            assert.equal(readProps.path?.description, "File path");
            assert.equal(readProps.offset?.description, "Start line (1-indexed, default: 1)");
            assert.equal(readProps.verbosity?.description, "Response budget. `minimal` is discovery-first, `compact` adds revision context, `full` preserves the richest payload.");
            assert.equal(readProps.edit_ready?.description, "Include hash/checksum edit protocol blocks explicitly. Default: false for discovery reads.");
            assert.equal(readProps.include_graph, undefined);

            const grepSearch = toolByName(result.tools, "grep_search");
            const grepProps = grepSearch.inputSchema.properties || {};
            assert.equal(grepProps.output?.description, "Output format (default: summary)");
            assert.equal(grepProps.edit_ready?.description, "Preserve hash/checksum search hunks in `content` mode. Default: false.");

            const inspectProps = inspectPath.inputSchema.properties || {};
            assert.equal(inspectProps.verbosity?.description, "Response budget. `minimal` returns the shortest tree summary.");
        });
    });
});
