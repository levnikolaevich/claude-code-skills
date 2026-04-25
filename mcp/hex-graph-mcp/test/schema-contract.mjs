import { before, after, describe, it } from "node:test";
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
            assert.equal(auditProps.limit?.description, "Max unused, hotspot, and clone group rows to surface (default: 5, capped at 25)");
            assert.equal(auditProps.clone_member_limit?.description, "Max clone members per group to surface (default: 3, or 10 with verbosity=full, capped at 25)");

            const inspect = toolByName(result.tools, "inspect_symbol");
            const inspectProps = inspect.inputSchema.properties || {};
            assert.equal(inspectProps.verbosity?.description, "Response budget. `minimal` returns the shortest actionable answer, `compact` keeps key reasoning visible, and `full` includes supporting detail.");
            assert.equal(inspectProps.expand_limit?.description, "Max rows to materialize for expanded sections (default: 10, capped at 25)");

            const refs = toolByName(result.tools, "find_references");
            const refsProps = refs.inputSchema.properties || {};
            assert.equal(refsProps.expand?.description, "Optional bounded expansion sections to materialize. Heavy tools return counts/previews by default and expand only the requested sections.");
            assert.equal(refsProps.include_evidence?.description, "Include supporting evidence in expanded rows. Defaults to false to keep payloads compact.");

            const trace = toolByName(result.tools, "trace_paths");
            const traceProps = trace.inputSchema.properties || {};
            assert.equal(traceProps.expand_limit?.description, "Max rows to materialize for expanded sections (default: 10, capped at 25)");

            const flow = toolByName(result.tools, "trace_dataflow");
            const flowProps = flow.inputSchema.properties || {};
            assert.equal(flowProps.include_evidence?.description, "Include supporting evidence in expanded rows. Defaults to false to keep payloads compact.");

            for (const tool of result.tools) {
                assert.equal(tool.inputSchema.properties?.format, undefined, `${tool.name} must not expose legacy format switching`);
            }
        });
    });
});

describe("output envelope validation", () => {
    const ACTION_LINE_RE = /^(ok|partial|not_found|stale|error)\s+[a-z_]+/;
    const VALID_STATUSES = new Set(["ok", "partial", "not_found", "stale", "error"]);

    it("install_graph_providers emits text-only envelope with valid action-line", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "install_graph_providers",
                arguments: { path: CWD, mode: "check" },
            });
            assert.notEqual(result.isError, true, `install_graph_providers must succeed: ${JSON.stringify(result).slice(0, 300)}`);
            // Text-only invariant: no structuredContent mirror, single content[0].text.
            assert.equal(result.structuredContent, undefined, "structuredContent must not be emitted");
            assert.ok(Array.isArray(result.content) && result.content[0]?.type === "text", "content[0] must be text");
            const text = result.content[0].text;
            const firstLine = text.split("\n", 1)[0];
            assert.match(firstLine, ACTION_LINE_RE, `first line must be a valid action-line, got: ${firstLine}`);
            const status = firstLine.split(/\s+/, 1)[0];
            assert.ok(VALID_STATUSES.has(status), `status must be one of ${[...VALID_STATUSES].join(",")}, got: ${status}`);
        });
    });

    it("graph errors expose failure_class in text grammar", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "analyze_edit_region",
                arguments: { path: CWD, file: resolve(CWD, "..", "outside.ts") },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            assert.match(text.split("\n", 1)[0], /^error\s+[a-z_]+/);
            assert.match(text, /!code=/);
            assert.match(text, /!failure_class=unknown/);
        });
    });

    it("provider setup errors classify missing tools", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "install_graph_providers",
                arguments: { path: "Z:/definitely/missing", mode: "check" },
            });
            const text = result.content[0].text;
            assert.match(text.split("\n", 1)[0], /^error\s+check_provider_setup/);
            assert.match(text, /!code=GRAPH_PROVIDER_SETUP_FAILED/);
            assert.match(text, /!failure_class=tool_missing/);
        });
    });

    it("inspect_symbol with include_evidence:true emits text-only envelope", async () => {
        const fixture = mkdtempSync(join(tmpdir(), "hex-graph-envelope-"));
        try {
            mkdirSync(join(fixture, "src"), { recursive: true });
            writeFileSync(join(fixture, "src", "util.ts"), [
                "export function computeTotal(value: number) {",
                "  return value + 1;",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(fixture, "src", "caller.ts"), [
                "import { computeTotal } from \"./util\";",
                "export const a = computeTotal(1);",
                "",
            ].join("\n"), "utf8");
            await indexProject(fixture);
            closeAllStores();

            await withMcpClient(async (client) => {
                const result = await client.callTool({
                    name: "inspect_symbol",
                    arguments: { path: fixture, name: "computeTotal", file: "src/util.ts", include_evidence: true },
                });
                assert.notEqual(result.isError, true, `inspect_symbol(include_evidence:true) must succeed: ${JSON.stringify(result).slice(0, 300)}`);
                assert.equal(result.structuredContent, undefined);
                assert.match(result.content[0].text.split("\n", 1)[0], ACTION_LINE_RE);
            });
        } finally {
            try { closeAllStores(); } catch { /* best-effort */ }
            try { rmSync(fixture, { recursive: true, force: true }); } catch { /* Windows WAL */ }
        }
    });
});

