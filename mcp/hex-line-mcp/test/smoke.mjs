import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = resolve(__dirname, "../hook.mjs");
const require = createRequire(import.meta.url);
const HAS_GRAPH_SQLITE = (() => {
    try {
        const db = require("better-sqlite3")(":memory:");
        db.close();
        return true;
    } catch {
        return false;
    }
})();

function runHook(hookEvent, toolName, toolInput, extra = {}) {
    return new Promise((res) => {
        const child = execFile("node", [HOOK_PATH], { stdio: ["pipe", "pipe", "pipe"] }, (error, stdout, stderr) => {
            res({ code: error ? error.code : 0, stdout, stderr });
        });
        child.stdin.write(JSON.stringify({
            hook_event_name: hookEvent,
            tool_name: toolName,
            tool_input: toolInput,
            ...extra
        }));
        child.stdin.end();
    });
}

const CWD = resolve(__dirname, "..");
const TMP = (name) => join(tmpdir(), name);

function makeTempRepo(prefix, files) {
    const dir = fs.mkdtempSync(join(tmpdir(), prefix));
    for (const [relPath, content] of Object.entries(files)) {
        const fullPath = join(dir, relPath);
        fs.mkdirSync(dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    }
    return dir;
}

async function indexGraphRepo(dir) {
    const { indexProject } = await import("../../hex-graph-mcp/lib/indexer.mjs");
    const { _resetGraphDBCache } = await import("../lib/graph-enrich.mjs");
    await indexProject(dir);
    _resetGraphDBCache();
}

async function closeGraphRepo(dir) {
    const { getStore } = await import("../../hex-graph-mcp/lib/store.mjs");
    getStore(dir).close();
}

async function withMcpClient(run) {
    const { Client } = await import("@modelcontextprotocol/sdk/client");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "hex-line-smoke", version: "1.0.0" }, { capabilities: {} });
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

// ==================== hash ====================

