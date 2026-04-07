import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, "..");

async function withMcpClient(run) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-graph-schema-contract", version: "1.0.0" }, { capabilities: {} });
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
    it("listTools preserves graph property descriptions under Zod 4", async () => {
        await withMcpClient(async (client) => {
            const result = await client.listTools();
            const exportScip = toolByName(result.tools, "export_scip");
            const exportProps = exportScip.inputSchema.properties || {};
            assert.equal(exportProps.path?.description, "Indexed project root");
            assert.equal(exportProps.language?.description, "SCIP export backend. `typescript` uses the native compiler lane; `python`, `php`, and `csharp` orchestrate official SCIP indexers.");

            const installProviders = toolByName(result.tools, "install_graph_providers");
            const providerProps = installProviders.inputSchema.properties || {};
            assert.equal(providerProps.path?.description, "Project root used for language detection and provider planning");
            assert.equal(providerProps.mode?.description, "`check` reports the plan and remediation steps only. `install` runs the provider install commands when they are available for the current platform.");

            const changes = toolByName(result.tools, "analyze_changes");
            const changeProps = changes.inputSchema.properties || {};
            assert.equal(changeProps.base_ref?.description, "Git baseline ref used to compute the changed-symbol set");
            assert.equal(changeProps.include_paths?.description, "Include reverse mixed graph paths for the returned symbols. Default is false to keep the snapshot compact.");

            const editRegion = toolByName(result.tools, "analyze_edit_region");
            const editProps = editRegion.inputSchema.properties || {};
            assert.equal(editProps.file?.description, "File path inside the indexed project. Absolute paths are accepted when they stay inside the project root.");
            assert.equal(editProps.verbosity?.description, "Response budget. `minimal` returns the shortest actionable answer, `compact` keeps key reasoning visible, and `full` includes supporting detail.");

            const architecture = toolByName(result.tools, "analyze_architecture");
            const architectureProps = architecture.inputSchema.properties || {};
            assert.equal(architectureProps.limit?.description, "Max module, cycle, coupling, and hotspot rows to surface (default: 5)");

            const audit = toolByName(result.tools, "audit_workspace");
            const auditProps = audit.inputSchema.properties || {};
            assert.equal(auditProps.show_suppressed?.description, "Include suppressed unused exports in the visible result");
        });
    });
});
