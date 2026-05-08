#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    README_PATH,
    QUALITY_SUMMARY_PATH,
    compareOrWrite,
} from "./quality-lib.mjs";

const check = process.argv.includes("--check");
const start = "<!-- HEX_RESEARCH_QUALITY_START -->";
const end = "<!-- HEX_RESEARCH_QUALITY_END -->";

const readme = readFileSync(README_PATH, "utf8");
const summary = readFileSync(QUALITY_SUMMARY_PATH, "utf8").trim();
const block = `${start}\n${summary}\n${end}`;

let next;
if (readme.includes(start) || readme.includes(end)) {
    const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
    assert.ok(pattern.test(readme), "README quality markers are incomplete");
    next = readme.replace(pattern, block);
} else {
    const anchor = "\n## Goal-Directed Workflow";
    assert.ok(readme.includes(anchor), "README missing Goal-Directed Workflow anchor");
    next = readme.replace(anchor, `\n${block}\n${anchor}`);
}

compareOrWrite(README_PATH, next, { check });
console.log("quality docs: README quality block is in sync");