describe("FNV-1a hash", () => {
    it("deterministic: same content → same hash, whitespace normalized", async () => {
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const h1 = fnv1a("const x = 1;");
        const h2 = fnv1a("const x = 1;");
        assert.equal(h1, h2, "Same content same hash");

        // Whitespace normalization: trailing spaces, tabs vs spaces
        const h3 = fnv1a("const x = 1;  ");
        const h4 = fnv1a("const x = 1;\t");
        assert.equal(h3, h4, "Trailing whitespace normalized");

        // Tag is 2-char from known alphabet
        const tag = lineTag(h1);
        assert.match(tag, /^[a-z2-7]{2}$/, "Tag is 2 chars from base32 alphabet");
    });

    it("rangeChecksum detects single-line change", async () => {
        const { fnv1a, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const lines1 = ["line one", "line two", "line three"].map(fnv1a);
        const lines2 = ["line one", "LINE TWO", "line three"].map(fnv1a);
        const cs1 = rangeChecksum(lines1, 1, 3);
        const cs2 = rangeChecksum(lines2, 1, 3);
        assert.notEqual(cs1, cs2, "Changed line changes checksum");

        // Same lines → same checksum
        const cs3 = rangeChecksum(lines1, 1, 3);
        assert.equal(cs1, cs3, "Unchanged lines same checksum");
    });
});

// ==================== normalize ====================

describe("normalize output", () => {
    it("deduplicates identical lines with (xN) counts", async () => {
        const { deduplicateLines } = await import("@levnikolaevich/hex-common/output/normalize");
        const lines = ["ok", "error: timeout", "error: timeout", "error: timeout", "done"];
        const result = deduplicateLines(lines);
        const joined = result.join("\n");
        assert.ok(joined.includes("(x3)"), "Repeated line gets (x3) count");
        assert.ok(joined.includes("ok"), "Unique lines preserved");
        assert.ok(joined.includes("done"), "Unique lines preserved");
    });

    it("smartTruncate keeps head and tail", async () => {
        const { smartTruncate } = await import("@levnikolaevich/hex-common/output/normalize");
        const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
        const result = smartTruncate(lines.join("\n"), 5, 3);
        assert.ok(result.includes("line 1"), "First line kept");
        assert.ok(result.includes("line 5"), "5th line kept (head)");
        assert.ok(result.includes("line 100"), "Last line kept (tail)");
        assert.ok(result.includes("omitted"), "Gap indicator present");
        assert.ok(!result.includes("line 50"), "Middle line omitted");
    });
});

// ==================== edit ====================

describe("edit business logic", () => {
    it("NOOP_EDIT when set_line produces identical content", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-noop.js");
        fs.writeFileSync(tmp, "const x = 1;\n");
        try {
            const tag = lineTag(fnv1a("const x = 1;"));
            editFile(tmp, [{ set_line: { anchor: `${tag}.1`, new_text: "const x = 1;" } }]);
            assert.fail("Should have thrown NOOP_EDIT");
        } catch (e) {
            assert.ok(e.message.includes("NOOP_EDIT"));
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace_lines preserves boundary content (no strip)", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-boundary.js");
        const content = "function foo() {\n    const x = 1;\n    return x;\n}\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const startTag = lineTag(fnv1a(lines[1]));
            const endTag = lineTag(fnv1a(lines[2]));
            const rc = rangeChecksum([fnv1a(lines[1]), fnv1a(lines[2])], 2, 3);
            editFile(tmp, [{
                replace_lines: {
                    start_anchor: `${startTag}.2`,
                    end_anchor: `${endTag}.3`,
                    new_text: "    const x = 1;\n    const y = 2;\n    return x;",
                    range_checksum: rc
                }
            }]);
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("const x = 1;"), "Start boundary preserved");
            assert.ok(written.includes("return x;"), "End boundary preserved");
            assert.ok(written.includes("const y = 2;"), "New content present");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace_lines accepts wider checksum range than anchor range", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-wider-cs.js");
        const content = "line1\nline2\nline3\nline4\nline5\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const hashes = lines.slice(0, 5).map(l => fnv1a(l));
            const rc = rangeChecksum(hashes, 1, 5);
            const startTag = lineTag(fnv1a(lines[1]));
            const endTag = lineTag(fnv1a(lines[2]));
            editFile(tmp, [{
                replace_lines: {
                    start_anchor: `${startTag}.2`,
                    end_anchor: `${endTag}.3`,
                    new_text: "replaced2\nreplaced3",
                    range_checksum: rc
                }
            }]);
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("replaced2"), "Edit applied with wider checksum");
            assert.ok(written.includes("line1"), "Untouched line preserved");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace_lines detects stale content outside anchor range but inside checksum", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-stale-outside.js");
        const content = "line1\nline2\nline3\nline4\nline5\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const hashes = lines.slice(0, 5).map(l => fnv1a(l));
            const rc = rangeChecksum(hashes, 1, 5);
            const startTag = lineTag(fnv1a(lines[1]));
            const endTag = lineTag(fnv1a(lines[2]));
            fs.writeFileSync(tmp, "line1\nline2\nline3\nMODIFIED\nline5\n");
            assert.throws(() => {
                editFile(tmp, [{
                    replace_lines: {
                        start_anchor: `${startTag}.2`,
                        end_anchor: `${endTag}.3`,
                        new_text: "replaced",
                        range_checksum: rc
                    }
                }], { conflictPolicy: "strict" });
            }, /mismatch/i, "Stale content outside anchors detected");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("set_line preserves verbatim indent (no auto-fix)", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-indent.js");
        fs.writeFileSync(tmp, "function foo() {\n    const x = 1;\n}\n");
        try {
            const lines = "function foo() {\n    const x = 1;\n}\n".split("\n");
            const tag = lineTag(fnv1a(lines[1]));
            editFile(tmp, [{ set_line: { anchor: `${tag}.2`, new_text: "  const x = 2;" } }]);
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("  const x = 2;"), "2-space preserved");
            assert.ok(!written.includes("    const x = 2;"), "NOT auto-fixed to 4");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace throws REPLACE_REMOVED with helpful message", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-notfound.js");
        fs.writeFileSync(tmp, "const a = 1;\nconst b = 2;\n");
        try {
            editFile(tmp, [{ replace: { old_text: "nonexistent text", new_text: "x", all: true } }]);
            assert.fail("Should have thrown");
        } catch (e) {
            assert.ok(e.message.includes("REPLACE_REMOVED"), "Error is REPLACE_REMOVED");
            assert.ok(e.message.includes("set_line"), "Mentions set_line alternative");
            assert.ok(e.message.includes("bulk_replace"), "Mentions bulk_replace alternative");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("conservative mode auto-rebases non-overlapping stale replace_lines edits", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-autorebase.js");
        const content = "head1\nhead2\ntargetA\ntargetB\ntail\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const baseRead = readFile(tmp, { offset: 1, limit: 5 });
            const baseRevision = baseRead.match(/revision: (\S+)/)?.[1];
            assert.ok(baseRevision, "read_file returns revision");

            const headTag = lineTag(fnv1a(lines[0]));
            editFile(tmp, [{ insert_after: { anchor: `${headTag}.1`, text: "inserted" } }]);

            const startTag = lineTag(fnv1a(lines[2]));
            const endTag = lineTag(fnv1a(lines[3]));
            const rc = rangeChecksum([fnv1a(lines[2]), fnv1a(lines[3])], 3, 4);
            const result = editFile(tmp, [{
                replace_lines: {
                    start_anchor: `${startTag}.3`,
                    end_anchor: `${endTag}.4`,
                    new_text: "targetA\nupdatedB",
                    range_checksum: rc,
                }
            }], { baseRevision, conflictPolicy: "conservative" });

            assert.ok(result.includes("status: AUTO_REBASED"), "Auto-rebase status returned");
            assert.ok(result.includes("changed_ranges:"), "Changed ranges included");
            assert.ok(result.includes("remapped_refs:"), "Remapped refs returned");
            assert.ok(result.includes(`${startTag}.3 -> ${startTag}.4`), "Old anchor mapped to relocated line");
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("inserted"), "Prior insert preserved");
            assert.ok(written.includes("updatedB"), "Target block updated without reread");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("conflict output includes remapped refs when some anchors relocate before conflict", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-conflict-remap.js");
        const content = "head1\nhead2\ntargetA\ntargetB\ntail\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const baseRead = readFile(tmp, { offset: 1, limit: 5 });
            const baseRevision = baseRead.match(/revision: (\S+)/)?.[1];
            assert.ok(baseRevision, "read_file returns revision");

            const headTag = lineTag(fnv1a(lines[0]));
            const targetBTag = lineTag(fnv1a(lines[3]));
            editFile(tmp, [
                { insert_after: { anchor: `${headTag}.1`, text: "inserted" } },
                { set_line: { anchor: `${targetBTag}.4`, new_text: "changedTargetB" } },
            ]);

            const startTag = lineTag(fnv1a(lines[2]));
            const endTag = lineTag(fnv1a(lines[3]));
            const rc = rangeChecksum([fnv1a(lines[2]), fnv1a(lines[3])], 3, 4);
            const result = editFile(tmp, [{
                replace_lines: {
                    start_anchor: `${startTag}.3`,
                    end_anchor: `${endTag}.4`,
                    new_text: "targetA\nupdatedB",
                    range_checksum: rc,
                }
            }], { baseRevision, conflictPolicy: "conservative" });

            assert.ok(result.includes("status: CONFLICT"), "Conflict status returned");
            assert.ok(result.includes("remapped_refs:"), "Conflict shows relocated refs");
            assert.ok(result.includes(`${startTag}.3->${startTag}.4`), "Relocated start anchor reported");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("conservative mode returns CONFLICT for overlapping stale edits", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag, rangeChecksum } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-conflict.js");
        const content = "head1\nhead2\ntargetA\ntargetB\ntail\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const baseRead = readFile(tmp, { offset: 1, limit: 5 });
            const baseRevision = baseRead.match(/revision: (\S+)/)?.[1];
            assert.ok(baseRevision, "read_file returns revision");

            const targetTag = lineTag(fnv1a(lines[2]));
            editFile(tmp, [{ set_line: { anchor: `${targetTag}.3`, new_text: "otherChange" } }]);

            const startTag = lineTag(fnv1a(lines[2]));
            const endTag = lineTag(fnv1a(lines[3]));
            const rc = rangeChecksum([fnv1a(lines[2]), fnv1a(lines[3])], 3, 4);
            const result = editFile(tmp, [{
                replace_lines: {
                    start_anchor: `${startTag}.3`,
                    end_anchor: `${endTag}.4`,
                    new_text: "targetA\nupdatedB",
                    range_checksum: rc,
                }
            }], { baseRevision, conflictPolicy: "conservative" });

            assert.ok(result.includes("status: CONFLICT"), "Conflict status returned");
            assert.ok(/reason: (overlap|stale_anchor)/.test(result), "Structured conflict reason returned");
            assert.ok(result.includes("recovery_ranges: 3-3"), "Conflict reports recovery range");
            assert.ok(result.includes("next_action: apply_retry_edit"), "Conflict reports canonical next action");
            assert.ok(result.includes("retry_edit:"), "Conflict reports retry edit skeleton");
            assert.ok(result.includes("summary:"), "Conflict reports compact summary");
            assert.ok(result.includes("snippet: "), "Conflict reports compact snippet header");
            assert.ok(result.includes('retry_plan: {"steps":[{"tool":"mcp__hex-line__edit_file"'), "Conflict reports direct retry plan");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("conservative mode reports all stale replace_lines conflicts in one batch", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-batch-conflicts.js");
        fs.writeFileSync(tmp, "one\ntwo\nthree\nfour\nfive\n");
        try {
            const read = readFile(tmp, { ranges: ["1-5"] });
            const anchors = [...read.matchAll(/([a-z2-7]{2}\.(?:2|4))\t(two|four)/g)].map((m) => m[1]);
            const checksums = [...read.matchAll(/checksum: (\d+-\d+:[0-9a-f]{8})/g)].map((m) => m[1]);
            assert.equal(anchors.length, 2, "Read returns both target anchors");
            assert.equal(checksums.length, 1, "Read returns one broad checksum");

            fs.writeFileSync(tmp, "ONE\ntwo\nthree\nfour\nFIVE\n");

            const result = editFile(tmp, [
                {
                    replace_lines: {
                        start_anchor: anchors[0],
                        end_anchor: anchors[0],
                        new_text: "two updated",
                        range_checksum: checksums[0],
                    }
                },
                {
                    replace_lines: {
                        start_anchor: anchors[1],
                        end_anchor: anchors[1],
                        new_text: "four updated",
                        range_checksum: checksums[0],
                    }
                },
            ], { conflictPolicy: "conservative" });

            assert.ok(result.includes("status: CONFLICT"), "Conflict status returned");
            assert.ok(result.includes("reason: batch_conflict"), "Batch conflict reason returned");
            assert.ok(result.includes("edit_conflicts: 2"), "Conflict count returned");
            assert.ok(result.includes("next_action: apply_retry_batch"), "Batch conflict reports canonical next action");
            assert.ok(result.includes("edit: 1/2"), "First conflict section returned");
            assert.ok(result.includes("edit: 2/2"), "Second conflict section returned");
            assert.ok((result.match(/recovery_ranges: 2-2/g) || []).length >= 1, "First edit reports narrow recovery range");
            assert.ok((result.match(/recovery_ranges: 4-4/g) || []).length >= 1, "Second edit reports narrow recovery range");
            assert.ok((result.match(/retry_checksum:/g) || []).length >= 2, "Each stale replace_lines conflict reports retry checksum");
            assert.ok((result.match(/retry_edit:/g) || []).length >= 2, "Each stale replace_lines conflict reports retry edit skeleton");
            assert.ok((result.match(/summary:/g) || []).length >= 2, "Each stale replace_lines conflict reports compact summary");
            assert.ok(result.includes('retry_edits: [{"replace_lines"'), "Batch conflict reports ready retry edits");
            assert.ok(result.includes('retry_plan: {"steps":[{"tool":"mcp__hex-line__edit_file"'), "Batch conflict reports direct batch retry plan");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("batch conflicts fall back to suggested reread when not every edit can be retried directly", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-reread-plan.js");
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\ndelta\n");
        try {
            const read = readFile(tmp, { ranges: ["1-4"] });
            const baseRevision = read.match(/revision: (\S+)/)?.[1];
            assert.ok(baseRevision, "Read returns revision");

            const lines = "alpha\nbeta\ngamma\ndelta\n".split("\n");
            const alphaTag = lineTag(fnv1a(lines[0]));
            const gammaTag = lineTag(fnv1a(lines[2]));

            editFile(tmp, [
                { set_line: { anchor: `${alphaTag}.1`, new_text: "alpha changed" } },
                { set_line: { anchor: `${gammaTag}.3`, new_text: "gamma changed" } },
            ]);

            const alphaChangedTag = lineTag(fnv1a("alpha changed"));
            const gammaChangedTag = lineTag(fnv1a("gamma changed"));
            const result = editFile(tmp, [
                { set_line: { anchor: `${alphaChangedTag}.1`, new_text: "alpha next" } },
                { set_line: { anchor: `${gammaChangedTag}.3`, new_text: "gamma next" } },
            ], { baseRevision, conflictPolicy: "conservative" });

            assert.ok(result.includes("status: CONFLICT"), "Conflict status returned");
            assert.ok(result.includes("reason: batch_conflict"), "Batch conflict reason returned");
            assert.ok(result.includes("next_action: reread_then_retry"), "Batch conflict reports reread-first next action");
            assert.ok(result.includes('suggested_read_call: {"tool":"mcp__hex-line__read_file"'), "Batch conflict suggests reread call");
            assert.ok(result.includes('retry_plan: {"steps":[{"tool":"mcp__hex-line__read_file"'), "Batch conflict falls back to reread-first plan");
            assert.ok(!result.includes("retry_edits:"), "No retry_edits reported for incomplete retryable batch");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace_between rewrites a block without reciting old content", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-replace-between.js");
        const content = [
            "function demo() {",
            "    const a = 1;",
            "    const b = 2;",
            "    return a + b;",
            "}",
            "",
        ].join("\n");
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const startTag = lineTag(fnv1a(lines[0]));
            const endTag = lineTag(fnv1a(lines[4]));
            const result = editFile(tmp, [{
                replace_between: {
                    start_anchor: `${startTag}.1`,
                    end_anchor: `${endTag}.5`,
                    new_text: "function demo() {\n    return 42;\n}",
                    boundary_mode: "inclusive",
                }
            }]);

            assert.ok(result.includes("status: OK"), "Successful block rewrite");
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("return 42;"), "New block content written");
            assert.ok(!written.includes("const b = 2;"), "Old interior removed");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("sanitizes noisy LLM edit payload before apply", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const tmp = TMP("hex-test-cleanup.js");
        const content = "const one = 1;\nconst two = 2;\n";
        fs.writeFileSync(tmp, content);
        try {
            const lines = content.split("\n");
            const anchor = `${lineTag(fnv1a(lines[0]))}.1`;
            editFile(tmp, [{
                insert_after: {
                    anchor,
                    text: "+ab.2\tconst inserted = 3;\n+cd.3\tconst total = one + two + inserted;",
                }
            }]);
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("const inserted = 3;"), "Anchor prefix removed");
            assert.ok(written.includes("const total = one + two + inserted;"), "Diff markers removed");
            assert.ok(!written.includes("ab.2\t"), "No anchor echo remains");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("applies replace_lines directly from a canonical read block", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-read-block-edit.js");
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\ndelta\n");
        try {
            const readResult = readFile(tmp, { ranges: ["2-3"] });
            const startAnchor = readResult.match(/([a-z2-7]{2}\.2)\tbeta/)?.[1];
            const endAnchor = readResult.match(/([a-z2-7]{2}\.3)\tgamma/)?.[1];
            const checksum = readResult.match(/checksum: (\d+-\d+:[0-9a-f]{8})/)?.[1];
            assert.ok(startAnchor && endAnchor && checksum, "Canonical read block provides anchors and checksum");

            const result = editFile(tmp, [{
                replace_lines: {
                    start_anchor: startAnchor,
                    end_anchor: endAnchor,
                    new_text: "beta updated\ngamma updated",
                    range_checksum: checksum,
                }
            }]);
            assert.ok(result.includes("status: OK"), "Edit succeeds from read block payload");
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("beta updated"), "Read-derived edit updates target range");
            assert.ok(written.includes("gamma updated"), "Read-derived edit updates full block");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("applies set_line directly from a canonical search block", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-search-block-edit.js");
        fs.writeFileSync(tmp, "const alpha = 1;\nconst target = 2;\nconst omega = 3;\n");
        try {
            const grepResult = await grepSearch("target", { path: tmp, context: 1, output: "content", editReady: true });
            const anchor = grepResult.match(/>>([a-z2-7]{2}\.2)\tconst target = 2;/)?.[1];
            assert.ok(anchor, "Canonical search block provides direct anchor");

            const result = editFile(tmp, [{
                set_line: {
                    anchor,
                    new_text: "const target = 22;",
                }
            }]);
            assert.ok(result.includes("status: OK"), "Edit succeeds from search block anchor");
            const written = fs.readFileSync(tmp, "utf-8");
            assert.ok(written.includes("const target = 22;"), "Search-derived edit updates match line");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("multi-edit result footer stays deterministic", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-deterministic-footer.js");
        fs.writeFileSync(tmp, "first\nsecond\nthird\n");
        try {
            const readResult = readFile(tmp, { ranges: ["1-3"] });
            const firstAnchor = readResult.match(/([a-z2-7]{2}\.1)\tfirst/)?.[1];
            const secondAnchor = readResult.match(/([a-z2-7]{2}\.2)\tsecond/)?.[1];
            assert.ok(firstAnchor && secondAnchor, "Read block provides anchors for batch edit");

            const result = editFile(tmp, [
                { insert_after: { anchor: firstAnchor, text: "between" } },
                { set_line: { anchor: secondAnchor, new_text: "second updated" } },
            ]);

            const statusIdx = result.indexOf("status:");
            const revisionIdx = result.indexOf("revision:");
            const fileIdx = result.indexOf("file:");
            const updatedIdx = result.indexOf("Updated ");
            const postEditIdx = result.indexOf("block: post_edit");
            const checksumIdx = result.indexOf("checksum:", postEditIdx);
            const diffIdx = result.indexOf("Diff:");

            assert.ok(statusIdx === 0, "Result starts with status");
            assert.ok(revisionIdx > statusIdx, "Revision follows status");
            assert.ok(fileIdx > revisionIdx, "File checksum follows revision");
            assert.ok(updatedIdx > fileIdx, "Update summary follows checksum");
            assert.ok(postEditIdx > updatedIdx, "Post-edit block follows update summary");
            assert.ok(checksumIdx > postEditIdx, "Post-edit block has checksum");
            assert.ok(diffIdx > postEditIdx, "Diff is emitted last");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("edit error messages", () => {
    it("out-of-range error includes boundary snippet with hashes", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = TMP("hex-test-oor.js");
        fs.writeFileSync(tmp, "line1\nline2\nline3\n");
        try {
            editFile(tmp, [{ set_line: { anchor: "xx.10", new_text: "new" } }]);
            assert.fail("Should have thrown");
        } catch (e) {
            assert.ok(e.message.includes("out of range"), "Has out of range");
            assert.ok(/[a-z2-7]{2}\.\d+\t/.test(e.message), "Has hash-annotated snippet");
            assert.ok(e.message.includes("Tip:"), "Has retry tip");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

// ==================== inspect_path ====================

describe("inspect_path", () => {
    it("supports directory pattern mode", async () => {
        const { inspectPath } = await import("../lib/inspect-path.mjs");
        const result = inspectPath(CWD + "/lib", { pattern: "*.mjs", type: "file" });
        assert.ok(result.includes("tree.mjs"));
        assert.ok(!result.includes("xmjs"), "Dot is literal, not regex wildcard");
    });

    it("returns flat list for pattern mode and hierarchy for directory mode", async () => {
        const { inspectPath } = await import("../lib/inspect-path.mjs");
        const flat = inspectPath(CWD, { pattern: "lib", type: "dir" });
        assert.ok(flat.includes("Found"), "Pattern: flat header");
        assert.ok(flat.includes("lib/"), "Pattern: trailing slash for dirs");

        const tree = inspectPath(CWD + "/lib", { max_depth: 1 });
        assert.ok(tree.startsWith("Directory:"), "Tree: hierarchy header");
    });

    it("returns descriptive no-match message", async () => {
        const { inspectPath } = await import("../lib/inspect-path.mjs");
        const none = inspectPath(CWD, { pattern: "nonexistent-xyz-42" });
        assert.ok(none.includes("No matches"));
    });
    it("returns file metadata for regular files", async () => {
        const { inspectPath } = await import("../lib/inspect-path.mjs");
        const result = inspectPath(CWD + "/package.json");
        assert.ok(result.includes("Size:"), "file metadata includes size");
        assert.ok(result.includes("Type:"), "file metadata includes type");
    });

    it("respects path-based .gitignore rules", async () => {
        const { inspectPath } = await import("../lib/inspect-path.mjs");
        const tmp = join(tmpdir(), "hex-test-gitignore");
        fs.mkdirSync(join(tmp, "nested"), { recursive: true });
        fs.writeFileSync(join(tmp, ".gitignore"), "nested/secret.txt\n");
        fs.writeFileSync(join(tmp, "keep.txt"), "visible\n");
        fs.writeFileSync(join(tmp, "nested", "secret.txt"), "hidden\n");
        fs.writeFileSync(join(tmp, "nested", "other.txt"), "visible\n");
        try {
            const result = inspectPath(tmp);
            assert.ok(result.includes("keep.txt"), "non-ignored file visible");
            assert.ok(result.includes("other.txt"), "non-ignored nested file visible");
            assert.ok(!result.includes("secret.txt"), "path-ignored file hidden");
        } finally {
            fs.rmSync(tmp, { recursive: true });
        }
    });
});

// ==================== read_file ====================

describe("read_file output", () => {
    it("includes revision and file checksum metadata", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-read-revision.js");
        fs.writeFileSync(tmp, "const x = 1;\n");
        try {
            const result = readFile(tmp);
            assert.match(result, /^File: .+/m, "Read includes file header");
            assert.match(result, /^meta: .+/m, "Read includes compact metadata");
            assert.match(result, /revision: \S+/, "Read includes revision");
            assert.match(result, /file: 1-\d+:[0-9a-f]{8}/, "Read includes file checksum");
            assert.match(result, /block: read_range/, "Read emits canonical block header");
            assert.match(result, /span: 1-2/, "Read emits block span");
            assert.ok(!result.includes("```"), "Read output is compact text, not fenced block");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("character cap triggers for files with very long lines", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-longlines.js");
        // 100 lines × 1000 chars each = 100K chars, well over 40K limit
        const longLine = "x".repeat(1000);
        fs.writeFileSync(tmp, Array.from({ length: 100 }, () => longLine).join("\n"));
        try {
            const result = readFile(tmp);
            assert.ok(result.includes("OUTPUT_CAPPED"), "Cap notice present");
            assert.ok(result.includes("offset="), "Has offset hint for continuation");
            assert.ok(result.length < 90000, `Output capped: ${result.length} chars`);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("normal file is not capped", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const result = readFile(CWD + "/lib/info.mjs");
        assert.ok(!result.includes("OUTPUT_CAPPED"), "No cap for normal file");
    });

    it("supports string and object ranges", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-ranges.js");
        fs.writeFileSync(tmp, Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n"));
        try {
            const result = readFile(tmp, { ranges: ["2-3", { start: 10, end: 11 }] });
            assert.equal((result.match(/block: read_range/g) || []).length, 2, "Each valid range becomes a canonical block");
            assert.ok(result.includes(".2\tline 2"), "String range is included");
            assert.ok(result.includes(".10\tline 10"), "Object range is included");
            const checksumMatches = result.match(/checksum: \d+-\d+:[0-9a-f]{8}/g) || [];
            assert.equal(checksumMatches.length, 2, "Each range gets its own checksum");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("returns an explicit diagnostic block for ranges outside EOF", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-invalid-range.js");
        fs.writeFileSync(tmp, "line 1\nline 2\n");
        try {
            const result = readFile(tmp, { ranges: ["99-120"] });
            assert.ok(result.includes("block: diagnostic"), "Invalid range emits diagnostic block");
            assert.ok(result.includes("kind: invalid_range"), "Diagnostic kind is explicit");
            assert.ok(result.includes("requested_span: 99-120"), "Diagnostic includes requested range");
            assert.ok(!result.includes("checksum:"), "Diagnostic block does not pretend to be edit-ready");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("keeps valid blocks and diagnostics together for mixed ranges", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-mixed-ranges.js");
        fs.writeFileSync(tmp, Array.from({ length: 5 }, (_, i) => `line ${i + 1}`).join("\n"));
        try {
            const result = readFile(tmp, { ranges: ["2-3", "50-60"] });
            assert.equal((result.match(/block: read_range/g) || []).length, 1, "Valid range still emits edit-ready block");
            assert.equal((result.match(/block: diagnostic/g) || []).length, 1, "Invalid range emits one diagnostic block");
            assert.ok(result.includes("kind: invalid_range"), "Diagnostic block is preserved alongside valid block");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("graph enrichment", () => {
    it("falls back cleanly when no .hex-skills/codegraph exists", { skip: !HAS_GRAPH_SQLITE }, async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = join(tmpdir(), `hex-no-graph-${Date.now()}.js`);
        fs.writeFileSync(tmp, "export function solo() {}\n");
        try {
            const result = readFile(tmp);
            assert.ok(!result.includes("\nGraph:"), "No graph header without .hex-skills/codegraph");
            assert.ok(result.includes("solo"), "Standard read still works");
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });

    it("adds graph header, grep annotations, and semantic impact from hex-graph contract", { skip: !HAS_GRAPH_SQLITE }, async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { grepSearch } = await import("../lib/search.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { fnv1a, lineTag } = await import("@levnikolaevich/hex-common/text-protocol/hash");
        const { _resetGraphDBCache } = await import("../lib/graph-enrich.mjs");
        const repo = makeTempRepo("hex-line-graph-", {
            "a.mjs": "export function foo() {\n  return 1;\n}\n",
            "b.mjs": "import { foo } from \"./a.mjs\";\nexport function run() {\n  return foo();\n}\n",
        });
        try {
            await indexGraphRepo(repo);

            const readResult = readFile(join(repo, "a.mjs"));
            assert.ok(readResult.includes("\nGraph:"), "Graph header present");
            assert.ok(readResult.includes("foo [function"), "Graph header includes symbol summary");
            assert.ok(readResult.includes("1↑"), "Graph header includes caller count");
            assert.ok(readResult.includes("flow 1out"), "Graph header includes flow count");
            assert.ok(readResult.includes("api"), "Graph header includes exported/public signal");

            const grepResult = await grepSearch("export function foo", { path: join(repo, "a.mjs"), output: "content", editReady: true });
            assert.ok(grepResult.includes("[fn"), "grep match annotated via line facts");
            assert.ok(grepResult.includes("1↑"), "grep match annotation includes caller count");
            assert.ok(grepResult.includes("[api"), "grep match annotation includes public API marker");

            const anchor = `${lineTag(fnv1a("export function foo() {"))}.1`;
            const editResult = editFile(join(repo, "a.mjs"), [
                { set_line: { anchor, new_text: "export function foo() {" } },
                { set_line: { anchor: `${lineTag(fnv1a("  return 1;"))}.2`, new_text: "  return 2;" } },
            ]);
            assert.ok(editResult.includes("Semantic impact:"), "Edit reports semantic impact");
            assert.ok(editResult.includes("external callers"), "Semantic impact includes caller totals");
            assert.ok(editResult.includes("return_flow_to_symbol: run (b.mjs:2)"), "Semantic impact names concrete downstream fact");
        } finally {
            _resetGraphDBCache();
            await closeGraphRepo(repo);
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });

    it("keeps graph DBs isolated across projects in one process", { skip: !HAS_GRAPH_SQLITE }, async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { _resetGraphDBCache } = await import("../lib/graph-enrich.mjs");
        const repoA = makeTempRepo("hex-line-graph-a-", {
            "a.mjs": "export function alpha() {\n  return 1;\n}\n",
            "use-a.mjs": "import { alpha } from \"./a.mjs\";\nexport function callAlpha() {\n  return alpha();\n}\n",
        });
        const repoB = makeTempRepo("hex-line-graph-b-", {
            "b.mjs": "export function beta() {\n  return 1;\n}\n",
            "use-b.mjs": "import { beta } from \"./b.mjs\";\nexport function callBeta() {\n  return beta();\n}\n",
        });
        try {
            await indexGraphRepo(repoA);
            await indexGraphRepo(repoB);
            _resetGraphDBCache();

            const readA = readFile(join(repoA, "a.mjs"));
            const readB = readFile(join(repoB, "b.mjs"));

            assert.ok(readA.includes("alpha [function"), "Repo A uses its own graph");
            assert.ok(!readA.includes("beta [function"), "Repo A does not leak repo B graph");
            assert.ok(readB.includes("beta [function"), "Repo B uses its own graph");
            assert.ok(!readB.includes("alpha [function"), "Repo B does not leak repo A graph");
        } finally {
            _resetGraphDBCache();
            await closeGraphRepo(repoA);
            await closeGraphRepo(repoB);
            fs.rmSync(repoA, { recursive: true, force: true });
            fs.rmSync(repoB, { recursive: true, force: true });
        }
    });

    it("does not bind a nested package to a parent repo graph index", { skip: !HAS_GRAPH_SQLITE }, async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { getGraphDB, _resetGraphDBCache } = await import("../lib/graph-enrich.mjs");
        const repo = makeTempRepo("hex-line-graph-nested-", {
            "src/outer.mjs": "export function outer() {\n  return 1;\n}\n",
            "packages/app/package.json": "{\n  \"name\": \"app\"\n}\n",
            "packages/app/src/inner.mjs": "export function inner() {\n  return 2;\n}\n",
        });
        const innerFile = join(repo, "packages/app/src/inner.mjs");
        try {
            await indexGraphRepo(repo);
            _resetGraphDBCache();

            assert.equal(getGraphDB(innerFile), null, "Nested package without its own graph DB must not reuse parent graph");
            const readResult = readFile(innerFile);
            assert.ok(!readResult.includes("\nGraph:"), "Nested package read should not emit parent graph header");
            assert.ok(readResult.includes("inner"), "File content is still returned");
        } finally {
            _resetGraphDBCache();
            await closeGraphRepo(repo);
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });
});

// ==================== grep_search ====================

describe("grep_search case modes", () => {
    it("default is case-sensitive", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        // server.mjs has 'Search' (uppercase) — lowercase 'search' should miss it in CS mode
        const cs = await grepSearch("search", { path: CWD + "/server.mjs", plain: true });
        const ci = await grepSearch("search", { path: CWD + "/server.mjs", plain: true, caseInsensitive: true });
        const csCount = cs.split("\n").filter(l => l.trim()).length;
        const ciCount = ci.split("\n").filter(l => l.trim()).length;
        assert.ok(ciCount > csCount, `CI (${ciCount}) should find more than CS (${csCount})`);
    });

    it("smart_case: lowercase pattern is CI, uppercase pattern is CS", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const lower = await grepSearch("search", { path: CWD + "/server.mjs", plain: true, smartCase: true });
        const upper = await grepSearch("Search", { path: CWD + "/server.mjs", plain: true, smartCase: true });
        const lowerCount = lower.split("\n").filter(l => l.trim()).length;
        const upperCount = upper.split("\n").filter(l => l.trim()).length;
        assert.ok(lowerCount > upperCount, `lowercase (${lowerCount}) should find more than uppercase (${upperCount})`);
    });
});

describe("grep_search output modes", () => {
    it("files mode returns only paths, count mode returns counts", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const files = await grepSearch("export", { path: CWD + "/lib", output: "files" });
        assert.ok(!files.includes("```"), "files mode is plain text");
        assert.ok(!files.includes(">>"), "files mode has no hash annotations");
        assert.ok(files.includes("search.mjs") || files.includes("hash.mjs"), "should list files");

        const count = await grepSearch("export", { path: CWD + "/lib", output: "count" });
        assert.ok(count.includes(":"), "count mode has file:N format");
        assert.ok(!count.includes(">>"), "count mode has no hash annotations");
        assert.ok(!count.includes("```"), "count mode is plain text");
    });

    it("content mode returns checksums per group", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const result = await grepSearch("grepSearch", { path: CWD + "/lib/search.mjs", context: 1, output: "content", editReady: true });
        assert.ok(result.includes("block: search_hunk"), "content mode emits canonical search blocks");
        assert.ok(result.includes("span:"), "content mode includes block span");
        assert.ok(result.includes(">>"), "content mode has >> match markers");
        assert.ok(result.includes("checksum:"), "content mode has per-group checksums");
        // Verify checksum format: N-N:hexhexhex
        const csMatch = result.match(/checksum: (\d+)-(\d+):([0-9a-f]{8})/);
        assert.ok(csMatch, `checksum format should be N-N:hex8, got: ${result.slice(0, 200)}`);
    });

    it("disjoint matches get separate checksums (fixture)", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const tmp = join(tmpdir(), "hex-test-disjoint.txt");
        const content = ["MARKER_A", ...Array(10).fill("filler"), "MARKER_B"].join("\n") + "\n";
        fs.writeFileSync(tmp, content);
        try {
            const result = await grepSearch("MARKER", { path: tmp });
            assert.ok((result.match(/block: search_hunk/g) || []).length >= 2, "Disjoint hunks stay separate blocks");
            const checksums = result.match(/checksum: \d+-\d+:[0-9a-f]{8}/g) || [];
            assert.ok(checksums.length >= 2, `disjoint markers should produce >=2 checksums, got ${checksums.length}`);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("grep checksum round-trips through verify", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = join(tmpdir(), "hex-test-roundtrip.txt");
        fs.writeFileSync(tmp, "line one\nline two\nline three\n");
        try {
            const result = await grepSearch("two", { path: tmp });
            const csMatch = result.match(/checksum: (\d+-\d+:[0-9a-f]{8})/);
            assert.ok(csMatch, "grep should produce a checksum");
            const verifyResult = verifyChecksums(tmp, [csMatch[1]]);
            assert.ok(verifyResult.includes("status: OK"), `verify should report OK: ${verifyResult}`);
            assert.ok(verifyResult.includes("VALID"), `checksum should verify: ${verifyResult}`);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("grep_search applies a default total_limit unless explicitly disabled", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const dir = makeTempRepo("hex-test-grep-cap-", Object.fromEntries(
            Array.from({ length: 3 }, (_, fileIdx) => [
                `src/file-${fileIdx + 1}.txt`,
                Array.from({ length: 100 }, (_, lineIdx) => `MATCH ${fileIdx}-${lineIdx}`).join("\n") + "\n",
            ]),
        ));
        try {
            const capped = await grepSearch("MATCH", { path: dir, limit: 100 });
            assert.ok(
                capped.includes("Search stopped after 200 match event(s)"),
                "default total_limit should cap broad searches",
            );

            const uncapped = await grepSearch("MATCH", { path: dir, limit: 100, totalLimit: 0 });
            assert.ok(
                !uncapped.includes("Search stopped after 200 match event(s)"),
                "explicit totalLimit=0 disables the default cap",
            );
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("files/count modes use a wider default total_limit than content mode", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const dir = makeTempRepo("hex-test-grep-list-cap-", Object.fromEntries(
            Array.from({ length: 300 }, (_, fileIdx) => [
                `src/file-${fileIdx + 1}.txt`,
                "MATCH\n",
            ]),
        ));
        try {
            const files = await grepSearch("MATCH", { path: dir, output: "files" });
            assert.ok(!files.includes("OUTPUT_CAPPED:"), "files mode should not hit the old 200-result default");
            assert.equal(files.trim().split("\n").length, 300, "files mode should list all 300 matching files by default");

            const counts = await grepSearch("MATCH", { path: dir, output: "count" });
            assert.ok(!counts.includes("OUTPUT_CAPPED:"), "count mode should not hit the old 200-result default");
            assert.equal(counts.trim().split("\n").length, 300, "count mode should list all 300 matching files by default");
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("read_file accepts /tmp aliases on Windows for temp files", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const unique = `hex-test-temp-alias-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
        const tmp = join(tmpdir(), unique);
        fs.writeFileSync(tmp, "temp alias works\n");
        try {
            const alias = process.platform === "win32" ? `/tmp/${unique}` : tmp;
            const result = readFile(alias);
            assert.ok(result.includes("temp alias works"), "temp alias path should resolve to the same file");
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });

    it("read checksum round-trips through verify with canonical report", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = join(tmpdir(), "hex-test-read-verify.txt");
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\n");
        try {
            const result = readFile(tmp, { ranges: ["1-2"] });
            const csMatch = result.match(/checksum: (\d+-\d+:[0-9a-f]{8})/);
            assert.ok(csMatch, "read should produce a checksum");
            const verifyResult = verifyChecksums(tmp, [csMatch[1]]);
            assert.ok(verifyResult.includes("status: OK"), `verify should report OK: ${verifyResult}`);
            assert.ok(verifyResult.includes("reason: checksums_current"), "Verify should report canonical reason");
            assert.ok(verifyResult.includes("summary: valid=1 stale=0 invalid=0"), "Summary should classify the checksum set");
            assert.ok(verifyResult.includes("next_action: keep_using"), "Verify should report canonical next action");
            assert.ok(verifyResult.includes("entry: 1/1 | status: VALID | span: 1-2"), "Valid checksum entry should be listed canonically");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("verify reports stale checksums with changed ranges when base revision is available", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = join(tmpdir(), "hex-test-stale-verify.txt");
        fs.writeFileSync(tmp, "one\ntwo\nthree\n");
        try {
            const firstRead = readFile(tmp, { ranges: ["1-2"] });
            const checksum = firstRead.match(/checksum: (\d+-\d+:[0-9a-f]{8})/)[1];
            const baseRevision = firstRead.match(/revision: (\S+)/)[1];
            fs.writeFileSync(tmp, "one\ntwo changed\nthree\n");
            const verifyResult = verifyChecksums(tmp, [checksum], { baseRevision });
            assert.ok(verifyResult.includes("status: STALE"), `verify should report stale: ${verifyResult}`);
            assert.ok(verifyResult.includes("reason: checksums_stale"), "Verify should report canonical stale reason");
            assert.ok(verifyResult.includes(`base_revision: ${baseRevision}`), "Base revision should be echoed");
            assert.ok(verifyResult.includes("changed_ranges:"), "Changed ranges should be reported");
            assert.ok(verifyResult.includes("next_action: reread_ranges"), "Verify should report reread next action");
            assert.ok(verifyResult.includes('suggested_read_call: {"tool":"mcp__hex-line__read_file"'), "Verify should suggest reread call");
            assert.ok(verifyResult.includes("entry: 1/1 | status: STALE | span: 1-2"), "Stale checksum entry should be listed canonically");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("verify reports mixed valid and invalid checksum sets deterministically", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = join(tmpdir(), "hex-test-mixed-verify.txt");
        fs.writeFileSync(tmp, "uno\ndos\ntres\n");
        try {
            const readResult = readFile(tmp, { ranges: ["1-2"] });
            const validChecksum = readResult.match(/checksum: (\d+-\d+:[0-9a-f]{8})/)[1];
            const verifyResult = verifyChecksums(tmp, [validChecksum, "99-120:deadbeef", "bad-checksum"]);
            assert.ok(verifyResult.includes("status: INVALID"), `mixed set should report INVALID: ${verifyResult}`);
            assert.ok(verifyResult.includes("reason: checksums_invalid"), "Mixed invalid set should report canonical reason");
            assert.ok(verifyResult.includes("summary: valid=1 stale=0 invalid=2"), "Summary should classify mixed set");
            assert.ok(verifyResult.includes("next_action: fix_inputs"), "Mixed invalid set should report fix_inputs");
            assert.ok(verifyResult.includes("entry: 1/3 | status: VALID | span: 1-2"), "Valid entry should remain visible");
            assert.ok(verifyResult.includes("entry: 2/3 | status: INVALID | span: 99-120"), "Out-of-range checksum should be classified");
            assert.ok(verifyResult.includes("entry: 3/3 | status: INVALID | checksum: bad-checksum"), "Malformed checksum should be classified");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("grep_search new params", () => {
    it("literal mode disables regex", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const tmp = join(tmpdir(), "hex-test-literal-mode.txt");
        fs.writeFileSync(tmp, "alpha\nbeta.gamma\nxyz\n");
        try {
            // '.' in regex matches any char; in literal mode matches only '.'
            const regex = await grepSearch(".", { path: tmp, plain: true });
            const literal = await grepSearch(".", { path: tmp, plain: true, literal: true });
            const regexCount = regex.split("\n").filter(l => l.trim()).length;
            const litCount = literal.split("\n").filter(l => l.trim()).length;
            assert.ok(regexCount > litCount, `regex (${regexCount}) should match more than literal (${litCount})`);
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });
});

describe("edit_file replace removed", () => {
    it("replace throws REPLACE_REMOVED", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = CWD + "/test/tmp_unique_replace.txt";
        fs.writeFileSync(tmp, "line one\nline two unique marker\nline three\n");
        try {
            assert.throws(() => {
                editFile(tmp, [{ replace: { old_text: "unique marker", new_text: "replaced marker" } }]);
            }, /REPLACE_REMOVED/);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("replace with all:true also throws REPLACE_REMOVED", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const tmp = CWD + "/test/tmp_ambiguous.txt";
        fs.writeFileSync(tmp, "hello world\nhello world\nhello world\n");
        try {
            assert.throws(() => {
                editFile(tmp, [{ replace: { old_text: "hello world", new_text: "bye", all: true } }]);
            }, /REPLACE_REMOVED/);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("edit_file rejects non-canonical flat shapes through the MCP tool boundary", async () => {
        const tmp = join(tmpdir(), `hex-test-noncanonical-edit-${Date.now()}-${Math.random().toString(16).slice(2)}.js`);
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\n");
        try {
            await withMcpClient(async (client) => {
                const result = await client.callTool({
                    name: "edit_file",
                    arguments: {
                        path: tmp,
                        allow_external: true,
                        edits: JSON.stringify([{
                            type: "replace_lines",
                            start: 1,
                            end: 2,
                            content: "alpha updated\nbeta updated",
                            range_checksum: "1-2:deadbeef",
                        }]),
                    },
                });
                assert.equal(result.isError, true, "Tool rejects non-canonical edit payload");
                assert.match(result.content[0].text, /BAD_INPUT: unknown edit type/, "Failure is reported at the public contract boundary");
            });
        } finally {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        }
    });

    it("bulk_replace handles text rename (replace moved here)", async () => {
        const { bulkReplace } = await import("../lib/bulk-replace.mjs");
        const tmp = TMP("hex-test-bulk-rename");
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(tmp + "/rename.txt", "hello world\nhello world\nhello world\n");
        try {
            const result = bulkReplace(tmp, "*.txt",
                [{ old: "hello world", new: "bye world" }]);
            const content = fs.readFileSync(tmp + "/rename.txt", "utf-8");
            assert.ok(!content.includes("hello world"), "no old text should remain");
            assert.equal(content.split("bye world").length - 1, 3, "all 3 replaced");
            assert.ok(result.includes("1 file"), "output reports changed file count");
        } finally {
            fs.unlinkSync(tmp + "/rename.txt");
            fs.rmdirSync(tmp);
        }
    });
});


// ==================== bulk_replace ====================

describe("bulk_replace", () => {
    it("replaces text in matched files", async () => {
        const { bulkReplace } = await import("../lib/bulk-replace.mjs");
        const tmp = TMP("hex-test-bulk");
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(tmp + "/a.txt", "hello world\n");
        fs.writeFileSync(tmp + "/b.txt", "hello planet\n");
        try {
            const result = bulkReplace(tmp, "*.txt", [{ old: "hello", new: "hi" }]);
            assert.ok(result.includes("2 changed") || result.includes("changed"), "files should be changed");
            assert.equal(fs.readFileSync(tmp + "/a.txt", "utf-8").trim(), "hi world");
            assert.equal(fs.readFileSync(tmp + "/b.txt", "utf-8").trim(), "hi planet");
        } finally {
            fs.unlinkSync(tmp + "/a.txt");
            fs.unlinkSync(tmp + "/b.txt");
            fs.rmdirSync(tmp);
        }
    });

    it("defaults to compact format with replacement counts", async () => {
        const { bulkReplace } = await import("../lib/bulk-replace.mjs");
        const tmp = TMP("hex-test-bulk-compact");
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(tmp + "/a.txt", "foo bar foo\n");
        fs.writeFileSync(tmp + "/b.txt", "foo baz\n");
        fs.writeFileSync(tmp + "/c.txt", "no match here\n");
        try {
            const result = bulkReplace(tmp, "*.txt", [{ old: "foo", new: "qux" }], { dryRun: true });
            assert.ok(result.includes("2 files changed"), "header shows changed count");
            assert.ok(result.includes("(3 replacements)"), "header shows total replacements");
            assert.ok(result.includes("1 skipped"), "header shows skipped");
            assert.ok(result.includes("a.txt: 2 replacements"), "per-file count for a.txt");
            assert.ok(result.includes("b.txt: 1 replacements"), "per-file count for b.txt");
            assert.ok(!result.includes("-") || !result.match(/^[-+]\d+\|/m), "no diff lines in compact mode");
        } finally {
            fs.unlinkSync(tmp + "/a.txt");
            fs.unlinkSync(tmp + "/b.txt");
            fs.unlinkSync(tmp + "/c.txt");
            fs.rmdirSync(tmp);
        }
    });

    it("caps per-file diff lines and total output in full mode", async () => {
        const { bulkReplace } = await import("../lib/bulk-replace.mjs");
        const { MAX_BULK_OUTPUT_CHARS } = await import("../lib/format.mjs");
        const tmp = TMP("hex-test-bulk-cap");
        fs.mkdirSync(tmp, { recursive: true });
        // Create a large file with 600 lines, each containing the target text
        const lines = Array.from({ length: 600 }, (_, i) => `line ${i} target_text here`);
        fs.writeFileSync(tmp + "/big.txt", lines.join("\n") + "\n");
        try {
            const result = bulkReplace(tmp, "*.txt", [{ old: "target_text", new: "replaced" }], { dryRun: true, format: "full" });
            assert.ok(result.includes("lines omitted"), "per-file diff should be truncated");
            assert.ok(result.length <= MAX_BULK_OUTPUT_CHARS + 100, "total output within cap (with OUTPUT_CAPPED notice)");
            assert.ok(result.includes("600 replacements") || result.includes("replacements"), "shows replacement count");
        } finally {
            fs.unlinkSync(tmp + "/big.txt");
            fs.rmdirSync(tmp);
        }
    });

    it("handles chained rules, glob {a,b}, and old===new skip", async () => {
        const { bulkReplace } = await import("../lib/bulk-replace.mjs");
        const tmp = TMP("hex-test-bulk-edge");
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(tmp + "/x.mjs", "foo calls foo\n");
        fs.writeFileSync(tmp + "/y.json", "foo here too\n");
        fs.writeFileSync(tmp + "/z.txt", "no match\n");
        try {
            // Chained: foo→bar then bar→baz (cascading — bar from rule 1 is input to rule 2)
            // old===new skip: noop rule should be ignored
            const result = bulkReplace(tmp, "*.{mjs,json}", [
                { old: "foo", new: "bar" },
                { old: "bar", new: "baz" },
                { old: "noop", new: "noop" },
            ], { dryRun: true });
            // Glob {mjs,json} matches x.mjs and y.json but not z.txt
            assert.ok(result.includes("2 files changed"), "glob {a,b} matches both extensions");
            // Chained: foo→bar→baz, so final content has "baz" not "bar"
            assert.ok(!result.includes("0 replacements"), "chained rules produce non-zero counts");
            // z.txt not in glob, x.mjs and y.json matched
            assert.ok(!result.includes("z.txt"), "z.txt excluded by glob");
        } finally {
            fs.unlinkSync(tmp + "/x.mjs");
            fs.unlinkSync(tmp + "/y.json");
            fs.unlinkSync(tmp + "/z.txt");
            fs.rmdirSync(tmp);
        }
    });
});

// ==================== changes ====================

describe("changes", () => {
    it("returns diff against HEAD for tracked file", async () => {
        const { fileChanges } = await import("../lib/changes.mjs");
        // Use a known tracked file — should return no changes or a diff
        const result = await fileChanges(CWD + "/lib/read.mjs", "HEAD");
        assert.ok(typeof result === "string", "should return string");
        assert.ok(result.length > 0, "should have content");
        assert.ok(result.includes("status:"), "changes returns canonical status");
        assert.ok(result.includes("reason:"), "changes returns canonical reason");
        assert.ok(result.includes("summary:"), "changes returns canonical summary");
        assert.ok(result.includes("next_action:"), "changes returns canonical next action");
    });
});
// ==================== isHexLineDisabled ====================

describe("isHexLineDisabled", () => {
    it("returns true when hex-line is in disabledMcpServers for cwd project", async () => {
        const { isHexLineDisabled, _resetHexLineDisabledCache } = await import("../hook.mjs");
        _resetHexLineDisabledCache();

        const tmp = TMP("hex-test-claude.json");
        const cwd = process.cwd().replace(/\\/g, "/");
        const config = {
            projects: {
                [cwd]: {
                    disabledMcpServers: ["hex-line", "hex-graph"],
                },
            },
        };
        fs.writeFileSync(tmp, JSON.stringify(config));
        try {
            const result = isHexLineDisabled(tmp);
            assert.equal(result, true, "hex-line is disabled for current project");
        } finally {
            _resetHexLineDisabledCache();
            fs.unlinkSync(tmp);
        }
    });

    it("returns false when hex-line is NOT in disabledMcpServers", async () => {
        const { isHexLineDisabled, _resetHexLineDisabledCache } = await import("../hook.mjs");
        _resetHexLineDisabledCache();

        const tmp = TMP("hex-test-claude2.json");
        const cwd = process.cwd().replace(/\\/g, "/");
        const config = {
            projects: {
                [cwd]: {
                    disabledMcpServers: ["hex-graph"],
                },
            },
        };
        fs.writeFileSync(tmp, JSON.stringify(config));
        try {
            const result = isHexLineDisabled(tmp);
            assert.equal(result, false, "hex-line is not disabled");
        } finally {
            _resetHexLineDisabledCache();
            fs.unlinkSync(tmp);
        }
    });
});

// ==================== hook subprocess ====================

describe("hook — ls redirect", () => {
    it("allows simple ls", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls src/" });
        assert.equal(r.code, 0);
    });
    it("allows ls -la", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls -la src/" });
        assert.equal(r.code, 0);
    });
    it("redirects ls -R", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls -R" });
        assert.notEqual(r.code, 0);
    });
    it("redirects ls -R .", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls -R ." });
        assert.notEqual(r.code, 0);
    });
    it("redirects ls -laR src/", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls -laR src/" });
        assert.notEqual(r.code, 0);
    });
    it("redirects dir /s", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "dir /s" });
        assert.notEqual(r.code, 0);
    });
    it("allows ls -al -R (documented limitation)", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "ls -al -R src/" });
        assert.equal(r.code, 0, "accepted trade-off — unusual flag ordering not caught");
    });
});

describe("hook — Read config exception", () => {
    it("allows .claude/settings.json (relative)", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: ".claude/settings.json" });
        assert.equal(r.code, 0);
    });
    it("allows ./.claude/settings.json (dot-relative)", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: "./.claude/settings.json" });
        assert.equal(r.code, 0);
    });
    it("blocks src/.claude/settings.json (not under cwd/.claude/)", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: "src/.claude/settings.json" });
        assert.notEqual(r.code, 0);
    });
    it("blocks .claude/foo.ts", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: ".claude/foo.ts" });
        assert.notEqual(r.code, 0);
    });
    it("redirects src/index.ts", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: "src/index.ts" });
        assert.notEqual(r.code, 0);
    });
    it("redirects partial built-in Read on a small file", async () => {
        const tmp = TMP(`hex-hook-small-read-${Date.now()}.ts`);
        fs.writeFileSync(tmp, "line 1\nline 2\nline 3\n");
        try {
            const r = await runHook("PreToolUse", "Read", { file_path: tmp, offset: 1, limit: 2 });
            assert.notEqual(r.code, 0);
            assert.ok(r.stdout.includes("read_file"), "Partial read is redirected to hex-line read_file");
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });
    it("blocks full built-in Read on a large file", async () => {
        const tmp = TMP(`hex-hook-large-read-${Date.now()}.ts`);
        fs.writeFileSync(tmp, Array.from({ length: 1000 }, () => "const value = 1234567890;").join("\n"));
        try {
            const r = await runHook("PreToolUse", "Read", { file_path: tmp });
            assert.notEqual(r.code, 0);
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });
    it("allows image.png (binary)", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: "image.png" });
        assert.equal(r.code, 0);
    });
    it("allows ~/.claude/settings.json (home-relative)", async () => {
        const r = await runHook("PreToolUse", "Read", { file_path: "~/.claude/settings.json" });
        assert.equal(r.code, 0);
    });
    it("allows absolute .claude/settings.json (uppercase drive)", async () => {
        const cwd = process.cwd().replace(/\\/g, "/");
        const r = await runHook("PreToolUse", "Read", { file_path: cwd + "/.claude/settings.json" });
        assert.equal(r.code, 0);
    });
    it("allows absolute .claude/settings.json (lowercase drive)", async () => {
        const cwd = process.cwd().replace(/\\/g, "/");
        const lower = cwd[0].toLowerCase() + cwd.slice(1);
        const r = await runHook("PreToolUse", "Read", { file_path: lower + "/.claude/settings.json" });
        assert.equal(r.code, 0);
    });
});

describe("hook — regressions", () => {
    it("redirects cat file.ts", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "cat file.ts" });
        assert.notEqual(r.code, 0);
    });
    it("blocks rm -rf /", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "rm -rf /" });
        assert.notEqual(r.code, 0);
    });
    it("allows # hex-confirmed bypass", async () => {
        const r = await runHook("PreToolUse", "Bash", { command: "rm -rf / # hex-confirmed" });
        assert.equal(r.code, 0);
    });
    it("redirects small built-in Edit on a small file", async () => {
        const tmp = TMP(`hex-hook-small-edit-${Date.now()}.ts`);
        fs.writeFileSync(tmp, "const value = 1;\n");
        try {
            const r = await runHook("PreToolUse", "Edit", {
                file_path: tmp,
                old_string: "value = 1",
                new_string: "value = 2",
            });
            assert.notEqual(r.code, 0, "Small edit is redirected");
            assert.ok(r.stdout.includes("mcp__hex-line__edit_file"), "Small edit redirects to hex-line edit_file");
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });
    it("blocks replace_all built-in Edit on a large file", async () => {
        const tmp = TMP(`hex-hook-large-edit-${Date.now()}.ts`);
        fs.writeFileSync(tmp, Array.from({ length: 1200 }, () => "const item = oldValue;").join("\n"));
        try {
            const r = await runHook("PreToolUse", "Edit", {
                file_path: tmp,
                old_string: "oldValue",
                new_string: "newValue",
                replace_all: true,
            });
            assert.notEqual(r.code, 0);
        } finally {
            fs.rmSync(tmp, { force: true });
        }
    });
    it("SessionStart injects structured instructions with deferred loading hint", async () => {
        const r = await runHook("SessionStart", "", {});
        assert.equal(r.code, 0);
        assert.ok(r.stdout.includes("Hex-line MCP available"), "SessionStart announces hex-line");
        assert.ok(r.stdout.includes("deferred_loading"), "SessionStart includes deferred loading tag");
        assert.ok(r.stdout.includes("ToolSearch"), "SessionStart includes ToolSearch bootstrap");
        assert.ok(!r.stdout.includes("Do not use ToolSearch"), "SessionStart does NOT suppress ToolSearch");
    });
    it("redirect messages include deferred hint", async () => {
        const r = await runHook("PreToolUse", "Write", { file_path: "test.ts", content: "hello" });
        assert.notEqual(r.code, 0, "Write is redirected");
        assert.ok(r.stdout.includes("ToolSearch"), "Redirect includes ToolSearch hint");
    });
});

// ==================== PostToolUse RTK ====================

describe("PostToolUse RTK", () => {
    function makeLines(n, prefix = "line") {
        return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join("\n");
    }

    it("short output passthrough (< threshold)", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "echo ok" }, {
            tool_response: makeLines(10)
        });
        assert.equal(r.code, 0);
        assert.equal(r.stderr, "");
    });

    it("long output filtering (>= threshold)", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "npm install" }, {
            tool_response: makeLines(100)
        });
        assert.equal(r.code, 2);
        assert.ok(r.stderr.includes("RTK FILTERED"), "should contain RTK FILTERED header");
        assert.ok(r.stderr.includes("(100 lines ->"), "should contain original count");
        assert.ok(r.stderr.includes("lines omitted"), "should contain truncation marker");
        // Head preserved (lines 1-15)
        assert.ok(r.stderr.includes("line 1"), "should contain first line");
        assert.ok(r.stderr.includes("line 15"), "should contain 15th line");
        // Tail preserved (lines 86-100)
        assert.ok(r.stderr.includes("line 100"), "should contain last line");
        // Middle omitted
        assert.ok(!r.stderr.includes("line 50"), "should NOT contain middle line");
    });

    it("object with stdout", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "npm install" }, {
            tool_response: { stdout: makeLines(100) }
        });
        assert.equal(r.code, 2);
        assert.ok(r.stderr.includes("RTK FILTERED"));
    });

    it("object with stderr only", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "npm install" }, {
            tool_response: { stderr: makeLines(100, "err") }
        });
        assert.equal(r.code, 2);
        assert.ok(r.stderr.includes("RTK FILTERED"));
        assert.ok(r.stderr.includes("err 1"), "should contain stderr content");
    });

    it("object with both streams — combined, stdout before stderr", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "npm install" }, {
            tool_response: {
                stdout: makeLines(50, "STDOUT_MARKER"),
                stderr: makeLines(60, "STDERR_MARKER")
            }
        });
        assert.equal(r.code, 2);
        assert.ok(r.stderr.includes("STDOUT_MARKER"), "should contain stdout content");
        assert.ok(r.stderr.includes("STDERR_MARKER"), "should contain stderr content");
        // Verify order: stdout before stderr
        const stdoutPos = r.stderr.indexOf("STDOUT_MARKER");
        const stderrPos = r.stderr.indexOf("STDERR_MARKER");
        assert.ok(stdoutPos < stderrPos, "stdout should appear before stderr");
    });

    it("missing tool_response", async () => {
        const r = await runHook("PostToolUse", "Bash", { command: "echo ok" });
        assert.equal(r.code, 0);
        assert.equal(r.stderr, "");
    });

    it("non-Bash tool", async () => {
        const r = await runHook("PostToolUse", "Read", { file_path: "/tmp/x" }, {
            tool_response: makeLines(100)
        });
        assert.equal(r.code, 0);
        assert.equal(r.stderr, "");
    });
});

// ==================== WASM dependency contract ====================

describe("WASM dependency contract", () => {
    it("package.json declares the parser runtime dependency only once", () => {
        const pkg = JSON.parse(fs.readFileSync(
            resolve(__dirname, "../package.json"), "utf8"
        ));
        const deps = pkg.dependencies || {};
        assert.ok(deps["web-tree-sitter"],
            "web-tree-sitter missing from dependencies — outline will fail after npm install");
        assert.ok(!deps["tree-sitter-wasms"],
            "tree-sitter-wasms should not be a direct dependency anymore — grammars now come from hex-common artifacts");
    });

    it("hex-common artifact bundle exists for all supported grammars", () => {
        const artifactDir = resolve(__dirname, "../../hex-common/artifacts/tree-sitter");
        const manifest = JSON.parse(fs.readFileSync(resolve(artifactDir, "manifest.json"), "utf8"));
        const missing = (manifest.grammars || [])
            .map(entry => entry.file)
            .filter(file => !fs.existsSync(resolve(artifactDir, file)));
        assert.deepEqual(missing, [], `WASM files missing for: ${missing.join(", ")}`);
    });
});

// ==================== Phase 7: Protocol & E2E tests ====================

describe("kernel: snapshot", () => {
    it("createSnapshot returns deterministic revision and hashes", async () => {
        const { rememberSnapshot, _resetSnapshotCache } = await import("../lib/snapshot.mjs");
        _resetSnapshotCache();
        const tmp = TMP("hex-test-kernel-snapshot.js");
        fs.writeFileSync(tmp, "line1\nline2\nline3\n");
        try {
            const stat = fs.statSync(tmp);
            const snap = rememberSnapshot(tmp, "line1\nline2\nline3\n", { mtimeMs: stat.mtimeMs, size: stat.size });
            assert.match(snap.revision, /^rev-\d+-[a-f0-9]{8}$/, "Revision format rev-N-hex8");
            assert.strictEqual(snap.lines.length, 4, "Lines split correctly (trailing newline)");
            assert.strictEqual(snap.lineHashes.length, snap.lines.length, "lineHashes matches lines count");
            assert.ok(snap.fileChecksum, "File checksum present");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("buildRangeChecksum returns null for out-of-bounds", async () => {
        const { rememberSnapshot, buildRangeChecksum, _resetSnapshotCache } = await import("../lib/snapshot.mjs");
        _resetSnapshotCache();
        const tmp = TMP("hex-test-kernel-range.js");
        fs.writeFileSync(tmp, "a\nb\nc\n");
        try {
            const stat = fs.statSync(tmp);
            const snap = rememberSnapshot(tmp, "a\nb\nc\n", { mtimeMs: stat.mtimeMs, size: stat.size });
            assert.ok(buildRangeChecksum(snap, 1, 3), "Valid range returns checksum");
            assert.strictEqual(buildRangeChecksum(snap, 1, 100), null, "Out-of-bounds returns null");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("keeps the same revision when only line endings change", async () => {
        const { readSnapshot, _resetSnapshotCache } = await import("../lib/snapshot.mjs");
        _resetSnapshotCache();
        const tmp = TMP("hex-test-kernel-eol-stable.txt");
        fs.writeFileSync(tmp, "alpha\r\nbeta\r\ngamma\r\n");
        try {
            const first = readSnapshot(tmp);
            fs.writeFileSync(tmp, "alpha\nbeta\ngamma\n");
            const second = readSnapshot(tmp);
            assert.equal(second.revision, first.revision, "Logical revision stays stable across EOL-only rewrite");
            assert.equal(second.fileChecksum, first.fileChecksum, "Checksum stays stable across EOL-only rewrite");
            assert.equal(second.eol, "lf", "Latest snapshot still reflects current file EOL");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("protocol: read_file blocks", () => {
    it("single range returns edit_ready_block with checksum", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-read.js");
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\ndelta\n");
        try {
            const result = readFile(tmp, { ranges: ["1-3"] });
            assert.ok(result.includes("block: read_range"), "Contains read_range block");
            assert.ok(result.includes("span: 1-3"), "Contains correct span");
            assert.ok(result.includes("checksum: 1-3:"), "Contains checksum for range");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("emits EOL and trailing newline metadata", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-read-eol.txt");
        fs.writeFileSync(tmp, "alpha\r\nbeta\r\n");
        try {
            const result = readFile(tmp, { ranges: ["1-2"] });
            assert.ok(result.includes("eol: crlf"), "Top-level read output reports EOL");
            assert.ok(result.includes("trailing_newline: true"), "Top-level read output reports trailing newline");
            assert.ok(result.includes("block: read_range"), "Read block is still emitted");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("multi-range returns separate blocks", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-multiread.js");
        fs.writeFileSync(tmp, Array.from({length: 20}, (_, i) => `line${i+1}`).join("\n") + "\n");
        try {
            const result = readFile(tmp, { ranges: ["1-5", "15-20"] });
            const blocks = result.split("block: read_range").length - 1;
            assert.ok(blocks >= 2, "At least 2 read_range blocks");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("protocol: grep_search blocks", () => {
    it("content mode returns search_hunk with checksum", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const result = await grepSearch("buildEditReadyBlock", { path: CWD + "/lib", output: "content" });
        assert.ok(result.includes("block: search_hunk"), "Contains search_hunk block");
        assert.ok(result.includes("checksum:"), "Contains checksum");
    });
});

describe("protocol: edit_file output", () => {
    it("preserves CRLF bytes on edit", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-edit-crlf.txt");
        fs.writeFileSync(tmp, "first\r\nsecond\r\nthird\r\n");
        try {
            const read = readFile(tmp, { ranges: ["1-3"] });
            const anchor = read.match(/([a-z2-7]{2}\.2)\tsecond/)?.[1];
            assert.ok(anchor, "Got anchor from CRLF read");
            editFile(tmp, [{ set_line: { anchor, new_text: "SECOND" } }]);
            const written = fs.readFileSync(tmp, "utf8");
            assert.equal(written, "first\r\nSECOND\r\nthird\r\n", "Edit preserves CRLF bytes");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("read_file -> edit_file succeeds through the MCP tool boundary", async () => {
        const tmp = join(tmpdir(), `hex-test-mcp-edit-${Date.now()}-${Math.random().toString(16).slice(2)}.js`);
        fs.writeFileSync(tmp, "alpha\nbeta\ngamma\ndelta\n");
        try {
            await withMcpClient(async (client) => {
                const defaultRead = await client.callTool({
                    name: "read_file",
                    arguments: { path: tmp, ranges: ["2-3"] },
                });
                const defaultText = defaultRead.content[0].text;
                assert.ok(defaultText.includes("2|beta"), "default read_file is discovery-first plain output");
                assert.ok(!defaultText.includes("checksum:"), "default read_file omits edit-ready checksums");

                const readResult = await client.callTool({
                    name: "read_file",
                    arguments: { path: tmp, ranges: ["2-3"], edit_ready: true, verbosity: "full" },
                });
                const readText = readResult.content[0].text;
                const startAnchor = readText.match(/([a-z2-7]{2}\.2)\tbeta/)?.[1];
                const endAnchor = readText.match(/([a-z2-7]{2}\.3)\tgamma/)?.[1];
                const checksum = readText.match(/checksum: (\d+-\d+:[0-9a-f]{8})/)?.[1];
                assert.ok(startAnchor && endAnchor && checksum, "read_file exposes canonical anchors and checksum");

                const editResult = await client.callTool({
                    name: "edit_file",
                    arguments: {
                        path: tmp,
                        allow_external: true,
                        edits: JSON.stringify([{
                            replace_lines: {
                                start_anchor: startAnchor,
                                end_anchor: endAnchor,
                                new_text: "beta updated\ngamma updated",
                                range_checksum: checksum,
                            },
                        }]),
                    },
                });
                assert.notEqual(editResult.isError, true, "Canonical edit payload succeeds");
                const editText = editResult.content[0].text;
                assert.ok(editText.includes("status: OK"), "Edit reports success");
                assert.ok(editText.includes("block: post_edit"), "Edit returns post-edit canonical block");
            });
        } finally {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        }
    });

    it("edit_file blocks outside-project edits by default and allows explicit override", async () => {
        const tmp = join(tmpdir(), `hex-test-mcp-edit-external-${Date.now()}-${Math.random().toString(16).slice(2)}.js`);
        fs.writeFileSync(tmp, "alpha\nbeta\n");
        try {
            await withMcpClient(async (client) => {
                const readResult = await client.callTool({
                    name: "read_file",
                    arguments: { path: tmp, ranges: ["1-2"], edit_ready: true, verbosity: "full" },
                });
                const readText = readResult.content[0].text;
                const anchor = readText.match(/([a-z2-7]{2}\.2)\tbeta/)?.[1];
                assert.ok(anchor, "read_file still works for external temp paths");

                const blocked = await client.callTool({
                    name: "edit_file",
                    arguments: {
                        path: tmp,
                        edits: JSON.stringify([{ set_line: { anchor, new_text: "BETA" } }]),
                    },
                });
                assert.equal(blocked.isError, true, "external edit should be blocked by default");
                assert.match(blocked.content[0].text, /PATH_OUTSIDE_PROJECT/);
                assert.match(blocked.content[0].text, /allow_external=true/);

                const allowed = await client.callTool({
                    name: "edit_file",
                    arguments: {
                        path: tmp,
                        edits: JSON.stringify([{ set_line: { anchor, new_text: "BETA" } }]),
                        allow_external: true,
                    },
                });
                assert.notEqual(allowed.isError, true, "explicit override should allow external edit");
                assert.ok(fs.readFileSync(tmp, "utf8").includes("BETA"), "external edit applies once override is set");
            });
        } finally {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        }
    });

    it("grep_search defaults to summary and requires explicit edit_ready for canonical hunks", async () => {
        const tmp = join(tmpdir(), `hex-test-mcp-grep-${Date.now()}-${Math.random().toString(16).slice(2)}.js`);
        fs.writeFileSync(tmp, "const AAA = 1;\nconst BBB = 2;\nconst AAA_2 = 3;\n");
        try {
            await withMcpClient(async (client) => {
                const summaryResult = await client.callTool({
                    name: "grep_search",
                    arguments: { path: tmp, pattern: "AAA" },
                });
                const summaryText = summaryResult.content[0].text;
                assert.ok(summaryText.includes("summary:"), "default grep_search returns summary output");
                assert.ok(summaryText.includes("snippets:"), "summary output includes snippets");
                assert.ok(!summaryText.includes("block: search_hunk"), "summary output omits canonical hunks");

                const contentResult = await client.callTool({
                    name: "grep_search",
                    arguments: { path: tmp, pattern: "AAA", output: "content", edit_ready: true },
                });
                const contentText = contentResult.content[0].text;
                assert.ok(contentText.includes("block: search_hunk"), "explicit content mode returns search hunks");
                assert.ok(contentText.includes("checksum:"), "explicit content mode returns checksums");
            });
        } finally {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        }
    });

    it("write_file and bulk_replace require allow_external for external targets", async () => {
        const dir = join(tmpdir(), `hex-test-mcp-write-external-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const filePath = join(dir, "note.txt");
        fs.mkdirSync(dir, { recursive: true });
        try {
            await withMcpClient(async (client) => {
                const blockedWrite = await client.callTool({
                    name: "write_file",
                    arguments: { path: filePath, content: "alpha\n" },
                });
                assert.equal(blockedWrite.isError, true, "external write should be blocked by default");
                assert.match(blockedWrite.content[0].text, /allow_external=true/);

                const allowedWrite = await client.callTool({
                    name: "write_file",
                    arguments: { path: filePath, content: "alpha\n", allow_external: true },
                });
                assert.notEqual(allowedWrite.isError, true, "explicit override should allow external write");

                const blockedBulk = await client.callTool({
                    name: "bulk_replace",
                    arguments: {
                        path: dir,
                        replacements: JSON.stringify([{ old: "alpha", new: "beta" }]),
                        glob: "*.txt",
                    },
                });
                assert.equal(blockedBulk.isError, true, "external bulk replace should be blocked by default");
                assert.match(blockedBulk.content[0].text, /allow_external=true/);

                const allowedBulk = await client.callTool({
                    name: "bulk_replace",
                    arguments: {
                        path: dir,
                        replacements: JSON.stringify([{ old: "alpha", new: "beta" }]),
                        glob: "*.txt",
                        allow_external: true,
                    },
                });
                assert.notEqual(allowedBulk.isError, true, "explicit override should allow external bulk replace");
                assert.equal(fs.readFileSync(filePath, "utf8"), "beta\n");
            });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("post-edit contains block: post_edit with checksum", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-edit.js");
        fs.writeFileSync(tmp, "first\nsecond\nthird\n");
        try {
            const read = readFile(tmp, { ranges: ["1-3"] });
            const anchor = read.match(/([a-z2-7]{2}\.2)\tsecond/)?.[1];
            assert.ok(anchor, "Got anchor from read");
            const result = editFile(tmp, [{ set_line: { anchor, new_text: "SECOND" } }]);
            assert.ok(result.includes("block: post_edit"), "Post-edit uses block protocol");
            assert.ok(result.includes("checksum:"), "Post-edit has checksum");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("CHECKSUM_MISMATCH includes recovery guidance", async () => {
        const { editFile } = await import("../lib/edit.mjs");
        const { readFile } = await import("../lib/read.mjs");
        const tmp = TMP("hex-test-proto-recovery.js");
        fs.writeFileSync(tmp, "aaa\nbbb\nccc\n");
        try {
            const read = readFile(tmp, { ranges: ["1-3"] });
            const startAnchor = read.match(/([a-z2-7]{2}\.1)/)?.[1];
            const endAnchor = read.match(/([a-z2-7]{2}\.3)/)?.[1];
            // Mutate the file to make checksum stale
            fs.writeFileSync(tmp, "aaa\nXXX\nccc\n");
            try {
                editFile(tmp, [{ replace_lines: { start_anchor: startAnchor, end_anchor: endAnchor, new_text: "new", range_checksum: "1-3:deadbeef" } }]);
                assert.fail("Should have thrown");
            } catch (e) {
                assert.ok(e.message.includes("CHECKSUM_MISMATCH"), "Error is CHECKSUM_MISMATCH");
                assert.ok(e.message.includes("next_action:"), "Contains canonical recovery guidance");
                assert.ok(e.message.includes("read_file"), "Mentions read_file");
            }
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("protocol: outline", () => {
    it("code outline includes hash anchors", async () => {
        const { fileOutline } = await import("../lib/outline.mjs");
        const result = await fileOutline(CWD + "/lib/snapshot.mjs");
        // Should contain tag.lineNum-lineNum: pattern
        assert.match(result, /[a-z2-7]{2}\.\d+-\d+:/, "Outline entries have hash anchor prefix");
        assert.ok(result.includes("symbols"), "Shows symbol count");
    });

    it("markdown outline returns headings", async () => {
        const { fileOutline } = await import("../lib/outline.mjs");
        const tmp = TMP("hex-test-outline.md");
        fs.writeFileSync(tmp, "# Title\n\nSome text\n\n## Section A\n\n### Subsection\n\n## Section B\n");
        try {
            const result = await fileOutline(tmp);
            assert.ok(result.includes("Title"), "Contains title heading");
            assert.ok(result.includes("Section A"), "Contains section heading");
            assert.ok(result.includes("Subsection"), "Contains subsection");
            assert.ok(result.includes("4 symbols"), "Counts 4 headings");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("markdown outline ignores headings inside fenced code blocks", async () => {
        const { fileOutline } = await import("../lib/outline.mjs");
        const tmp = join(tmpdir(), `hex-test-outline-fenced-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
        fs.writeFileSync(tmp, "# Title\n\n```md\n# Fake Heading\n```\n\n## Real Section\n");
        try {
            const result = await fileOutline(tmp);
            assert.ok(result.includes("Title"), "Real heading remains visible");
            assert.ok(result.includes("Real Section"), "Heading after fence remains visible");
            assert.ok(!result.includes("Fake Heading"), "Fenced code heading is ignored");
            assert.ok(result.includes("2 symbols"), "Only real headings are counted");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("E2E: workflow round-trips", () => {
    it("read -> edit -> verify round-trip", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = TMP("hex-test-e2e-rev.js");
        fs.writeFileSync(tmp, "const x = 1;\nconst y = 2;\nconst z = 3;\n");
        try {
            // Read
            const read = readFile(tmp, { ranges: ["1-3"] });
            const anchor = read.match(/([a-z2-7]{2}\.2)/)?.[1];
            assert.ok(anchor, "Got anchor from read");
            // Edit
            const editResult = editFile(tmp, [{ set_line: { anchor, new_text: "const y = 42;" } }]);
            assert.ok(editResult.includes("status: OK"), "Edit succeeded");
            // Extract post-edit checksum
            const postChecksum = editResult.match(/checksum: (\S+)/)?.[1];
            assert.ok(postChecksum, "Post-edit has checksum");
            // Verify post-edit checksum
            const verifyResult = verifyChecksums(tmp, [postChecksum]);
            assert.ok(verifyResult.includes("status: OK"), "Verify confirms post-edit checksum is valid");
            assert.ok(verifyResult.includes("valid=1"), "One valid checksum");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("grep -> edit -> verify round-trip", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = TMP("hex-test-e2e-grep.js");
        fs.writeFileSync(tmp, "function hello() {\n    return 'world';\n}\n");
        try {
            // Search
            const searchResult = await grepSearch("hello", { path: tmp, output: "content", editReady: true });
            assert.ok(searchResult.includes("search_hunk"), "Search returned hunk");
            // Extract anchor from search result
            const anchor = searchResult.match(/>>([a-z2-7]{2}\.\d+)\t/)?.[1];
            assert.ok(anchor, "Got anchor from search match");
            // Edit using search anchor
            const editResult = editFile(tmp, [{ set_line: { anchor, new_text: "function greet() {" } }]);
            assert.ok(editResult.includes("status: OK"), "Edit from search anchor succeeded");
            // Extract post-edit checksum and verify
            const postChecksum = editResult.match(/checksum: (\S+)/)?.[1];
            const verifyResult = verifyChecksums(tmp, [postChecksum]);
            assert.ok(verifyResult.includes("valid=1"), "Post-edit checksum valid");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("verify stays current across an EOL-only rewrite", async () => {
        const { readFile } = await import("../lib/read.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = TMP("hex-test-e2e-verify-eol.txt");
        fs.writeFileSync(tmp, "one\r\ntwo\r\nthree\r\n");
        try {
            const read = readFile(tmp, { ranges: ["1-3"] });
            const checksum = read.match(/checksum: (\S+)/)?.[1];
            const baseRevision = read.match(/revision: (\S+)/)?.[1];
            assert.ok(checksum && baseRevision, "Read exposes checksum and revision");
            fs.writeFileSync(tmp, "one\ntwo\nthree\n");
            const verify = verifyChecksums(tmp, [checksum], { baseRevision });
            assert.ok(verify.includes("status: OK"), "EOL-only rewrite stays valid");
            assert.ok(verify.includes("valid=1"), "Checksum remains current");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});

describe("remaining checklist tests", () => {
    it("snapshot cache returns same revision on repeated read", async () => {
        const { readSnapshot, _resetSnapshotCache } = await import("../lib/snapshot.mjs");
        _resetSnapshotCache();
        const tmp = TMP("hex-test-cache-behavior.js");
        fs.writeFileSync(tmp, "cached\ncontent\n");
        try {
            const snap1 = readSnapshot(tmp);
            const snap2 = readSnapshot(tmp);
            assert.strictEqual(snap1.revision, snap2.revision, "Same revision from cache");
            assert.strictEqual(snap1, snap2, "Same object reference (cache hit)");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("outline-to-read range roundtrip", async () => {
        const { fileOutline } = await import("../lib/outline.mjs");
        const { readFile } = await import("../lib/read.mjs");
        const result = await fileOutline(CWD + "/lib/snapshot.mjs");
        // Extract first entry range: tag.start-end: text
        const match = result.match(/([a-z2-7]{2})\.(\d+)-(\d+):/);
        assert.ok(match, "Outline has entry with range");
        const [, , start, end] = match;
        // Read that exact range
        const readResult = readFile(CWD + "/lib/snapshot.mjs", { ranges: [`${start}-${end}`] });
        assert.ok(readResult.includes(`span: ${start}-`), "Read returns block spanning outline range");
        assert.ok(readResult.includes("checksum:"), "Read block has checksum");
    });

    it("outline -> read_file -> edit_file E2E", async () => {
        const { fileOutline } = await import("../lib/outline.mjs");
        const { readFile } = await import("../lib/read.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = TMP("hex-test-e2e-outline.js");
        fs.writeFileSync(tmp, "function foo() {\n    return 1;\n}\n\nfunction bar() {\n    return 2;\n}\n");
        try {
            // Outline
            const outline = await fileOutline(tmp);
            assert.ok(outline.includes("foo"), "Outline has foo");
            // Extract anchor from outline (tag.line)
            const anchorMatch = outline.match(/([a-z2-7]{2})\.(\d+)-\d+:.*foo/);
            assert.ok(anchorMatch, "Got anchor for foo from outline");
            const anchor = `${anchorMatch[1]}.${anchorMatch[2]}`;
            // Read range around foo
            const read = readFile(tmp, { ranges: ["1-3"] });
            assert.ok(read.includes("checksum:"), "Read has checksum");
            // Edit using outline anchor
            const editResult = editFile(tmp, [{ set_line: { anchor, new_text: "function foo_renamed() {" } }]);
            assert.ok(editResult.includes("status: OK"), "Edit succeeded");
            // Verify post-edit
            const postChecksum = editResult.match(/checksum: (\S+)/)?.[1];
            const verifyResult = verifyChecksums(tmp, [postChecksum]);
            assert.ok(verifyResult.includes("valid=1"), "Post-edit checksum valid");
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    it("grep_search -> multi-edit", async () => {
        const { grepSearch } = await import("../lib/search.mjs");
        const { editFile } = await import("../lib/edit.mjs");
        const { verifyChecksums } = await import("../lib/verify.mjs");
        const tmp = TMP("hex-test-e2e-multi-grep.js");
        fs.writeFileSync(tmp, "const AAA = 1;\nconst BBB = 2;\nconst CCC = 3;\nconst AAA_2 = 4;\n");
        try {
            // Search for AAA
            const searchResult = await grepSearch("AAA", { path: tmp, output: "content", editReady: true });
            assert.ok(searchResult.includes("search_hunk"), "Search returned hunks");
            // Extract 2 match anchors
            const anchors = [...searchResult.matchAll(/>>([a-z2-7]{2}\.\d+)\t/g)].map(m => m[1]);
            assert.ok(anchors.length >= 2, `Got ${anchors.length} match anchors`);
            // Multi-edit: change both lines
            const editResult = editFile(tmp, [
                { set_line: { anchor: anchors[0], new_text: "const XXX = 1;" } },
                { set_line: { anchor: anchors[1], new_text: "const XXX_2 = 4;" } },
            ]);
            assert.ok(editResult.includes("status: OK"), "Multi-edit succeeded");
            // Verify
            const postChecksum = editResult.match(/checksum: (\S+)/)?.[1];
            const verifyResult = verifyChecksums(tmp, [postChecksum]);
            assert.ok(verifyResult.includes("valid=1"), "Multi-edit checksum valid");
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});
