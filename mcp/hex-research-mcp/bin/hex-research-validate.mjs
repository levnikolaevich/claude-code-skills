#!/usr/bin/env node

import { resolve } from "node:path";
import { STRICT_FAILURE_CODES, verifyProject } from "../lib/indexer.mjs";

function parseArgs(argv) {
    const args = { path: process.cwd(), strict: false, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--path") args.path = argv[++i];
        else if (arg === "--strict") args.strict = true;
        else if (arg === "--json") args.json = true;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else if (!arg.startsWith("-")) args.path = arg;
        else throw new Error(`Unknown argument: ${arg}`);
    }
    return args;
}

function printHelp() {
    console.log(`hex-research-validate

Validate docs/hypotheses, docs/goals, benchmark/runs manifests, and optional docs/sources/lib.yaml.

Usage:
  hex-research-validate --path . [--strict] [--json]

Options:
  --path <dir>  Project root. Defaults to cwd.
  --strict      Exit non-zero for INVALID researchgraph state.
  --json        Print machine-readable JSON.
`);
}

let args;
try {
    args = parseArgs(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(2);
}

if (args.help) {
    printHelp();
    process.exit(0);
}

const result = verifyProject(resolve(args.path));
const strictFailed = result.status === "INVALID" || result.warnings.some(warning => STRICT_FAILURE_CODES.has(warning.code));

if (args.json) {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(`hex-research-validate: ${result.status} hypotheses=${result.summary.hypotheses} goals=${result.summary.goals} runs=${result.summary.runs} warnings=${result.summary.warnings} invalid=${result.summary.invalid}`);
    for (const warning of result.warnings.slice(0, 50)) {
        console.log(`${warning.code}: ${warning.message}`);
    }
    if (result.warnings.length > 50) console.log(`... ${result.warnings.length - 50} more warnings`);
}

process.exit(args.strict && strictFailed ? 1 : 0);
