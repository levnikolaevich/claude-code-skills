import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { auditWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const auditWorkerManifestSchema = buildWorkerManifestSchema("audit_identifier", {
    codebase_root: { type: "string" },
    output_dir: { type: "string" },
    report_path: { type: "string" },
    category: { type: "string" },
    scan_path: { type: ["string", "null"] },
    domain_mode: { type: ["string", "null"] },
    current_domain: { type: ["object", "null"] },
    locations: {
        type: "array",
        items: { type: "string" },
    },
    tech_stack: { type: "object" },
    best_practices: { type: "object" },
    principles: { type: "object" },
    metadata: { type: "object" },
});

const auditWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "audit-worker", "runtime"],
    manifestSchema: auditWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const identifier = manifestInput.audit_identifier || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "audit_identifier", identifier),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "audit_worker",
            codebase_root: manifestInput.codebase_root || ".",
            output_dir: manifestInput.output_dir || null,
            report_path: manifestInput.report_path || null,
            category: manifestInput.category || null,
            scan_path: manifestInput.scan_path || null,
            domain_mode: manifestInput.domain_mode || null,
            current_domain: manifestInput.current_domain || null,
            locations: manifestInput.locations || [],
            tech_stack: manifestInput.tech_stack || {},
            best_practices: manifestInput.best_practices || {},
            principles: manifestInput.principles || {},
            metadata: manifestInput.metadata || {},
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            audit_identifier: manifest.audit_identifier,
            codebase_root: manifest.codebase_root,
            output_dir: manifest.output_dir,
            report_path: manifest.report_path,
            summary_kind: "audit-worker",
        });
    },
    summarySchema: auditWorkerSummarySchema,
    summaryLabel: "audit worker summary",
    expectedSummaryKind: "audit-worker",
    buildArtifactFileName(manifest) {
        return `${manifest.skill}--${manifest.identifier}.json`;
    },
});

export const {
    checkpointPhase,
    completeRun,
    loadActiveRun,
    listActiveRuns,
    loadRun,
    pauseRun,
    recordSummary,
    resolveRunId,
    runtimePaths,
    saveState,
    startRun,
    updateState,
    readJsonFile,
} = auditWorkerStore;

