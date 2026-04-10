import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { environmentWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const environmentWorkerManifestSchema = buildWorkerManifestSchema("work_item_id", {
    targets: {
        type: "array",
        items: { type: "string" },
    },
    dry_run: { type: "boolean" },
    apply_ide_override: { type: "boolean" },
});

function expectedSummaryKindForSkill(skill) {
    if (skill === "ln-011") return "env-agent-install";
    if (skill === "ln-012") return "env-mcp-config";
    if (skill === "ln-013") return "env-config-sync";
    if (skill === "ln-014") return "env-instructions";
    if (skill === "ln-015") return "env-cleanup";
    throw new Error(`Unsupported environment worker skill: ${skill}`);
}

const environmentWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "environment-worker", "runtime"],
    manifestSchema: environmentWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const targets = Array.isArray(manifestInput.targets) && manifestInput.targets.length > 0
            ? manifestInput.targets
            : [];
        const identifier = manifestInput.identifier
            || (targets.length > 0 ? `targets-${targets.join("-")}` : `${manifestInput.skill}-global`);
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "work_item_id", identifier),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "environment_worker",
            targets,
            dry_run: manifestInput.dry_run === true,
            apply_ide_override: manifestInput.apply_ide_override === true,
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            targets: manifest.targets || [],
            summary_kind: expectedSummaryKindForSkill(manifest.skill),
        });
    },
    summarySchema: environmentWorkerSummarySchema,
    summaryLabel: "environment worker summary",
    expectedSummaryKind(manifest) {
        return expectedSummaryKindForSkill(manifest.skill);
    },
    buildArtifactFileName(manifest) {
        return `${manifest.skill}--${manifest.identifier}.json`;
    },
    validateSummary(manifest, summary) {
        const expectedSummaryKind = expectedSummaryKindForSkill(manifest.skill);
        if (summary.summary_kind !== expectedSummaryKind) {
            return { ok: false, error: `Worker summary kind must be ${expectedSummaryKind}` };
        }
        return { ok: true };
    },
    reduceState(state, summary) {
        return {
            ...state,
            summary_kind: summary.summary_kind,
        };
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
} = environmentWorkerStore;
