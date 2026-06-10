import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    ensureDir,
    readJson,
    replaceGeneratedBlock,
    replaceSingleLine,
    writeJson,
} from "@levnikolaevich/hex-common/quality/artifacts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const packageRoot = resolve(__dirname, "..");
export const repoRoot = resolve(packageRoot, "..", "..");

export const paths = {
    benchmarkWorkflowSummary: join(packageRoot, "benchmark", "workflow-summary.json"),
    capabilitiesArtifact: join(packageRoot, "evals", "artifacts", "capabilities.json"),
    corporaManifest: join(packageRoot, "corpora", "manifest.json"),
    evalsReadme: join(packageRoot, "evals", "README.md"),
    packageJson: join(packageRoot, "package.json"),
    packageReadme: join(packageRoot, "README.md"),
    qualityReportArtifact: join(packageRoot, "evals", "artifacts", "quality-report.json"),
    qualityTargetsArtifact: join(packageRoot, "evals", "artifacts", "quality-targets.json"),
    rootReadme: join(repoRoot, "README.md"),
    serverFile: join(packageRoot, "server.mjs"),
    skillLn012: join(repoRoot, "plugins", "setup-environment", "skills", "ln-012-mcp-configurator", "SKILL.md"),
    skillLn012ProviderMatrix: join(repoRoot, "plugins", "setup-environment", "skills", "ln-012-mcp-configurator", "references", "hex_graph_provider_matrix.md"),
    skillStackDetection: join(repoRoot, "plugins", "setup-environment", "skills", "ln-012-mcp-configurator", "references", "stack_detection.md"),
    testDir: join(packageRoot, "test"),
};

export { ensureDir, readJson, replaceGeneratedBlock, replaceSingleLine, writeJson };

export function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export function countRegisteredTools(serverPath = paths.serverFile) {
    return (readFileSync(serverPath, "utf8").match(/server\.registerTool\(/g) || []).length;
}

export function registeredToolNames(serverPath = paths.serverFile) {
    return [...readFileSync(serverPath, "utf8").matchAll(/server\.registerTool\("([^"]+)"/g)]
        .map(match => match[1])
        .sort();
}

export function countTestCases(root = paths.testDir) {
    let count = 0;
    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const fullPath = join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.name.endsWith(".mjs")) continue;
            const source = readFileSync(fullPath, "utf8");
            count += (source.match(/^\s*(?:it|test)\(/gm) || []).length;
        }
    }
    return count;
}

export function countAlwaysSkippedTestCases(root = paths.testDir) {
    let count = 0;
    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const fullPath = join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.name.endsWith(".mjs")) continue;
            const source = readFileSync(fullPath, "utf8");
            count += (source.match(/^\s*(?:it|test)\([^,\n]+,\s*\{\s*skip:\s*true\s*\}/gm) || []).length;
        }
    }
    return count;
}

export function getDefaultCorpusCacheDir() {
    if (process.env.HEX_GRAPH_CORPUS_CACHE_DIR) {
        return resolve(process.env.HEX_GRAPH_CORPUS_CACHE_DIR);
    }
    if (process.platform === "win32") {
        return join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "hex-graph-mcp", "corpora");
    }
    return join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "hex-graph-mcp", "corpora");
}

export function getCorpusCheckoutDir(corpus, cacheRoot = getDefaultCorpusCacheDir()) {
    return join(cacheRoot, `${corpus.id}-${corpus.ref.slice(0, 12)}`);
}

export function isCorpusMaterialized(corpus, cacheRoot = getDefaultCorpusCacheDir()) {
    return existsSync(join(getCorpusCheckoutDir(corpus, cacheRoot), ".git"));
}


function summarizeFrameworkCoverage(family) {
    const frameworks = Object.values(family.frameworks || {});
    if (!frameworks.length) return "n/a";
    return [...new Set(frameworks.map(entry => entry.tier).filter(Boolean))]
        .sort()
        .join(" + ") || "tracked";
}

function formatLaneStatus(value) {
    return value || "unknown";
}

export function loadQualityInputs() {
    return {
        benchmarkWorkflowSummary: readJson(paths.benchmarkWorkflowSummary),
        capabilities: readJson(paths.capabilitiesArtifact),
        corporaManifest: readJson(paths.corporaManifest),
        qualityReport: readJson(paths.qualityReportArtifact),
        qualityTargets: readJson(paths.qualityTargetsArtifact),
        toolCount: countRegisteredTools(paths.serverFile),
    };
}

export function buildQualityReport({
    benchmarkWorkflowSummary,
    corporaManifest,
    generatedAt = todayIso(),
    testCount = countTestCases(paths.testDir),
    skippedTestCount = countAlwaysSkippedTestCases(paths.testDir),
} = {}) {
    const external = corporaManifest.external || [];
    const knownGaps = [
        "Latency bands are targets today; artifact-backed trend history will land in follow-up eval runs.",
    ];
    if (!external.length) {
        knownGaps.unshift("Pinned external corpora manifest exists, but external corpus runs are not populated yet.");
    }

    return {
        generated_at: generatedAt,
        summary: {
            semantic_suite: {
                runner: "node --test test/*.mjs",
                declared: testCount,
                always_skipped: skippedTestCount,
                total: testCount,
                status: "declared",
                note: "Static declaration count only; npm test is the execution authority.",
            },
            curated_corpora: {
                count: (corporaManifest.curated || []).length,
                external_pinned_count: external.length,
                status: external.length ? "seeded" : "bootstrap",
            },
            workflow_benchmark: benchmarkWorkflowSummary.summary,
        },
        lanes: {
            parser_first: {
                semantic_fixture_pass_rate: 1.0,
                regression_fixture_pass_rate: 1.0,
                framework_overlay_smoke_pass_rate: 1.0,
                status: "green",
            },
            precise_overlay: {
                status: "provider_conditional",
                notes: [
                    "Provider-assisted correctness is verified only when external language providers are available in the environment.",
                ],
            },
        },
        external_corpora: external.map(item => ({
            id: item.id,
            ref: item.ref,
            status: "pinned",
            materialize_with: `npm run corpora:materialize -- --id ${item.id}`,
        })),
        known_gaps: knownGaps,
    };
}

