#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildManifest, buildRegistry } from "./lib/manifest.mjs";
import { summarizeReport, verifyManifest } from "./lib/verify.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        "project-root": { type: "string", default: process.cwd() },
        output: { type: "string" },
        manifest: { type: "string" },
        files: { type: "string" },
        owners: { type: "string" },
        format: { type: "string", default: "json" }
    }
});

function writeJson(target, data) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function output(data) {
    if (values.format === "text") {
        process.stdout.write(`${typeof data === "string" ? data : JSON.stringify(data, null, 2)}\n`);
        return;
    }
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
    const command = positionals[0];
    const projectRoot = resolve(values["project-root"]);

    if (command === "manifest") {
        const files = values.files ? values.files.split(",").map(item => item.trim()).filter(Boolean) : null;
        const owners = values.owners ? JSON.parse(readFileSync(resolve(values.owners), "utf8")) : {};
        const manifest = buildManifest(projectRoot, files, { owners });
        if (values.output) writeJson(resolve(values.output), manifest);
        output(manifest);
        return;
    }

    if (command === "verify") {
        const manifest = values.manifest
            ? JSON.parse(readFileSync(resolve(values.manifest), "utf8"))
            : buildManifest(projectRoot);
        const report = await verifyManifest(projectRoot, manifest);
        if (values.output) writeJson(resolve(values.output), report);
        output(values.format === "text" ? summarizeReport(report) : report);
        process.exit(report.ok ? 0 : 1);
        return;
    }

    if (command === "summarize") {
        if (!values.manifest) {
            throw new Error("--manifest must point to a report JSON file");
        }
        const report = JSON.parse(readFileSync(resolve(values.manifest), "utf8"));
        output(summarizeReport(report));
        return;
    }

    if (command === "registry") {
        const owners = values.owners ? JSON.parse(readFileSync(resolve(values.owners), "utf8")) : {};
        const manifest = values.manifest
            ? JSON.parse(readFileSync(resolve(values.manifest), "utf8"))
            : buildManifest(projectRoot, null, { owners });
        const registry = buildRegistry(projectRoot, manifest, owners);
        if (values.output) writeJson(resolve(values.output), registry);
        output(registry);
        return;
    }

    throw new Error("Unknown command. Use: manifest, verify, summarize, registry");
}

main().catch(error => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exit(2);
});
