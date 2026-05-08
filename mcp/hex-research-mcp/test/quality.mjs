import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_NAMES } from "../lib/constants.mjs";
import { PACKAGE_ROOT } from "./helpers.mjs";

function readJson(relativePath) {
    return JSON.parse(readFileSync(join(PACKAGE_ROOT, relativePath), "utf8"));
}

describe("quality snapshot artifacts", () => {
    it("manifest and eval report cover exactly the registered tools", () => {
        const manifest = readJson("quality/tool-manifest.json");
        const evalReport = readJson("evals/report.json");
        const manifestNames = manifest.tools.map(tool => tool.name).sort();
        const evalNames = evalReport.results.map(result => result.tool).sort();

        assert.deepEqual(manifestNames, [...TOOL_NAMES].sort());
        assert.deepEqual(evalNames, [...TOOL_NAMES].sort());
        assert.equal(evalReport.scenario_count, TOOL_NAMES.length);
        assert.ok(evalReport.results.every(result => result.structured_mirror));
        assert.ok(evalReport.results.every(result => result.bounded));
    });

    it("quality report and README generated block are in sync", () => {
        const report = readJson("quality/quality-report.json");
        const summary = readFileSync(join(PACKAGE_ROOT, "quality/quality-summary.md"), "utf8").trim();
        const readme = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");

        assert.equal(report.summary.tools_verified, TOOL_NAMES.length);
        assert.equal(report.summary.benchmark_workflows, 5);
        assert.ok(readme.includes("<!-- HEX_RESEARCH_QUALITY_START -->"));
        assert.ok(readme.includes(summary));
        assert.ok(readme.includes("<!-- HEX_RESEARCH_QUALITY_END -->"));
    });

    it("benchmark report is deterministic and clearly rough-estimate only", () => {
        const report = readJson("benchmark/report.json");
        assert.equal(report.workflows.length, 5);
        assert.match(report.methodology, /ceil\(chars \/ 4\)/);
        assert.match(report.methodology, /not production tokenizer accuracy/);
        assert.ok(existsSync(join(PACKAGE_ROOT, "benchmark/report.md")));
    });
});
