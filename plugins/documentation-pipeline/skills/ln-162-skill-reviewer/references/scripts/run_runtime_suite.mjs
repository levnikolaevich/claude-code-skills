#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: scriptDir,
    encoding: "utf8",
    shell: false,
});
const repoRoot = gitRoot.status === 0 ? gitRoot.stdout.trim() : resolve(scriptDir, "../../../../..");

const batches = [
    {
        name: "docs+audit",
        dirs: [
            "references/scripts/docs-pipeline-runtime/test",
            "references/scripts/docs-quality/test",
            "references/scripts/docs-runtime/test",
        ],
    },
    {
        name: "planning+story",
        dirs: [
            "references/scripts/epic-planning-runtime/test",
            "references/scripts/planning-worker-runtime/test",
            "references/scripts/scope-decomposition-runtime/test",
            "references/scripts/story-execution-runtime/test",
            "references/scripts/story-gate-runtime/test",
            "references/scripts/story-planning-runtime/test",
            "references/scripts/task-plan-worker-runtime/test",
            "references/scripts/task-planning-runtime/test",
            "references/scripts/task-worker-runtime/test",
            "references/scripts/test-planning-runtime/test",
            "references/scripts/test-planning-worker-runtime/test",
        ],
    },
    {
        name: "env+quality+optimization",
        dirs: [
            "references/agents/test",
            "references/scripts/benchmark-worker-runtime/test",
            "references/scripts/coordinator-runtime/test",
            "references/scripts/dependency-runtime/test",
            "references/scripts/environment-setup-runtime/test",
            "references/scripts/environment-worker-runtime/test",
            "references/scripts/evaluation-runtime/test",
            "references/scripts/evaluation-worker-runtime/test",
            "references/scripts/modernization-runtime/test",
            "references/scripts/optimization-runtime/test",
            "references/scripts/quality-runtime/test",
            "references/scripts/quality-worker-runtime/test",
        ],
    },
    {
        name: "pipeline-orchestrator",
        dirs: [
            "plugins/agile-workflow/skills/ln-1000-pipeline-orchestrator/scripts/test",
        ],
    },
];

function parseArgs(argv) {
    const args = {
        concurrency: Math.max(1, Math.min(4, availableParallelism?.() || 2)),
        timeoutMs: 120000,
        json: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--json") {
            args.json = true;
        } else if (arg === "--concurrency") {
            args.concurrency = Number(argv[index + 1]);
            index += 1;
        } else if (arg === "--timeout-ms") {
            args.timeoutMs = Number(argv[index + 1]);
            index += 1;
        }
    }

    if (!Number.isInteger(args.concurrency) || args.concurrency < 1) {
        throw new Error("--concurrency must be a positive integer");
    }
    if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000) {
        throw new Error("--timeout-ms must be an integer >= 1000");
    }
    return args;
}

function listTests() {
    const tests = [];
    for (const batch of batches) {
        for (const relativeDir of batch.dirs) {
            const dir = join(repoRoot, relativeDir);
            try {
                if (!statSync(dir).isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (!entry.isFile() || !entry.name.endsWith(".mjs") || entry.name.includes("helpers")) {
                    continue;
                }
                tests.push({
                    batch: batch.name,
                    file: join(dir, entry.name),
                    label: `${relativeDir}/${entry.name}`,
                });
            }
        }
    }
    return tests;
}

function runTest(test, timeoutMs) {
    return new Promise((resolveTest) => {
        const startedAt = Date.now();
        const child = spawn(process.execPath, [test.file], {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolveTest({
                ...test,
                ok: code === 0 && !timedOut,
                code,
                signal,
                timedOut,
                durationMs: Date.now() - startedAt,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            });
        });
    });
}

async function runAll(tests, { concurrency, timeoutMs }) {
    const queue = [...tests];
    const results = [];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
            const next = queue.shift();
            results.push(await runTest(next, timeoutMs));
        }
    });
    await Promise.all(workers);
    return results;
}

function summarize(results) {
    const failures = results.filter((result) => !result.ok);
    const byBatch = new Map();
    for (const result of results) {
        const stats = byBatch.get(result.batch) || { total: 0, failed: 0, durationMs: 0 };
        stats.total += 1;
        stats.failed += result.ok ? 0 : 1;
        stats.durationMs += result.durationMs;
        byBatch.set(result.batch, stats);
    }

    return {
        ok: failures.length === 0,
        total: results.length,
        failed: failures.length,
        batches: Object.fromEntries(byBatch),
        failures: failures.map((failure) => ({
            batch: failure.batch,
            file: failure.label,
            timedOut: failure.timedOut,
            code: failure.code,
            signal: failure.signal,
            durationMs: failure.durationMs,
            stderrTail: failure.stderr.split("\n").slice(-20).join("\n"),
            stdoutTail: failure.stdout.split("\n").slice(-20).join("\n"),
        })),
    };
}

const args = parseArgs(process.argv.slice(2));
const tests = listTests();
const results = await runAll(tests, args);
const summary = summarize(results);

if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
    for (const [batch, stats] of Object.entries(summary.batches)) {
        const verdict = stats.failed === 0 ? "PASS" : "FAIL";
        process.stdout.write(`${verdict}: ${batch} (${stats.total - stats.failed}/${stats.total})\n`);
    }
    for (const failure of summary.failures) {
        const reason = failure.timedOut ? `timed out after ${args.timeoutMs}ms` : `exit ${failure.code ?? failure.signal}`;
        process.stderr.write(`FAIL: ${failure.file} (${reason})\n`);
        if (failure.stderrTail) {
            process.stderr.write(`${failure.stderrTail}\n`);
        }
    }
    process.stdout.write(`Runtime suite ${summary.ok ? "PASS" : "FAIL"} (${summary.total - summary.failed}/${summary.total} files)\n`);
}

process.exit(summary.ok ? 0 : 1);
