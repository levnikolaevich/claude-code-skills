#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import {
    loadQualityInputs,
    paths,
    renderPackageQualityBlock,
    renderRootHexGraphRow,
    renderRootStatusBlock,
    replaceGeneratedBlock,
    replaceSingleLine,
} from "./quality-support.mjs";

function normalize(text) {
    return text.replace(/\r\n/g, "\n");
}

function sync(checkOnly = false) {
    const inputs = loadQualityInputs();

    const packageReadme = readFileSync(paths.packageReadme, "utf8");
    const packageReadmeWithoutLegacyBenchmark = packageReadme.replace(
        /Current sample run on the `hex-graph-mcp` repo with session-derived workflows:[\s\S]*?Workflow summary: .*?\r?\n\r?\n(?=The workflow benchmark focuses)/,
        "",
    );
    const nextPackageReadme = replaceGeneratedBlock(
        replaceSingleLine(packageReadmeWithoutLegacyBenchmark, /### (?:\d+ )?MCP Tools/, "### MCP Tools", "package README tool heading"),
        "HEX_GRAPH_MCP_QUALITY",
        renderPackageQualityBlock(inputs),
    );

    const rootReadme = readFileSync(paths.rootReadme, "utf8");
    const nextRootReadme = replaceGeneratedBlock(
        replaceSingleLine(
            rootReadme,
            /^\| \*\*\[hex-graph-mcp\]\(mcp\/hex-graph-mcp\/\)\*\* \| .*$/m,
            renderRootHexGraphRow(inputs),
            "root README hex-graph row",
        ),
        "HEX_GRAPH_MCP_STATUS",
        renderRootStatusBlock(inputs),
    );

    if (checkOnly) {
        if (normalize(packageReadme) !== normalize(nextPackageReadme) || normalize(rootReadme) !== normalize(nextRootReadme)) {
            console.error("Quality docs are stale. Run npm run docs:quality.");
            process.exitCode = 1;
        }
        return;
    }

    writeFileSync(paths.packageReadme, nextPackageReadme, "utf8");
    writeFileSync(paths.rootReadme, nextRootReadme, "utf8");
}

sync(process.argv.includes("--check"));