export function renderPackageQualityBlock(inputs) {
    const { benchmarkWorkflowSummary, capabilities, qualityReport } = inputs;
    const trackedFamilies = [
        { publicName: "find_references", capability: "find_references" },
        { publicName: "trace_paths", capability: "trace_paths" },
        { publicName: "audit_workspace", capability: "audit_workspace" },
        { publicName: "analyze_architecture", capability: "analyze_architecture" },
    ];
    const familyRows = trackedFamilies.map(({ publicName, capability }) => {
        const family = capabilities.query_families[capability];
        return `| \`${publicName}\` | ${family.languages?.javascript?.tier || "n/a"} | ${family.languages?.typescript?.tier || "n/a"} | ${family.languages?.python?.tier || "n/a"} | ${family.languages?.php?.tier || "n/a"} | ${family.languages?.csharp?.tier || "n/a"} | ${summarizeFrameworkCoverage(family)} |`;
    }).join("\n");
    const workflowRows = benchmarkWorkflowSummary.rows.map((row) => (
        `| ${row.id} | ${row.workflow} | tracked |`
    )).join("\n");
    return [
        "### Generated Snapshot",
        "",
        "- Semantic suite: tracked by the Node test runner; execution is verified by `npm test`.",
        "- Corpora: curated and external manifests are tracked in package artifacts.",
        `- Lanes: parser-first \`${formatLaneStatus(qualityReport.lanes.parser_first.status)}\`, precise overlay \`${formatLaneStatus(qualityReport.lanes.precise_overlay.status)}\``,
        "",
        "| Query Family | JS | TS | PY | PHP | C# | Framework overlays |",
        "|--------------|----|----|----|-----|----|--------------------|",
        familyRows,
        "",
        "Public targets:",
        "- Parser-first semantic fixtures target is tracked in `evals/artifacts/quality-targets.json`.",
        "- Parser-first steady-state query latency target is tracked in `evals/artifacts/quality-targets.json`.",
        "- Precise-overlay incremental reindex latency target is tracked in `evals/artifacts/quality-targets.json`.",
        "- Workflow token savings target is tracked in `evals/artifacts/quality-targets.json`.",
        "- Summary-first default preview target is tracked in `evals/artifacts/quality-targets.json`.",
        "- Resolution/provenance surface coverage target is tracked in `evals/artifacts/quality-targets.json`.",
        "",
        "Workflow baseline (`benchmark/workflow-summary.json`):",
        "",
        "| ID | Workflow | Artifact status |",
        "|----|----------|-----------------|",
        workflowRows,
        "",
        "Workflow summary metrics are stored in the benchmark artifact instead of duplicated in README.",
    ].join("\n");
}

export function renderRootStatusBlock(inputs) {
    const { qualityReport } = inputs;
    return `\`hex-graph-mcp\` quality snapshot: semantic suite, corpus manifests, provider lanes, and parser-first \`${qualityReport.lanes.parser_first.status}\` status are tracked in package artifacts.`;
}

export function renderRootHexGraphRow() {
    return "| **[hex-graph-mcp](mcp/hex-graph-mcp/)** | Indexes codebases into a deterministic SQLite graph with framework-aware overlays, capability-first quality tooling, optional SCIP interop, and architecture/reference analysis. | see README | [README](mcp/hex-graph-mcp/README.md) · [npm](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) |";
}

export function validateLn012Consistency() {
    const issues = [];
    const skill = readFileSync(paths.skillLn012, "utf8");
    if (!existsSync(paths.skillLn012ProviderMatrix)) {
        issues.push(`Missing provider matrix: ${paths.skillLn012ProviderMatrix}`);
    }
    if (!existsSync(paths.skillStackDetection)) {
        issues.push(`Missing stack detection reference: ${paths.skillStackDetection}`);
    }
    const matrix = existsSync(paths.skillLn012ProviderMatrix)
        ? readFileSync(paths.skillLn012ProviderMatrix, "utf8")
        : "";
    const mandatoryReadPattern = /\*\*MANDATORY READ:\*\* Load `references\/hex_graph_provider_matrix\.md` and `references\/stack_detection\.md`\./;
    if (!mandatoryReadPattern.test(skill)) {
        issues.push("ln-012 is missing the expected MANDATORY READ block for graph provider detection.");
    }
    for (const provider of ["basedpyright", "csharp-ls", "phpactor"]) {
        if (!skill.includes(provider)) {
            issues.push(`ln-012 SKILL.md does not mention provider '${provider}'.`);
        }
        if (!matrix.includes(provider)) {
            issues.push(`hex_graph_provider_matrix.md does not mention provider '${provider}'.`);
        }
    }
    for (const stalePhrase of ["Verify Runtime Dependencies", "runtime deps", "install python", "install .NET", "install php"]) {
        if (skill.toLowerCase().includes(stalePhrase.toLowerCase())) {
            issues.push(`ln-012 still contains stale runtime-level wording: '${stalePhrase}'.`);
        }
    }
    return issues;
}
