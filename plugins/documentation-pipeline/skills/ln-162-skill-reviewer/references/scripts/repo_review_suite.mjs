#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: scriptDir,
    encoding: "utf8",
    shell: false,
});
const repoRoot = gitRoot.status === 0 ? gitRoot.stdout.trim() : resolve(scriptDir, "../../../../..");

function parseArgs(argv) {
    const args = {
        runtime: "quick",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--runtime") {
            args.runtime = argv[index + 1];
            index += 1;
        } else if (arg.startsWith("--runtime=")) {
            args.runtime = arg.slice("--runtime=".length);
        } else if (arg === "--skip-runtime") {
            args.runtime = "skip";
        } else if (arg === "--full-runtime") {
            args.runtime = "full";
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!["quick", "full", "skip"].includes(args.runtime)) {
        throw new Error("--runtime must be one of: quick, full, skip");
    }
    return args;
}

function readText(path) {
    return readFileSync(join(repoRoot, path), "utf8");
}

function exists(path) {
    return existsSync(join(repoRoot, path));
}

function listDir(path) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true });
}

function walk(path, predicate = () => true) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) return [];
    const files = [];
    const visit = (current) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = join(current, entry.name);
            const rel = relative(repoRoot, full).replaceAll("\\", "/");
            if (entry.isDirectory()) {
                if (entry.name === ".git" || entry.name === "node_modules") continue;
                if (/^plugins\/[^/]+\/shared(?:\/|$)/.test(rel)) continue;
                visit(full);
            } else if (entry.isFile() && predicate(rel)) {
                files.push(rel);
            }
        }
    };
    if (statSync(absolute).isDirectory()) visit(absolute);
    return files;
}

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        shell: false,
        ...options,
    });
}

function add(results, id, check, result) {
    results.push({ id, check, result });
}

function grepCount(paths, regex, { exclude = () => false } = {}) {
    let count = 0;
    for (const path of paths) {
        if (exclude(path) || !exists(path)) continue;
        const text = readText(path);
        const matches = text.match(regex);
        count += matches ? matches.length : 0;
    }
    return count;
}

function skillDirs() {
    const dirs = [];
    for (const plugin of listDir("plugins").filter((entry) => entry.isDirectory())) {
        const skillsRoot = `plugins/${plugin.name}/skills`;
        for (const entry of listDir(skillsRoot)) {
            if (entry.isDirectory() && /^ln-\d+-/.test(entry.name) && exists(`${skillsRoot}/${entry.name}/SKILL.md`)) {
                dirs.push(`${skillsRoot}/${entry.name}`);
            }
        }
    }
    return dirs.sort();
}

function skillFiles() {
    return skillDirs().map((dir) => `${dir}/SKILL.md`);
}

function docsAndSkillFiles() {
    return [
        ...["AGENTS.md", "README.md"].filter(exists),
        ...walk("docs", (path) => /\.(md|mdx|txt|html)$/.test(path)),
        ...walk("plugins", (path) => /\.(md|json|mjs|sh)$/.test(path)),
        ...walk(".claude/commands", (path) => path.endsWith(".md")),
    ];
}

function referencedSkillNames(paths) {
    const names = new Set();
    for (const path of paths) {
        if (!exists(path)) continue;
        for (const match of readText(path).matchAll(/ln-\d+-[a-z-]+/g)) {
            names.add(match[0]);
        }
    }
    return [...names];
}

