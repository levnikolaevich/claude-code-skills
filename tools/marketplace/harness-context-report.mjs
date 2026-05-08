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

function walkFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
    }
  }
  walk(dir);
  return files.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function listSkills() {
  return walkFiles(PLUGINS_ROOT, (file) => path.basename(file) === "SKILL.md").map((file) => {
    const skill = rel(path.dirname(file));
    const text = readText(file);
    return {
      skill,
      file: rel(file),
      text,
      lines: text.split(/\r?\n/).length,
      mandatoryLines: text.split(/\r?\n/).filter((line) => /MANDATORY READ/i.test(line)),
      skillCalls: (text.match(/\bSkill\(skill:/g) ?? []).length,
      agentCalls: (text.match(/\bAgent\(/g) ?? []).length,
      type: text.match(/\*\*Type:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "unknown",
    };
  });
}

function sourceSize(source) {
  const file = path.join(ROOT, fromPosix(source));
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

function sourceGroup(source) {
  return /^plugins\/[^/]+\/shared\//.test(source) ? "pluginShared" : "rootShared";
}

function categoryFor(entry, row) {
  const source = entry.source.toLowerCase();
  if (row.mentionedBy === 0) return "passive/dead";
  if (source.includes("/test/") || source.includes("verification") || source.includes("ci_tool")) return "test automation";
  if (entry.kind === "script" || source.includes("runtime/cli") || source.includes("runtime_contract")) return "tool/runtime wrapper";
  if (source.includes("agent_review") || source.includes("refinement") || source.includes("agent_delegation")) return "review loop";
  if (source.includes("skill_contract") || source.includes("schema") || source.includes("provider") || source.includes("summary_contract") || source.includes("output_schema") || source.includes("scoring")) return "core contract";
  if (source.includes("meta_analysis") || source.includes("coordinator") || source.includes("orchestrator") || source.includes("workflow") || source.includes("two_layer") || source.includes("mcp_")) return "orchestration harness";
  return row.mandatoryBy > 0 ? "core contract" : "passive/dead";
}

function candidateFor(category, row, entry) {
  if (row.mentionedBy === 0) return "delete-or-localize";
  if (row.mandatoryBy === 0 && row.targets > 2 && entry.kind !== "script") return "localize-or-keep-passive";
  if (category === "orchestration harness" && row.mandatoryBy > 0) return "demote-mandatory";
  if (category === "review loop" && row.mandatoryBy > 0 && row.mandatoryBy < row.targets) return "keep-conditional";
  return "keep";
}

function buildReport() {
  const registry = JSON.parse(readText(REGISTRY_PATH));
  const skills = listSkills();
  const skillText = new Map(skills.map((skill) => [skill.skill, skill.text]));
  const rows = registry.map((entry) => {
    const size = sourceSize(entry.source);
    const mentioned = [];
    const mandatory = [];
    const targets = entry.targets ?? [];
    for (const target of targets) {
      const text = skillText.get(target.skill) ?? "";
      const basename = path.posix.basename(target.path);
      const isMentioned = text.includes(target.path) || text.includes(basename);
      if (isMentioned) mentioned.push(target.skill);
      const mandatoryLines = text.split(/\r?\n/).filter((line) => /MANDATORY READ/i.test(line));
      if (mandatoryLines.some((line) => line.includes(target.path) || line.includes(basename))) mandatory.push(target.skill);
    }
    const row = {
      source: entry.source,
      sourceGroup: sourceGroup(entry.source),
      kind: entry.kind,
      size,
      targets: targets.length,
      mentionedBy: mentioned.length,
      mandatoryBy: mandatory.length,
      replicatedBytes: size * targets.length,
      mandatoryBytes: size * mandatory.length,
      topMandatorySkills: mandatory.slice(0, 8),
    };
    row.category = categoryFor(entry, row);
    row.candidate = candidateFor(row.category, row, entry);
    return row;
  });

  const skillRows = skills.map((skill) => {
    const mandatorySources = rows.filter((row) =>
      row.topMandatorySkills.includes(skill.skill) || skill.mandatoryLines.some((line) => line.includes(path.posix.basename(row.source))),
    );
    const harnessLines = skill.mandatoryLines.filter((line) =>
      /meta_analysis|agent_review|agent_delegation|mcp_tool_preferences|mcp_integration_patterns|two_layer_detection/i.test(line),
    );
    return {
      skill: skill.skill,
      type: skill.type,
      lines: skill.lines,
      mandatoryReads: skill.mandatoryLines.length,
      mandatoryBytes: mandatorySources.reduce((sum, row) => sum + row.size, 0),
      delegationDepth: skill.skillCalls + skill.agentCalls,
      harnessMandatoryReads: harnessLines.length,
      bloatSignals: [
        skill.lines > 500 ? "large-skill" : null,
        skill.mandatoryLines.length >= 8 ? "many-mandatory-reads" : null,
        harnessLines.length >= 3 ? "harness-heavy" : null,
      ].filter(Boolean),
    };
  });

  const categories = rows.reduce((acc, row) => {
    acc[row.category] ??= { sources: 0, replicatedBytes: 0, mandatoryBytes: 0 };
    acc[row.category].sources += 1;
    acc[row.category].replicatedBytes += row.replicatedBytes;
    acc[row.category].mandatoryBytes += row.mandatoryBytes;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      sharedSources: rows.length,
      sharedTargets: rows.reduce((sum, row) => sum + row.targets, 0),
      replicatedBytes: rows.reduce((sum, row) => sum + row.replicatedBytes, 0),
      mandatoryBytes: rows.reduce((sum, row) => sum + row.mandatoryBytes, 0),
      skills: skillRows.length,
    },
    categories,
    sourceGroups: rows.reduce((acc, row) => {
      acc[row.sourceGroup] ??= { sources: 0, targets: 0, replicatedBytes: 0, mandatoryBytes: 0 };
      acc[row.sourceGroup].sources += 1;
      acc[row.sourceGroup].targets += row.targets;
      acc[row.sourceGroup].replicatedBytes += row.replicatedBytes;
      acc[row.sourceGroup].mandatoryBytes += row.mandatoryBytes;
      return acc;
    }, {}),
    sources: rows.sort((a, b) => b.mandatoryBytes - a.mandatoryBytes || b.replicatedBytes - a.replicatedBytes),
    skills: skillRows.sort((a, b) => b.mandatoryBytes - a.mandatoryBytes || b.mandatoryReads - a.mandatoryReads),
  };
}

function parseArgs() {
  return {
    json: process.argv.includes("--json"),
    category: process.argv.find((arg) => arg.startsWith("--category="))?.slice("--category=".length),
    limit: Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 25),
  };
}

function printText(report, args) {
  const sources = args.category ? report.sources.filter((row) => row.category === args.category || row.category.startsWith(`${args.category} `)) : report.sources;
  console.log("Harness context report");
  console.log(JSON.stringify(report.totals, null, 2));
  console.log("");
  console.log("Categories");
  console.log(JSON.stringify(report.categories, null, 2));
  console.log("");
  console.log(`Top sources${args.category ? ` (${args.category})` : ""}`);
  for (const row of sources.slice(0, args.limit)) {
    console.log(`${row.source} | category=${row.category} candidate=${row.candidate} mandatoryBytes=${row.mandatoryBytes} replicated=${row.replicatedBytes}`);
  }
  console.log("");
  console.log("Top skill mandatory load");
  for (const row of report.skills.slice(0, args.limit)) {
    console.log(`${row.skill} | mandatory=${row.mandatoryReads} bytes=${row.mandatoryBytes} delegation=${row.delegationDepth} signals=${row.bloatSignals.join(",") || "none"}`);
  }
}

const args = parseArgs();
const report = buildReport();
if (args.json) {
  const filtered = args.category ? { ...report, sources: report.sources.filter((row) => row.category === args.category || row.category.startsWith(`${args.category} `)) } : report;
  console.log(JSON.stringify(filtered, null, 2));
} else {
  printText(report, args);
}
