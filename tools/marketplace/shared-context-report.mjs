#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const REGISTRY_PATH = path.join(ROOT, "tools/marketplace/shared-registry.json");
const PLUGINS_ROOT = path.join(ROOT, "plugins");

function toPosix(file) {
  return file.split(path.sep).join("/");
}

function fromPosix(file) {
  return file.split("/").join(path.sep);
}

function rel(file) {
  return toPosix(path.relative(ROOT, file));
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  walk(dir);
  return files.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function listSkillDirs() {
  const skills = [];
  for (const plugin of fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const skillsRoot = path.join(PLUGINS_ROOT, plugin.name, "skills");
    if (!fs.existsSync(skillsRoot)) continue;
    for (const skill of fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const skillRoot = path.join(skillsRoot, skill.name);
      if (fs.existsSync(path.join(skillRoot, "SKILL.md"))) skills.push(rel(skillRoot));
    }
  }
  return skills.sort();
}

function fileSize(source) {
  const fullPath = path.join(ROOT, fromPosix(source));
  return fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
}

function loadSkillText(skill) {
  const file = path.join(ROOT, fromPosix(skill), "SKILL.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function parseArgs() {
  return {
    json: process.argv.includes("--json"),
    limit: Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 30),
  };
}

function buildReport() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const skillTexts = new Map(listSkillDirs().map((skill) => [skill, loadSkillText(skill)]));
  const rows = registry.map((entry) => {
    const size = fileSize(entry.source);
    const mentionedBy = [];
    const mandatoryBy = [];
    for (const target of entry.targets ?? []) {
      const text = skillTexts.get(target.skill) ?? "";
      const basename = path.posix.basename(target.path);
      const mentionsTarget = text.includes(target.path) || text.includes(basename);
      if (mentionsTarget) mentionedBy.push(target.skill);
      const mandatoryLines = text.split(/\r?\n/).filter((line) => /MANDATORY READ/i.test(line));
      if (mandatoryLines.some((line) => line.includes(target.path) || line.includes(basename))) mandatoryBy.push(target.skill);
    }
    return {
      source: entry.source,
      kind: entry.kind,
      size,
      targets: entry.targets?.length ?? 0,
      mentionedBy: mentionedBy.length,
      mandatoryBy: mandatoryBy.length,
      replicatedBytes: size * (entry.targets?.length ?? 0),
      topHeavySkills: mandatoryBy.slice(0, 8),
    };
  });
  rows.sort((a, b) => b.replicatedBytes - a.replicatedBytes || b.size - a.size || a.source.localeCompare(b.source));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      registryEntries: rows.length,
      registryTargets: rows.reduce((sum, row) => sum + row.targets, 0),
      sourceBytes: rows.reduce((sum, row) => sum + row.size, 0),
      replicatedBytes: rows.reduce((sum, row) => sum + row.replicatedBytes, 0),
      mandatoryReadBytes: rows.reduce((sum, row) => sum + row.size * row.mandatoryBy, 0),
    },
    rows,
    zeroMention: rows.filter((row) => row.mentionedBy === 0),
    zeroMandatory: rows.filter((row) => row.mandatoryBy === 0),
  };
}

function printText(report, limit) {
  console.log("Shared context report");
  console.log(JSON.stringify(report.totals, null, 2));
  console.log("");
  console.log(`Top replicated sources (limit ${limit})`);
  for (const row of report.rows.slice(0, limit)) {
    console.log(
      `${row.source} | kind=${row.kind} size=${row.size} targets=${row.targets} mentions=${row.mentionedBy} mandatory=${row.mandatoryBy} replicated=${row.replicatedBytes}`,
    );
  }
  console.log("");
  console.log(`Zero mention sources: ${report.zeroMention.length}`);
  console.log(`Zero mandatory sources: ${report.zeroMandatory.length}`);
}

const args = parseArgs();
const report = buildReport();
if (args.json) console.log(JSON.stringify(report, null, 2));
else printText(report, args.limit);