function marketplaceSkillPaths() {
    if (!exists(".claude-plugin/marketplace.json")) return [];
    const json = JSON.parse(readText(".claude-plugin/marketplace.json"));
    const paths = [];
    for (const plugin of json.plugins || []) {
        const source = typeof plugin.source === "string" ? plugin.source.replace(/^\.\//, "").replace(/\/$/, "") : "";
        for (const skill of plugin.skills || []) {
            const skillPath = typeof skill === "string" ? skill : skill?.path;
            if (typeof skillPath === "string") {
                const normalized = skillPath.replace(/^\.\//, "");
                paths.push(source ? `${source}/${normalized}` : normalized);
            }
        }
    }
    return paths;
}

function checkMarketplaceCount(pluginName) {
    const result = run(process.execPath, ["plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/check_marketplace.mjs", pluginName]);
    return Number(String(result.stdout || "").trim());
}

function runQuickRuntimeSuite() {
    const quickTests = [
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/coordinator-runtime/test/platform-regression.mjs",
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/coordinator-runtime/test/consistency-scan.mjs",
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/story-planning-runtime/test/smoke.mjs",
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/task-planning-runtime/test/smoke.mjs",
        "plugins/agile-workflow/skills/ln-1000-pipeline-orchestrator/scripts/test/smoke.mjs",
        "plugins/agile-workflow/skills/ln-1000-pipeline-orchestrator/scripts/test/isolation.mjs",
    ];
    const failures = [];
    for (const test of quickTests) {
        const result = run(process.execPath, [test], { timeout: 45000 });
        if (result.status !== 0) {
            failures.push({
                file: test,
                status: result.status,
                detail: (result.stderr || result.stdout || "quick runtime test failed").split("\n").slice(-10).join("\n"),
            });
        }
    }
    return {
        ok: failures.length === 0,
        total: quickTests.length,
        failed: failures.length,
        mode: "quick",
        failures,
    };
}

function runFullRuntimeSuite() {
    const result = run(process.execPath, [
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/run_runtime_suite.mjs",
        "--json",
        "--concurrency",
        "3",
        "--timeout-ms",
        "120000",
    ], { timeout: 600000 });
    if (result.status !== 0) {
        return { ok: false, total: 0, failed: "unknown", detail: result.stderr || result.stdout || "runtime suite failed" };
    }
    return { ...JSON.parse(result.stdout), mode: "full" };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const results = [];
    const skills = skillDirs();
    const skillMd = skillFiles();
    const activeFiles = docsAndSkillFiles();

    const marketplacePaths = marketplaceSkillPaths();
    const r1Missing = marketplacePaths.filter((path) => !exists(path));
    add(results, "R1", "Marketplace paths", r1Missing.length === 0 ? "PASS" : `FAIL (${r1Missing.length} missing dirs)`);

    const rootDocs = ["README.md", "AGENTS.md", ".claude-plugin/marketplace.json"].filter(exists);
    let r2Fails = 0;
    for (const skill of referencedSkillNames(rootDocs)) {
        if (!skills.some((dir) => basename(dir).startsWith(skill))) r2Fails += 1;
    }
    add(results, "R2", "Root docs stale names", r2Fails === 0 ? "PASS" : `FAIL (${r2Fails} stale refs)`);

    const actualCount = skills.length;
    const badge = exists("README.md") ? readText("README.md").match(/skills-(\d+)/)?.[1] : null;
    const r3Fails = (badge && Number(badge) !== actualCount ? 1 : 0) + (marketplacePaths.length !== actualCount ? 1 : 0);
    add(results, "R3", "Skill count accuracy", r3Fails === 0 ? `PASS (${actualCount} skills)` : `FAIL (badge/marketplace mismatch, actual=${actualCount})`);

    const marketplaceSet = new Set(marketplacePaths);
    const r4Fails = skills.filter((dir) => !marketplaceSet.has(dir)).length;
    add(results, "R4", "Plugin completeness", r4Fails === 0 ? "PASS" : `FAIL (${r4Fails} orphan skills)`);

    let r5Warns = 0;
    const downstreamFiles = skillMd.filter((path) => /^plugins\/[^/]+\/skills\/ln-[2345]/.test(path));
    for (const creator of skillMd.filter((path) => /^plugins\/[^/]+\/skills\/ln-11[1-5]-/.test(path))) {
        const outputs = [...new Set([...readText(creator).matchAll(/`([a-zA-Z_]+\.md)`/g)]
            .map((match) => match[1])
            .filter((name) => !/(SKILL|README|CLAUDE|AGENTS|_template)/.test(name)))]
            .sort()
            .slice(0, 5);
        for (const output of outputs) {
            const found = downstreamFiles.some((path) => readText(path).includes(output));
            if (!found) r5Warns += 1;
        }
    }
    add(results, "R5", "Pipeline data-flow", r5Warns === 0 ? "PASS" : `WARN (${r5Warns} possibly orphan outputs)`);

    const unsupportedExcludes = (path) => path.includes("CHANGELOG.md")
        || path.includes("/unsupported/")
        || path.includes("plugins/documentation-pipeline/skills/ln-162-skill-reviewer/")
        || path === ".claude/commands/review-skills.md";
    const unsupportedPlatformPattern = new RegExp(["Agent " + "Teams", "Team" + "Create", "Teammate" + "Idle"].join("|"), "g");
    const r6Fails = grepCount(activeFiles, unsupportedPlatformPattern, { exclude: unsupportedExcludes });
    add(results, "R6", "Unsupported platform API references", r6Fails === 0 ? "PASS" : `FAIL (${r6Fails} active refs)`);

    const r7Fails = grepCount(activeFiles, /tests\/(e2e|integration|unit)/g, { exclude: (path) => path === ".claude/commands/review-skills.md" });
    add(results, "R7", "Automated test root consistency", r7Fails === 0 ? "PASS" : `FAIL (${r7Fails} old test roots)`);

    let r8Fails = 0;
    for (const path of ["plugins/documentation-pipeline/skills/ln-160-docs-skill-extractor/SKILL.md", "plugins/documentation-pipeline/skills/ln-161-skill-creator/SKILL.md"]) {
        const text = exists(path) ? readText(path) : "";
        for (const required of ["markdown_read_protocol", "docs_quality_contract", "procedural_extraction_rules"]) {
            if (!text.includes(required)) r8Fails += 1;
        }
    }
    const creatorText = exists("plugins/documentation-pipeline/skills/ln-161-skill-creator/SKILL.md") ? readText("plugins/documentation-pipeline/skills/ln-161-skill-creator/SKILL.md") : "";
    if (/^\*\*Coordinator:\*\*/m.test(creatorText)) r8Fails += 1;
    if (/^\*\*Parent:\*\*/m.test(creatorText)) r8Fails += 1;
    add(results, "R8", "Docs extraction family alignment", r8Fails === 0 ? "PASS" : `FAIL (${r8Fails} drift issues)`);

    const siteChanged = run("git", ["diff", "--name-only", "HEAD", "--", "site/"]).stdout.trim().length > 0;
    if (siteChanged) {
        let r9Fails = 0;
        for (const page of walk("site/plugins", (path) => path.endsWith(".html"))) {
            const plugin = basename(page, ".html");
            const siteSkills = (readText(page).match(/skill-id">ln-\d+/g) || []).length;
            const marketSkills = checkMarketplaceCount(plugin);
            if (siteSkills > 0 && siteSkills !== marketSkills) r9Fails += 1;
        }
        const auditorCount = skillMd.filter((path) => /^plugins\/[^/]+\/skills\/ln-6/.test(path)).length;
        const siteAuditor = exists("site/index.html") ? readText("site/index.html").match(/(\d+) parallel auditors/)?.[1] : null;
        if (siteAuditor && Number(siteAuditor) !== auditorCount) r9Fails += 1;
        add(results, "R9", "Site fact-check", r9Fails === 0 ? "PASS" : `FAIL (${r9Fails} mismatches)`);
    } else {
        add(results, "R9", "Site fact-check", "SKIP (no site/ changes)");
    }

    const r10Warns = grepCount(walk("site", (path) => path.endsWith(".html")), /\d+ (skills|auditors|parallel auditors)/g);
    add(results, "R10", "Volatile numbers in site", r10Warns === 0 ? "PASS" : `WARN (${r10Warns} found)`);

    const checksDoc = new Set([...readText("plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/automated_checks.md").matchAll(/Check (\d+)/g)].map((match) => match[1]));
    const checksScript = new Set([...readText("plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/run_checks.sh").matchAll(/CHECK (\d+)/g)].map((match) => match[1]));
    const missingChecks = [...checksDoc].filter((check) => !checksScript.has(check));
    add(results, "R11", "Check sync (docs<->script)", missingChecks.length === 0 ? "PASS" : `FAIL (missing in script: ${missingChecks.join(",")})`);

    let r12Fails = 0;
    for (const path of skillMd) {
        const text = readText(path);
        const level = text.match(/\*\*Type:\*\*.*\b(L[12])\b/)?.[1];
        if (!level || /\*\*Type:\*\*.*worker/i.test(text) || text.includes("| None |")) continue;
        const self = basename(dirname(path));
        const workerCount = new Set([...text.matchAll(/ln-\d+-[a-z-]+/g)].map((match) => match[0]).filter((name) => name !== self)).size;
        if (workerCount === 0) continue;
        if (!text.includes("Skill(skill:")) r12Fails += 1;
        if (!text.includes("Worker Invocation (MANDATORY)")) r12Fails += 1;
    }
    add(results, "R12", "Worker invocation (full-repo D8b)", r12Fails === 0 ? "PASS" : `FAIL (${r12Fails} issues)`);

    let r13Fails = 0;
    for (const path of skillMd) {
        const text = readText(path);
        if (!/\*\*Type:\*\*.*L3/.test(text)) continue;
        const selfId = basename(dirname(path)).match(/ln-\d+/)?.[0];
        const hits = text.split(/\r?\n/).filter((line) => /Called by|Invoked by ln-|Caller:|returning control to `ln-|for `ln-\d+`|returned to coordinator|handing control back to `ln-/.test(line));
        if (hits.some((line) => !selfId || !line.includes(`for \`${selfId}\``))) r13Fails += 1;
    }
    add(results, "R13", "Worker independence (no coordinator refs)", r13Fails === 0 ? "PASS" : `FAIL (${r13Fails} worker contracts)`);

    const r14Fails = grepCount([...walk("plugins"), ...["README.md", "AGENTS.md"], ...walk("docs"), ...walk("site")], /\.hex-skills\/(story-execution\/summary|story-gate\/summary|optimization\/\{slug\}\/8(11|12|13|14)-)/g);
    add(results, "R14", "Universal runtime artifacts", r14Fails === 0 ? "PASS" : `FAIL (${r14Fails} coordinator-specific paths)`);

    let r15Fails = 0;
    for (const path of [
        "plugins/setup-environment/skills/ln-011-agent-installer/SKILL.md",
        "plugins/setup-environment/skills/ln-012-mcp-configurator/SKILL.md",
        "plugins/setup-environment/skills/ln-013-config-syncer/SKILL.md",
        "plugins/setup-environment/skills/ln-014-agent-instructions-manager/SKILL.md",
        "plugins/agile-workflow/skills/ln-221-story-creator/SKILL.md",
        "plugins/agile-workflow/skills/ln-222-story-replanner/SKILL.md",
        "plugins/agile-workflow/skills/ln-301-task-creator/SKILL.md",
        "plugins/agile-workflow/skills/ln-302-task-replanner/SKILL.md",
    ]) {
        if (!exists(path)) continue;
        const text = readText(path);
        if (!text.includes("summaryArtifactPath")) r15Fails += 1;
        if (!/standalone/i.test(text)) r15Fails += 1;
    }
    add(results, "R15", "Standalone-first worker contract", r15Fails === 0 ? "PASS" : `FAIL (${r15Fails} missing contract markers)`);

    const r16Fails = grepCount([...walk("plugins"), ...["README.md", "AGENTS.md"], ...walk("docs"), ...walk("site")], /\.hex-skills\/runtime-artifacts\/(?!runs\/)/g, {
        exclude: (path) => path.startsWith("plugins/documentation-pipeline/skills/ln-162-skill-reviewer/") || path === ".claude/commands/review-skills.md",
    });
    add(results, "R16", "Run-scoped artifact paths", r16Fails === 0 ? "PASS" : `FAIL (${r16Fails} non-run-scoped paths)`);

    if (args.runtime === "skip") {
        add(results, "R17", "Runtime test suite", "SKIP (--runtime skip)");
    } else {
        const runtime = args.runtime === "full" ? runFullRuntimeSuite() : runQuickRuntimeSuite();
        const label = args.runtime === "full" ? `Runtime test suite (${runtime.total} files)` : `Quick runtime smoke (${runtime.total} files)`;
        add(results, "R17", label, runtime.ok ? "PASS" : `FAIL (${runtime.failed}/${runtime.total} failed)`);
    }

    let r18Fails = 0;
    if (exists("references/runtime_status_catalog.md") && exists("references/agent_review_workflow.md")) {
        const catalog = new Set([...readText("references/runtime_status_catalog.md").matchAll(/`(CONVERGED|CONVERGED_LOW_IMPACT|MAX_ITER|ERROR|SKIPPED)`/g)].map((match) => match[1]));
        const workflowLines = readText("references/agent_review_workflow.md").split(/\r?\n/).filter((line) => line.includes("exit_reason:"));
        const quotedReasons = workflowLines.at(-1)?.match(/"([^"]+)"/)?.[1] || "";
        const schemaReasons = new Set(quotedReasons.split("|").map((reason) => reason.trim()).filter((reason) => reason && reason !== "SKIPPED"));
        for (const reason of schemaReasons) if (!catalog.has(reason)) r18Fails += 1;
        add(results, "R18", "Exit reason enum sync", r18Fails === 0 ? "PASS" : `FAIL (${r18Fails} reasons in schema but not in catalog)`);
    } else {
        add(results, "R18", "Exit reason enum sync", "SKIP");
    }

    if (exists("references/scripts/review-runtime/cli.mjs") && exists("references/review_runtime_contract.md")) {
        const text = readText("references/scripts/review-runtime/cli.mjs");
        const missing = ["refinement_iterations", "refinement_exit_reason", "refinement_applied"].filter((field) => !text.includes(field)).length;
        add(results, "R19", "Checkpoint payload completeness", missing === 0 ? "PASS" : `FAIL (${missing} missing Phase 6 fields in cli.mjs)`);
    } else {
        add(results, "R19", "Checkpoint payload completeness", "SKIP");
    }

    const missingGuardTests = [];
    for (const runtimeDir of listDir("references/scripts").filter((entry) => entry.isDirectory() && entry.name.endsWith("-runtime")).map((entry) => `references/scripts/${entry.name}`)) {
        if (!exists(`${runtimeDir}/test`) || !exists(`${runtimeDir}/lib/guards.mjs`)) continue;
        const runtimeName = basename(runtimeDir);
        if (/^(coordinator|planning|story-planning|task-planning)-runtime$/.test(runtimeName)) continue;
        const guards = readText(`${runtimeDir}/lib/guards.mjs`);
        if (/validateLinearWorkerTransition|validateCoordinatorTransition/.test(guards)) continue;
        if (!exists(`${runtimeDir}/test/guards.mjs`)) missingGuardTests.push(runtimeName);
    }
    add(results, "R20", "Guard coverage tests", missingGuardTests.length === 0 ? "PASS" : `FAIL (missing: ${missingGuardTests.join(" ")})`);

    const r21Fails = [
        "references/scripts/story-planning-runtime/lib/store.mjs",
        "references/scripts/task-planning-runtime/lib/store.mjs",
        "references/scripts/epic-planning-runtime/lib/store.mjs",
        "references/scripts/docs-pipeline-runtime/lib/store.mjs",
        "references/scripts/scope-decomposition-runtime/lib/store.mjs",
    ].filter((path) => exists(path) && !readText(path).includes("resumablePhases")).length;
    add(results, "R21", "resumablePhases in planning stores", r21Fails === 0 ? "PASS" : `FAIL (${r21Fails} stores missing)`);

    let r22Fails = 0;
    for (const guards of walk("references/scripts", (path) => path.endsWith("-runtime/lib/guards.mjs"))) {
        const text = readText(guards);
        if (!text.includes("DONE")) continue;
        if (/validateLinearWorkerTransition|validateCoordinatorTransition/.test(text)) continue;
        if (!text.includes("final_result")) r22Fails += 1;
    }
    add(results, "R22", "final_result guard on DONE", r22Fails === 0 ? "PASS" : `FAIL (${r22Fails} missing)`);

    const r23Fails = grepCount(activeFiles, /review-runtime|audit-runtime|audit-worker-runtime|review_runtime_contract|audit_runtime_contract|audit_worker_runtime_contract/g, {
        exclude: (path) => path.includes("CHANGELOG.md")
            || path === ".claude/commands/review-skills.md"
            || path === "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/repo_review_suite.mjs",
    });
    add(results, "R23", "No legacy review/audit runtimes", r23Fails === 0 ? "PASS" : `FAIL (${r23Fails} active refs)`);

    let r24Fails = 0;
    if (exists("README.md")) {
        const readmeMatches = readText("README.md").split(/\r?\n/).filter((line) => /(^|[^A-Za-z0-9/])\d+ skills/.test(line) && !line.includes("img.shields.io/badge/skills-"));
        r24Fails += readmeMatches.length;
    }
    r24Fails += grepCount([
        "AGENTS.md",
        ...walk("docs"),
        ...walk("plugins"),
        ...walk(".claude/commands"),
    ], /(^|[^A-Za-z0-9/])\d+ skills|skills-\d+/g, {
        exclude: (path) => path === ".claude/commands/review-skills.md",
    });
    add(results, "R24", "No hardcoded skill counts", r24Fails === 0 ? "PASS" : `FAIL (${r24Fails} count refs outside badge)`);

    const r25Fails = grepCount(skillMd, /MANDATORY READ (per|for|when)|MANDATORY READ: (?!Load )|\*\*MANDATORY READ:\*\* (?!Load )/g);
    add(results, "R25", "Exact MANDATORY READ pattern", r25Fails === 0 ? "PASS" : `FAIL (${r25Fails} nonstandard patterns)`);

    if (exists("mcp/check-output-contracts.mjs")) {
        const result = run(process.execPath, ["mcp/check-output-contracts.mjs"]);
        add(results, "R26", "MCP output contract checker", result.status === 0 ? "PASS" : "FAIL");
    } else {
        add(results, "R26", "MCP output contract checker", "SKIP");
    }

    let r27Fails = 0;
    const navigationText = [
        "AGENTS.md",
        "docs/README.md",
        "README.md",
        "docs/architecture/SKILL_ARCHITECTURE_GUIDE.md",
    ].map((path) => exists(path) ? readText(path) : "").join("\n");
    if (!navigationText.includes("loop_health_contract.md")) r27Fails += 1;
    if (!navigationText.includes("procedural_skill_sop_guide.md")) r27Fails += 1;
    if (!/Loop Health/i.test(exists("docs/plugins/agile-workflow.md") ? readText("docs/plugins/agile-workflow.md") : "")) r27Fails += 1;
    for (const path of [
        "plugins/agile-workflow/skills/ln-1000-pipeline-orchestrator/SKILL.md",
        "plugins/agile-workflow/skills/ln-400-story-executor/SKILL.md",
    ]) {
        const text = exists(path) ? readText(path) : "";
        if (!text.includes("loop_health_contract.md")) r27Fails += 1;
        if (!text.includes("record-loop-health")) r27Fails += 1;
    }
    for (const path of [
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/coordinator-runtime/test/loop-health.mjs",
        "plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/story-execution-runtime/test/loop-health.mjs",
        "plugins/agile-workflow/skills/ln-1000-pipeline-orchestrator/scripts/test/loop-health.mjs",
    ]) {
        if (!exists(path)) r27Fails += 1;
    }
    add(results, "R27", "Loop Health/SOP discoverability", r27Fails === 0 ? "PASS" : `FAIL (${r27Fails} missing refs)`);

    process.stdout.write("\n## Repo-Specific Review -- claude-code-skills\n\n");
    process.stdout.write("| # | Check | Result |\n");
    process.stdout.write("|---|-------|--------|\n");
    for (const row of results) {
        process.stdout.write(`| ${row.id} | ${row.check} | ${row.result} |\n`);
    }
    const failures = results.filter((row) => row.result.includes("FAIL")).length;
    const warnings = results.filter((row) => row.result.includes("WARN")).length;
    process.stdout.write("\n");
    if (failures > 0) {
        process.stdout.write(`Repo verdict: FAIL (${failures} failures, ${warnings} warnings)\n`);
    } else if (warnings > 0) {
        process.stdout.write(`Repo verdict: PASS with WARNINGS (${warnings})\n`);
    } else {
        process.stdout.write("Repo verdict: PASS\n");
    }
    process.exit(failures > 0 ? 1 : 0);
}

main();
