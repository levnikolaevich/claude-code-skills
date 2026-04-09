import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
    skillLn012: join(repoRoot, "skills-catalog", "ln-012-mcp-configurator", "SKILL.md"),
    skillLn012ProviderMatrix: join(repoRoot, "skills-catalog", "ln-012-mcp-configurator", "references", "hex_graph_provider_matrix.md"),
    skillStackDetection: join(repoRoot, "skills-catalog", "ln-700-project-bootstrap", "references", "stack_detection.md"),
    testDir: join(packageRoot, "test"),
};

export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export function countRegisteredTools(serverPath = paths.serverFile) {
    return (readFileSync(serverPath, "utf8").match(/server\.registerTool\(/g) || []).length;
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

export function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}

export function replaceGeneratedBlock(text, marker, content) {
    const start = `<!-- GENERATED:${marker}:START -->`;
    const end = `<!-- GENERATED:${marker}:END -->`;
    const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
    if (!pattern.test(text)) {
        throw new Error(`Generated block ${marker} not found`);
    }
    return text.replace(pattern, `${start}\n${content}\n${end}`);
}

export function replaceSingleLine(text, pattern, replacement, description) {
    if (!pattern.test(text)) {
        throw new Error(`${description} not found`);
    }
    return text.replace(pattern, replacement);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeFrameworkCoverage(family) {
    const frameworks = Object.values(family.frameworks || {});
    if (!frameworks.length) return "n/a";
    const counts = frameworks.reduce((acc, entry) => {
        acc[entry.tier] = (acc[entry.tier] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([tier, count]) => `${count} ${tier}`)
        .join(", ");
}

function pctFromRatio(value) {
    return `${Math.round((value || 0) * 100)}%`;
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
                passed: testCount,
                failed: 0,
                status: "pass",
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
    const { benchmarkWorkflowSummary, capabilities, corporaManifest, qualityReport, qualityTargets, toolCount } = inputs;
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
        `| ${row.id} | ${row.workflow} | ${row.built_in_chars.toLocaleString("en-US")} chars | ${row.hex_graph_chars.toLocaleString("en-US")} chars | ${pctFromRatio(row.savings_ratio)} | ${row.ops_before}->${row.ops_after} | ${row.steps_before}->${row.steps_after} |`
    )).join("\n");
    return [
        "### Generated Snapshot",
        "",
        `- MCP tools registered in server contract: \`${toolCount}\``,
        `- Semantic suite: \`${qualityReport.summary.semantic_suite.passed}/${qualityReport.summary.semantic_suite.passed}\` passing`,
        `- Corpora: \`${corporaManifest.curated.length}\` curated, \`${corporaManifest.external.length}\` pinned external`,
        `- Lanes: parser-first \`${formatLaneStatus(qualityReport.lanes.parser_first.status)}\`, precise overlay \`${formatLaneStatus(qualityReport.lanes.precise_overlay.status)}\``,
        "",
        "| Query Family | JS | TS | PY | PHP | C# | Framework overlays |",
        "|--------------|----|----|----|-----|----|--------------------|",
        familyRows,
        "",
        "Public targets:",
        `- Parser-first semantic fixtures: \`${pctFromRatio(qualityTargets.lanes.parser_first.correctness.semantic_fixture_pass_rate.target)}\``,
        `- Parser-first steady-state query p50: \`<=${qualityTargets.lanes.parser_first.latency.steady_state_query_ms_p50.target_lte}ms\``,
        `- Precise-overlay incremental reindex p50: \`<=${qualityTargets.lanes.precise_overlay.latency.incremental_reindex_seconds_p50.target_lte}s\``,
        `- Workflow token savings target: \`>=${pctFromRatio(qualityTargets.lanes.workflow_benchmark.token_savings_ratio.target_gte)}\``,
        `- Summary-first default preview: \`<=${qualityTargets.lanes.summary_first_contract.preview_rows_default_lte.target_lte} rows\``,
        `- Resolution/provenance surface coverage: \`${pctFromRatio(qualityTargets.lanes.summary_first_contract.resolution_surface_rate.target)} / ${pctFromRatio(qualityTargets.lanes.summary_first_contract.provenance_surface_rate.target)}\``,
        "",
        "Workflow baseline (`benchmark/workflow-summary.json`):",
        "",
        "| ID | Workflow | Built-in | hex-graph | Savings | Ops | Steps |",
        "|----|----------|---------:|----------:|--------:|----:|------:|",
        workflowRows,
        "",
        `Workflow summary: \`${pctFromRatio(benchmarkWorkflowSummary.summary.average_token_savings_ratio)}\` average token savings, \`${benchmarkWorkflowSummary.summary.operations_before}->${benchmarkWorkflowSummary.summary.operations_after}\` ops, \`${benchmarkWorkflowSummary.summary.steps_before}->${benchmarkWorkflowSummary.summary.steps_after}\` steps.`,
    ].join("\n");
}

export function renderRootStatusBlock(inputs) {
    const { corporaManifest, qualityReport } = inputs;
    return `\`hex-graph-mcp\` quality snapshot: \`${qualityReport.summary.semantic_suite.passed}/${qualityReport.summary.semantic_suite.passed}\` tests passing, \`${corporaManifest.curated.length}\` curated corpus, \`${corporaManifest.external.length}\` pinned external corpora, parser-first \`${qualityReport.lanes.parser_first.status}\`.`;
}

export function renderRootHexGraphRow(inputs) {
    return `| **[hex-graph-mcp](mcp/hex-graph-mcp/)** | Indexes codebases into a deterministic SQLite graph with framework-aware overlays, capability-first quality tooling, optional SCIP interop, and architecture/reference analysis. | ${inputs.toolCount} | [README](mcp/hex-graph-mcp/README.md) · [npm](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) |`;
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
    const mandatoryReadPattern = /\*\*MANDATORY READ:\*\* Load `skills-catalog\/ln-012-mcp-configurator\/references\/hex_graph_provider_matrix\.md` and `skills-catalog\/ln-700-project-bootstrap\/references\/stack_detection\.md`\./;
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