// Grammar body assertions. Uses a tmpdir indexed project so the server can
// resolve real symbols and emit #section/.row/>pointer lines.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { indexProject } from "../lib/indexer.mjs";
import { closeAllStores } from "../lib/store.mjs";

describe("grammar body contract", () => {
    const ACTION_LINE_RE = /^(ok|partial|not_found|stale|error)\s+[a-z_]+/;
    const POINTER_RE = /^>mcp__hex-graph__\w+(\s+\S+)*$/;
    const SELECTOR_RE = /\s(symbol_id|workspace_qualified_name|qualified_name|name)=/;

    let corpus;
    before(async () => {
        corpus = mkdtempSync(join(tmpdir(), "hex-graph-grammar-"));
        mkdirSync(join(corpus, "src"), { recursive: true });
        writeFileSync(join(corpus, "src", "util.ts"), [
            "export function computeTotal(value: number) {",
            "  return value + 1;",
            "}",
            "",
        ].join("\n"), "utf8");
        writeFileSync(join(corpus, "src", "caller.ts"), [
            "import { computeTotal } from \"./util\";",
            "export const a = computeTotal(1);",
            "export const b = computeTotal(2);",
            "",
        ].join("\n"), "utf8");
        await indexProject(corpus);
        closeAllStores();
    });

    after(() => {
        try { closeAllStores(); } catch { /* best-effort */ }
        try { rmSync(corpus, { recursive: true, force: true }); } catch { /* Windows WAL */ }
    });

    it("find_symbols emits action-line + .row entries with file:line and kind", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "find_symbols",
                arguments: { query: "computeTotal", path: corpus },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            const [actionLine, ...body] = text.split("\n");
            assert.match(actionLine, ACTION_LINE_RE);
            assert.ok(!text.includes("\"status\":"), "no JSON body");
            assert.ok(!/Found\s+\d+\s+/.test(text), "no prose 'Found N' header");
            const rows = body.filter(line => line.startsWith("."));
            assert.ok(rows.length >= 1, "at least one .row");
            for (const row of rows) {
                assert.match(row, /kind=\w+/, `row must have kind=: ${row}`);
                assert.match(row, /:\d+\s/, `row must include file:line: ${row}`);
            }
        });
    });

    it("find_references emits #evidence + .ref rows with confidence", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "find_references",
                arguments: { name: "computeTotal", file: "src/util.ts", path: corpus, limit: 10 },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            const [actionLine, ...body] = text.split("\n");
            assert.match(actionLine, ACTION_LINE_RE);
            const refRows = body.filter(line => line.startsWith(".ref "));
            assert.ok(refRows.length >= 1, "at least one .ref row");
            for (const row of refRows) {
                assert.match(row, /conf=\w+/, `.ref must include conf=: ${row}`);
                assert.match(row, /kind=\w+/, `.ref must include kind=: ${row}`);
            }
            const pointers = body.filter(line => line.startsWith(">"));
            for (const ptr of pointers) {
                assert.match(ptr, POINTER_RE, `pointer must be executable: ${ptr}`);
                assert.match(ptr, /\spath=/, `pointer must carry path=: ${ptr}`);
                assert.match(ptr, SELECTOR_RE, `symbol pointer must carry a canonical selector: ${ptr}`);
            }
        });
    });

    it("inspect_symbol emits #location + #refs + expansion pointers", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "inspect_symbol",
                arguments: { name: "computeTotal", file: "src/util.ts", path: corpus, verbosity: "compact" },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            const [actionLine, ...body] = text.split("\n");
            assert.match(actionLine, ACTION_LINE_RE);
            assert.ok(body.some(line => line.startsWith("#location ")), "has #location header");
            assert.ok(body.some(line => line.startsWith("#refs ")), "has #refs header");
            const pointers = body.filter(line => line.startsWith(">"));
            assert.ok(pointers.length >= 1, "inspect_symbol emits expansion pointers");
            for (const ptr of pointers) {
                assert.match(ptr, POINTER_RE, `pointer must be executable: ${ptr}`);
                assert.match(ptr, /\spath=/, `pointer must carry path=: ${ptr}`);
                assert.match(ptr, SELECTOR_RE, `symbol pointer must carry a canonical selector: ${ptr}`);
            }
        });
    });

    it("verbosity=full emits compact #quality metadata for graph-supported tools", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "inspect_symbol",
                arguments: { name: "computeTotal", file: "src/util.ts", path: corpus, verbosity: "full" },
            });
            const text = result.content[0].text;
            assert.ok(text.split("\n").some(line => line.startsWith("#quality ")), "full response includes #quality");
            assert.match(text, /#quality .*tier=/, "#quality includes support tier");
        });
    });

    it("audit_workspace emits flat .clone_member rows (no indent tree)", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "audit_workspace",
                arguments: { path: corpus },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            const [actionLine] = text.split("\n");
            assert.match(actionLine, ACTION_LINE_RE);
            // No indent-tree prefixes: every non-empty line starts with [#.>!?] or space-free prefix.
            for (const line of text.split("\n")) {
                if (!line) continue;
                assert.ok(!line.startsWith("    "), `no indent-tree prefixes: ${line}`);
            }
            // Contract: clone members, when present, are flat .clone_member rows with group=... back-ref.
            const cloneMembers = text.split("\n").filter(line => line.startsWith(".clone_member "));
            for (const row of cloneMembers) {
                assert.match(row, /group=g\d+/, `clone_member must carry group=: ${row}`);
            }
        });
    });

    it("find_symbols on unknown token returns not_found with zero candidates", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "find_symbols",
                arguments: { query: "__definitely_missing_symbol__", path: corpus },
            });
            assert.equal(result.structuredContent, undefined);
            const text = result.content[0].text;
            const [actionLine, ...body] = text.split("\n");
            assert.match(actionLine, ACTION_LINE_RE);
            assert.match(actionLine, /^not_found\s+/, `unknown query must be not_found: ${actionLine}`);
            const rows = body.filter(line => line.startsWith("."));
            assert.equal(rows.length, 0, "no .rows for unknown query");
        });
    });

    it("no payload carries legacy derivable or prose fields", async () => {
        await withMcpClient(async (client) => {
            const calls = [
                { name: "find_symbols", arguments: { query: "computeTotal", path: corpus } },
                { name: "find_references", arguments: { name: "computeTotal", file: "src/util.ts", path: corpus } },
                { name: "inspect_symbol", arguments: { name: "computeTotal", file: "src/util.ts", path: corpus } },
                { name: "audit_workspace", arguments: { path: corpus } },
            ];
            for (const call of calls) {
                const result = await client.callTool(call);
                const text = result.content[0]?.text ?? "";
                assert.ok(!text.includes("available_expansions"), `${call.name}: available_expansions leaked`);
                assert.ok(!text.includes("suggested_params"), `${call.name}: suggested_params leaked`);
                assert.ok(!text.includes("analyzed_rows"), `${call.name}: analyzed_rows leaked`);
                assert.ok(!text.includes("strongest_tier"), `${call.name}: strongest_tier leaked`);
                assert.ok(!text.includes("coverage_ratio"), `${call.name}: coverage_ratio leaked`);
                assert.ok(!/\"payload_sections\"/.test(text), `${call.name}: payload_sections leaked`);
                assert.ok(!/\"boundary_echo_stripped\"/.test(text), `${call.name}: boundary_echo_stripped leaked`);
            }
        });
    });
});

describe("index_project hygiene", () => {
    it("missing project path fails before materializing graph artifacts", async () => {
        const parent = mkdtempSync(join(tmpdir(), "hex-graph-missing-parent-"));
        const missing = join(parent, "definitely-missing");
        try {
            await assert.rejects(
                () => indexProject(missing),
                /PATH_NOT_FOUND/
            );
            assert.equal(existsSync(missing), false, "indexProject must not create missing project directories");
            assert.equal(existsSync(join(missing, ".hex-skills")), false, "missing project error must not create graph artifacts");
        } finally {
            try { rmSync(parent, { recursive: true, force: true }); } catch { /* best-effort */ }
        }
    });
});
