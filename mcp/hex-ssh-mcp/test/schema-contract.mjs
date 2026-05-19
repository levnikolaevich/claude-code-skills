import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, "..");

async function withMcpClient(run, env = {}) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-ssh-schema-contract", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "node",
        args: ["server.mjs"],
        cwd: CWD,
        stderr: "pipe",
        env: { ...process.env, ...env },
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

function propNames(tool) {
    return Object.keys(tool.inputSchema.properties || {});
}

function requiredProps(tool) {
    return tool.inputSchema.required || [];
}

describe("schema descriptions", () => {
    it("listTools preserves SSH property descriptions under Zod 4", async () => {
        await withMcpClient(async (client) => {
            const result = await client.listTools();
            const readTool = toolByName(result.tools, "ssh-read-lines");
            const readProps = readTool.inputSchema.properties || {};
            assert.equal(readProps.host?.description, "SSH host - alias from ~/.ssh/config or hostname/IP");
            assert.equal(readProps.filePath?.description, "Path to file on remote server");
            assert.equal(readProps.maxLines?.description, "Max lines to read (default: 200)");
        });
    });

    it("exposes only timeout fields that each tool can use", async () => {
        await withMcpClient(async (client) => {
            const result = await client.listTools();
            const execTools = [
                "ssh-capabilities",
                "ssh-session-open",
                "ssh-session-exec",
                "ssh-session-read",
                "ssh-session-close",
                "ssh-session-gc",
                "remote-ssh",
                "ssh-read-lines",
                "ssh-edit-block",
                "ssh-search-code",
                "ssh-write-chunk",
                "ssh-verify",
            ];
            for (const name of execTools) {
                const props = propNames(toolByName(result.tools, name));
                assert.ok(props.includes("connectTimeoutMs"), `${name} should accept connectTimeoutMs`);
                assert.ok(props.includes("keepaliveIntervalMs"), `${name} should accept keepaliveIntervalMs`);
                assert.ok(props.includes("execTimeoutMs"), `${name} should accept execTimeoutMs`);
                assert.ok(!props.includes("transferTimeoutMs"), `${name} should not expose transferTimeoutMs`);
            }

            for (const name of ["ssh-upload", "ssh-download"]) {
                const props = propNames(toolByName(result.tools, name));
                assert.ok(props.includes("connectTimeoutMs"), `${name} should accept connectTimeoutMs`);
                assert.ok(props.includes("keepaliveIntervalMs"), `${name} should accept keepaliveIntervalMs`);
                assert.ok(props.includes("transferTimeoutMs"), `${name} should accept transferTimeoutMs`);
                assert.ok(!props.includes("execTimeoutMs"), `${name} should not expose execTimeoutMs`);
            }
        });
    });
});

describe("error output contract", () => {
    it("public SSH errors include recovery classification fields", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "ssh-read-lines",
                arguments: { host: "", filePath: "/tmp/nope" },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "INVALID_INPUT");
            assert.equal(payload.summary, "Required: host, filePath");
            assert.equal(payload.next_action, "fix_inputs");
            assert.equal(payload.failure_class, "unknown");
            assert.equal(payload.error.recovery, "Provide required input fields and retry");
        });
    });

    it("remote-ssh disabled mode returns typed permission denial", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "remote-ssh",
                arguments: { host: "example.com", user: "deploy", command: "ls" },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "REMOTE_SSH_DISABLED");
            assert.equal(payload.next_action, "fix_permissions");
            assert.equal(payload.failure_class, "permission_denial");
            assert.match(payload.error.recovery, /REMOTE_SSH_MODE=safe/);
        }, { REMOTE_SSH_MODE: "" });
    });

    it("ssh-session-exec uses the same disabled command policy as remote-ssh", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "ssh-session-exec",
                arguments: { host: "example.com", user: "deploy", sid: "abcdef12", command: "pwd" },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "REMOTE_SSH_DISABLED");
            assert.equal(payload.next_action, "fix_permissions");
            assert.equal(payload.failure_class, "permission_denial");
        }, { REMOTE_SSH_MODE: "" });
    });

    it("ssh-session-exec rejects impossible explicit exec timeout instead of widening it", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "ssh-session-exec",
                arguments: {
                    host: "example.com",
                    user: "deploy",
                    sid: "abcdef12",
                    command: "pwd",
                    waitSeconds: 10,
                    execTimeoutMs: 1000,
                },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "INVALID_INPUT");
            assert.match(payload.summary, /execTimeoutMs must be at least/);
        }, { REMOTE_SSH_MODE: "safe" });
    });

    it("ssh-session-read validates seq=0 as invalid input, not as missing", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "ssh-session-read",
                arguments: { host: "example.com", user: "deploy", sid: "abcdef12", seq: 0 },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "INVALID_INPUT");
            assert.match(payload.summary, /seq must be a positive integer/);
        });
    });

    it("session tools expose the expected public input fields", async () => {
        await withMcpClient(async (client) => {
            const result = await client.listTools();
            assert.deepEqual(
                ["name", "ttlSeconds"].filter((name) => propNames(toolByName(result.tools, "ssh-session-open")).includes(name)),
                ["name", "ttlSeconds"]
            );
            assert.deepEqual(
                ["sid", "command", "waitSeconds"].filter((name) => propNames(toolByName(result.tools, "ssh-session-exec")).includes(name)),
                ["sid", "command", "waitSeconds"]
            );
            assert.deepEqual(
                ["sid", "seq", "stream", "offset", "limit", "raw"].filter((name) => propNames(toolByName(result.tools, "ssh-session-read")).includes(name)),
                ["sid", "seq", "stream", "offset", "limit", "raw"]
            );
            assert.deepEqual(requiredProps(toolByName(result.tools, "ssh-session-read")).sort(), ["host", "seq", "sid"].sort());
            assert.deepEqual(requiredProps(toolByName(result.tools, "ssh-session-exec")).sort(), ["command", "host", "sid"].sort());
            assert.deepEqual(requiredProps(toolByName(result.tools, "ssh-session-close")).sort(), ["host", "sid"].sort());
        });
    });

    it("missing SSH user returns typed auth_missing", async () => {
        await withMcpClient(async (client) => {
            const result = await client.callTool({
                name: "ssh-read-lines",
                arguments: { host: "__hex_ssh_no_user_contract__", filePath: "/tmp/nope" },
            });
            const payload = result.structuredContent || JSON.parse(result.content[0].text);
            assert.equal(payload.status, "ERROR");
            assert.equal(payload.code, "SSH_AUTH_MISSING");
            assert.equal(payload.next_action, "authenticate");
            assert.equal(payload.failure_class, "auth_missing");
        });
    });
});
