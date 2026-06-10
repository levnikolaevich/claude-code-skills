import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    buildQualityReport,
    loadQualityInputs,
    registeredToolNames,
    renderPackageQualityBlock,
    validateLn012Consistency,
} from "../scripts/quality-support.mjs";

const EXPECTED_PUBLIC_TOOLS = [
    "analyze_architecture",
    "analyze_changes",
    "analyze_edit_region",
    "api_impact",
    "audit_workspace",
    "diagnose_graph",
    "export_scip",
    "find_implementations",
    "find_references",
    "find_symbols",
    "import_scip_overlay",
    "index_project",
    "inspect_symbol",
    "install_graph_providers",
    "trace_dataflow",
    "trace_paths",
].sort();

describe("quality tooling", () => {
    it("builds quality report from current manifest and workflow summary", () => {
        const inputs = loadQualityInputs();
        const report = buildQualityReport({
            benchmarkWorkflowSummary: inputs.benchmarkWorkflowSummary,
            corporaManifest: inputs.corporaManifest,
        });

        assert.ok(report.summary.semantic_suite.declared >= 1);
        assert.equal(report.summary.semantic_suite.failed, undefined);
        assert.equal(report.summary.semantic_suite.status, "declared");
        assert.equal(report.summary.curated_corpora.external_pinned_count, inputs.corporaManifest.external.length);
        assert.equal(report.summary.workflow_benchmark.operations_after, inputs.benchmarkWorkflowSummary.summary.operations_after);
    });

    it("renders package quality block from artifacts", () => {
        const block = renderPackageQualityBlock(loadQualityInputs());
        assert.ok(block.includes("### Generated Snapshot"));
        assert.ok(block.includes("analyze_architecture"));
        assert.ok(block.includes("Workflow baseline"));
        assert.ok(block.includes("Summary-first default preview"));
    });

    it("keeps ln-012 provider contract aligned with its reference", () => {
        assert.deepEqual(validateLn012Consistency(), []);
        assert.deepEqual(registeredToolNames(), EXPECTED_PUBLIC_TOOLS);
    });
});
