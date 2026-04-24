#!/usr/bin/env node
/**
 * hex-ssh-mcp normalization diagnostic.
 *
 * Pure-function diagnostic: no SSH connection needed.
 * Generates synthetic data simulating real SSH command outputs.
 *
 * Run: node benchmark.mjs
 */

import { deduplicateLines, smartTruncate, normalizeOutput } from "@levnikolaevich/hex-common/output/normalize";
import { fnv1a, lineTag } from "@levnikolaevich/hex-common/text-protocol/hash";

// ---- Helpers ----

function fmt(n) {
    return n.toLocaleString("en-US");
}

function formatLine(lineNum, content) {
    const tag = lineTag(fnv1a(content));
    return `${tag}.${lineNum}\t${content}`;
}

function savings(input, output) {
    if (input === 0) return "0%";
    const pct = ((input - output) / input * 100);
    return `${pct >= 0 ? "" : ""}${pct.toFixed(0)}%`;
}

// ---- Synthetic Data Generators ----

function generateCodeLines(count) {
    const templates = [
        "import { resolve } from \"node:path\";",
        "import { readFileSync, writeFileSync } from \"node:fs\";",
        "const config = loadConfig(process.env.NODE_ENV);",
        "export function processRequest(req, res) {",
        "    const data = JSON.parse(req.body);",
        "    if (!data.id || !data.name) {",
        "        return res.status(400).json({ error: \"Missing fields\" });",
        "    }",
        "    const result = await db.query(\"SELECT * FROM users WHERE id = $1\", [data.id]);",
        "    logger.info(\"Request processed\", { userId: data.id, duration: Date.now() - start });",
        "    return res.json({ success: true, data: result.rows });",
        "}",
        "",
        "// Handle edge cases for Unicode normalization",
        "function normalizeInput(str) {",
        "    return str.trim().replace(/\\s+/g, \" \");",
        "}",
        "const MAX_RETRIES = 3;",
        "const TIMEOUT_MS = 30000;",
        "export default { processRequest, normalizeInput };",
    ];
    const lines = [];
    for (let i = 0; i < count; i++) {
        lines.push(templates[i % templates.length]);
    }
    return lines;
}

function generateNpmInstallLog(count) {
    const lines = [];
    const pkgs = ["express", "lodash", "axios", "dotenv", "cors", "helmet", "morgan", "compression"];
    for (let i = 0; i < count; i++) {
        const r = i % 10;
        if (r < 3) {
            // Repeated "added" lines with different versions
            const pkg = pkgs[i % pkgs.length];
            lines.push(`npm warn unsupported ${pkg}@${1 + (i % 5)}.${i % 10}.${i % 3}: use newer version`);
        } else if (r < 5) {
            // Timestamp + UUID lines
            const uuid = `${hex8()}-${hex4()}-${hex4()}-${hex4()}-${hex12()}`;
            lines.push(`${ts()} info lifecycle ${uuid} ~ install: running postinstall`);
        } else if (r < 7) {
            // Repeated progress lines
            lines.push(`npm http fetch GET 200 https://registry.npmjs.org/${pkgs[i % pkgs.length]} ${100 + i}ms`);
        } else {
            // Generic repeated lines
            lines.push(`added ${10 + (i % 5)} packages in ${1 + (i % 3)}s`);
        }
    }
    return lines;
}

function generateServerLogs(count) {
    const lines = [];
    const methods = ["GET", "POST", "PUT", "DELETE"];
    const paths = ["/api/users", "/api/orders", "/health", "/api/products", "/api/auth/login"];
    const statuses = [200, 200, 200, 201, 304, 404, 500];
    for (let i = 0; i < count; i++) {
        const r = i % 8;
        if (r < 4) {
            // HTTP access log with IP, timestamp
            const ip = `192.168.${1 + (i % 3)}.${10 + (i % 50)}`;
            const method = methods[i % methods.length];
            const path = paths[i % paths.length];
            const status = statuses[i % statuses.length];
            lines.push(`${ts()} ${ip} ${method} ${path} ${status} ${10 + (i % 200)}ms`);
        } else if (r < 6) {
            // Trace ID lines (repeated pattern)
            lines.push(`${ts()} trace_id=${hex8()} span_id=${hex8()} level=info msg="request processed"`);
        } else {
            // Repeated status/health lines
            lines.push(`${ts()} 10.0.0.${1 + (i % 5)}:${8080 + (i % 3)} health check passed`);
        }
    }
    return lines;
}

