import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyFixture, cleanup } from "./helpers.mjs";
import { exportCanvas, exportResearchMap, indexHypotheses } from "../lib/tools.mjs";

describe("canvas export", () => {
    it("supports dry-run, merge position preservation, and overwrite", () => {
        const dir = copyFixture("canvas");
        try {
            indexHypotheses({ path: dir });
            const dry = exportCanvas({ path: dir, dry_run: true });
            assert.equal(dry.status, "OK");
            assert.ok(dry.canvas.nodes.some(n => n.id === "H01"));

            const canvasPath = join(dir, "docs", "research-map.canvas");
            writeFileSync(canvasPath, JSON.stringify({ nodes: [{ id: "H01", type: "text", text: "old", x: 999, y: 888, width: 111, height: 99 }], edges: [] }));
            const merged = exportCanvas({ path: dir, mode: "merge" });
            assert.equal(merged.status, "CHANGED");
            const mergedJson = JSON.parse(readFileSync(canvasPath, "utf8"));
            const h01 = mergedJson.nodes.find(n => n.id === "H01");
            assert.equal(h01.x, 999);
            assert.equal(h01.y, 888);

            exportCanvas({ path: dir, mode: "overwrite" });
            const overwritten = JSON.parse(readFileSync(canvasPath, "utf8"));
            assert.notEqual(overwritten.nodes.find(n => n.id === "H01").x, 999);
            assert.equal(existsSync(canvasPath), true);
        } finally {
            cleanup(dir);
        }
    });

    it("exports generated research-map markdown with legacy overwrite guard", () => {
        const dir = copyFixture("research-map");
        try {
            indexHypotheses({ path: dir });
            const dry = exportResearchMap({ path: dir });
            assert.equal(dry.status, "OK");
            assert.match(dry.markdown, /HEX_RESEARCH_GENERATED/);
            assert.match(dry.markdown, /## Hypotheses/);

            const mapPath = join(dir, "docs", "research-map.md");
            writeFileSync(mapPath, "# Legacy\n", "utf8");
            const refused = exportResearchMap({ path: dir, dry_run: false });
            assert.equal(refused.status, "UNSUPPORTED");

            const written = exportResearchMap({ path: dir, dry_run: false, force: true });
            assert.equal(written.status, "CHANGED");
            assert.match(readFileSync(mapPath, "utf8"), /HEX_RESEARCH_GENERATED/);
        } finally {
            cleanup(dir);
        }
    });
});