function generateGrepResults(count) {
    const files = ["src/server.js", "src/routes.js", "src/middleware.js", "lib/utils.js", "lib/db.js"];
    const patterns = [
        "const app = express();",
        "router.get(\"/api/users\", getUsers);",
        "module.exports = { connectDB };",
        "if (!token) return res.status(401).json({ error: \"Unauthorized\" });",
        "logger.info(\"Server started on port \" + PORT);",
    ];
    const lines = [];
    for (let i = 0; i < count; i++) {
        const file = files[i % files.length];
        const lineNum = 10 + (i % 50);
        const content = patterns[i % patterns.length];
        lines.push(`${file}:${lineNum}:${content}`);
    }
    return lines;
}

function generateLargeOutput(count) {
    const lines = [];
    for (let i = 0; i < count; i++) {
        const r = i % 6;
        if (r < 2) {
            lines.push(`Step ${i + 1}/${count}: Processing batch ${hex8()} at ${ts()}`);
        } else if (r < 4) {
            lines.push(`  -> Completed ${1000 + i * 10} records (${(i / count * 100).toFixed(1)}%)`);
        } else {
            lines.push(`  [OK] Worker ${1 + (i % 4)} finished chunk ${i}`);
        }
    }
    return lines;
}

// Random-ish hex generators (deterministic for reproducibility)
let _seed = 42;
function nextSeed() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed; }
function hex4() { return (nextSeed() & 0xffff).toString(16).padStart(4, "0"); }
function hex8() { return (nextSeed() & 0xffffffff).toString(16).padStart(8, "0"); }
function hex12() { return hex8() + hex4(); }
function ts() { return `2026-03-22 ${10 + (nextSeed() % 14)}:${(nextSeed() % 60).toString().padStart(2, "0")}:${(nextSeed() % 60).toString().padStart(2, "0")}`; }

// ---- Scenarios ----

const scenarios = [
    {
        name: "Hash annotation overhead",
        run() {
            const lines = generateCodeLines(100);
            const raw = lines.join("\n");
            const annotated = lines.map((l, i) => formatLine(i + 1, l)).join("\n");
            return { input: raw.length, output: annotated.length };
        },
    },
    {
        name: "Normalize: npm install",
        run() {
            const lines = generateNpmInstallLog(200);
            const raw = lines.join("\n");
            const result = normalizeOutput(raw, { headLines: 40, tailLines: 20 });
            return { input: raw.length, output: result.length };
        },
    },
    {
        name: "Normalize: server logs",
        run() {
            const lines = generateServerLogs(300);
            const raw = lines.join("\n");
            const result = normalizeOutput(raw, { headLines: 40, tailLines: 20 });
            return { input: raw.length, output: result.length };
        },
    },
    {
        name: "Dedup: grep results",
        run() {
            const lines = generateGrepResults(100);
            const deduped = deduplicateLines(lines);
            return { input: lines.join("\n").length, output: deduped.join("\n").length };
        },
    },
    {
        name: "Smart truncate: large output",
        run() {
            const lines = generateLargeOutput(500);
            const raw = lines.join("\n");
            const result = smartTruncate(raw, 40, 20);
            return { input: raw.length, output: result.length };
        },
    },
];

// ---- Main ----

console.log("=== hex-ssh-mcp normalization diagnostic ===\n");

const header = "| # | Scenario                    | Input      | Output     | Savings |";
const sep =    "|---|-----------------------------|-----------:|-----------:|--------:|";
console.log(header);
console.log(sep);

let totalInput = 0, totalOutput = 0;

for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const { input, output } = s.run();
    totalInput += input;
    totalOutput += output;

    const name = s.name.padEnd(27);
    const inputStr = (fmt(input) + " ch").padStart(10);
    const outputStr = (fmt(output) + " ch").padStart(10);
    const savingsStr = savings(input, output).padStart(7);
    console.log(`| ${i + 1} | ${name} | ${inputStr} | ${outputStr} | ${savingsStr} |`);
}

console.log(sep);
console.log(`\nAverage savings: ${savings(totalInput, totalOutput)} (${fmt(totalInput)} ch -> ${fmt(totalOutput)} ch)`);
console.log("Note: this script measures normalization/dedup/truncation efficiency only. It is not a comparative workflow benchmark against built-in tools.");
