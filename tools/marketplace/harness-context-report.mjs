#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildExtendedRegistry } from "./shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const REGISTRY_PATH = path.join(ROOT, "tools/marketplace/shared-registry.json");
const PLUGINS_ROOT = path.join(ROOT, "plugins");
const MARKER_PATTERN = /SOURCE-OF-TRUTH:\s+((?:shared|plugins\/[^/]+\/shared)\/\S+?)\.\s/;

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

function readHead(file, lines = 8) {
  return readText(file).split(/\r?\n/).slice(0, lines).join("\n");
}

function markerSource(file) {
  const markerFile = file.endsWith(".json") ? `${file}.SOURCE.md` : file;
  const match = readHead(markerFile).match(MARKER_PATTERN);
  return match?.[1] ?? null;
}

function markerMatchesSource(marker, source) {
  return marker === source || (source.endsWith(".json.SOURCE.md") && marker === source.replace(/\.SOURCE\.md$/, ""));
}

function listTrackedPluginFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z", "plugins"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter(Boolean)
      .sort();
  } catch {
    return walkFiles(PLUGINS_ROOT).map(rel);
  }
}

function collectGeneratedCopies(extended) {
  const expectedTargets = new Map();
  const sourceExpectedTargets = new Map();
  for (const [source, skillTargets] of extended) {
    for (const [skill, targetRel] of skillTargets) {
      const key = `${skill}/${targetRel}`;
      expectedTargets.set(key, source);
      if (!sourceExpectedTargets.has(source)) sourceExpectedTargets.set(source, new Set());
      sourceExpectedTargets.get(source).add(key);
    }
  }

  const sourceTracked = new Map();
  const sourceStale = new Map();
  const staleGeneratedCopies = [];
  for (const fileRel of listTrackedPluginFiles()) {
    if (!/^plugins\/[^/]+\/skills\/[^/]+\/references\//.test(fileRel)) continue;
    const file = path.join(ROOT, fromPosix(fileRel));
    const marker = markerSource(file);
    if (!marker) continue;
    const skill = fileRel.split("/references/")[0];
    const targetRel = `references/${fileRel.split("/references/")[1]}`;
    const key = `${skill}/${targetRel}`;
    const expectedSource = expectedTargets.get(key);
    const current = expectedSource && markerMatchesSource(marker, expectedSource);
    const countSource = current ? expectedSource : marker;
    const bucket = current ? sourceTracked : sourceStale;
    if (!bucket.has(countSource)) bucket.set(countSource, []);
    bucket.get(countSource).push(fileRel);
    if (!current) {
      staleGeneratedCopies.push({
        file: fileRel,
        markerSource: marker,
        expectedSource: expectedSource ?? null,
      });
    }
  }

  return { sourceExpectedTargets, sourceTracked, sourceStale, staleGeneratedCopies };
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

function isTextFile(file) {
  return [".md", ".json", ".toml", ".yaml", ".yml", ".txt", ".mjs", ".js", ".cjs", ".sh", ".ps1", ".py"].includes(path.extname(file).toLowerCase());
}

function mentionsTarget(text, targetPath) {
  const basename = path.posix.basename(targetPath);
  return text.includes(targetPath) || text.includes(basename);
}

function scriptImportsTarget(text, targetPath) {
  const basename = path.posix.basename(targetPath);
  const importPatterns = [
    /import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g,
    /export\s+[^"']*\s+from\s+["']([^"']+)["']/g,
    /import\(["']([^"']+)["']\)/g,
    /require\(["']([^"']+)["']\)/g,
  ];
  for (const pattern of importPatterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1].replaceAll("\\", "/");
      if (specifier.includes(basename) || specifier.includes(targetPath.replace(/^references\//, ""))) return true;
    }
  }
  return false;
}

function targetEvidence(target) {
  const skillRoot = path.join(ROOT, fromPosix(target.skill));
  const skillText = readText(path.join(skillRoot, "SKILL.md"));
  const mandatoryLines = skillText.split(/\r?\n/).filter((line) => /MANDATORY READ/i.test(line));
  const targetFile = path.join(skillRoot, fromPosix(target.path));
  const directMention = mentionsTarget(skillText, target.path);
  const mandatory = mandatoryLines.some((line) => mentionsTarget(line, target.path));
  let nestedMention = false;
  let scriptImport = false;
  for (const file of walkFiles(path.join(skillRoot, "references"), isTextFile)) {
    if (file === targetFile || file === `${targetFile}.SOURCE.md`) continue;
    const text = readText(file);
    if (mentionsTarget(text, target.path)) nestedMention = true;
    if (/\.(mjs|js|cjs)$/i.test(file) && scriptImportsTarget(text, target.path)) scriptImport = true;
  }
  return { directMention, mandatory, nestedMention, scriptImport };
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
  if (row.protectedReason) return "keep";
  if (row.mentionedBy === 0) return "delete-or-localize";
  if (row.mandatoryBy === 0 && row.targets > 2 && entry.kind !== "script") return "localize-or-keep-passive";
  if (category === "orchestration harness" && row.mandatoryBy > 0) return "demote-mandatory";
  if (category === "review loop" && row.mandatoryBy > 0 && row.mandatoryBy < row.targets) return "keep-conditional";
  return "keep";
}

function protectedReason(row) {
  if (row.source.endsWith(".SOURCE.md")) return "json-sidecar";
  if (row.mandatoryBy > 0) return "mandatory-read";
  if (row.scriptImportConsumers > 0) return "script-import";
  if (row.nestedMentions > 0) return "nested-reference";
  if (row.directMentions > 0) return "direct-skill-reference";
  return "";
}

function buildReport() {
  const registry = JSON.parse(readText(REGISTRY_PATH));
  const { extended } = buildExtendedRegistry(registry);
  const generated = collectGeneratedCopies(extended);
  const skills = listSkills();
  const skillText = new Map(skills.map((skill) => [skill.skill, skill.text]));
  const rows = registry.map((entry) => {
    const size = sourceSize(entry.source);
    const mentioned = [];
    const mandatory = [];
    const directMention = [];
    const nestedMention = [];
    const scriptImport = [];
    const targets = entry.targets ?? [];
    for (const target of targets) {
      const evidence = targetEvidence(target);
      if (evidence.directMention || evidence.nestedMention) mentioned.push(target.skill);
      if (evidence.directMention) directMention.push(target.skill);
      if (evidence.nestedMention) nestedMention.push(target.skill);
      if (evidence.scriptImport) scriptImport.push(target.skill);
      if (evidence.mandatory) mandatory.push(target.skill);
    }
    const row = {
      source: entry.source,
      sourceGroup: sourceGroup(entry.source),
      kind: entry.kind,
      size,
      targets: targets.length,
      directRegistryTargets: targets.length,
      extendedTargets: generated.sourceExpectedTargets.get(entry.source)?.size ?? 0,
      trackedGeneratedCopies: generated.sourceTracked.get(entry.source)?.length ?? 0,
      staleGeneratedCopies: generated.sourceStale.get(entry.source)?.length ?? 0,
      mentionedBy: mentioned.length,
      mandatoryBy: mandatory.length,
      directMentions: directMention.length,
      nestedMentions: nestedMention.length,
      scriptImportConsumers: scriptImport.length,
      replicatedBytes: size * targets.length,
      extendedReplicatedBytes: size * (generated.sourceExpectedTargets.get(entry.source)?.size ?? 0),
      mandatoryBytes: size * mandatory.length,
      topMandatorySkills: mandatory.slice(0, 8),
      topDirectMentionSkills: directMention.slice(0, 8),
      topNestedMentionSkills: nestedMention.slice(0, 8),
      topScriptImportSkills: scriptImport.slice(0, 8),
    };
    row.protectedReason = protectedReason(row);
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
  const extendedTargetsTotal = [...generated.sourceExpectedTargets.values()].reduce((sum, targets) => sum + targets.size, 0);
  const trackedGeneratedCopiesTotal = [...generated.sourceTracked.values()].reduce((sum, copies) => sum + copies.length, 0);
  const extendedReplicatedBytesTotal = [...generated.sourceExpectedTargets.entries()].reduce((sum, [source, targets]) => sum + sourceSize(source) * targets.size, 0);
  const transitiveGeneratedSources = [...generated.sourceExpectedTargets.keys()].filter((source) => !registry.some((entry) => entry.source === source)).length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      sharedSources: rows.length,
      sharedTargets: rows.reduce((sum, row) => sum + row.targets, 0),
      directRegistryTargets: rows.reduce((sum, row) => sum + row.directRegistryTargets, 0),
      extendedTargets: extendedTargetsTotal,
      trackedGeneratedCopies: trackedGeneratedCopiesTotal,
      staleGeneratedCopies: generated.staleGeneratedCopies.length,
      transitiveGeneratedSources,
      replicatedBytes: rows.reduce((sum, row) => sum + row.replicatedBytes, 0),
      extendedReplicatedBytes: extendedReplicatedBytesTotal,
      mandatoryBytes: rows.reduce((sum, row) => sum + row.mandatoryBytes, 0),
      skills: skillRows.length,
    },
    categories,
    sourceGroups: rows.reduce((acc, row) => {
      acc[row.sourceGroup] ??= {
        sources: 0,
        targets: 0,
        directRegistryTargets: 0,
        extendedTargets: 0,
        trackedGeneratedCopies: 0,
        staleGeneratedCopies: 0,
        replicatedBytes: 0,
        extendedReplicatedBytes: 0,
        mandatoryBytes: 0,
      };
      acc[row.sourceGroup].sources += 1;
      acc[row.sourceGroup].targets += row.targets;
      acc[row.sourceGroup].directRegistryTargets += row.directRegistryTargets;
      acc[row.sourceGroup].extendedTargets += row.extendedTargets;
      acc[row.sourceGroup].trackedGeneratedCopies += row.trackedGeneratedCopies;
      acc[row.sourceGroup].staleGeneratedCopies += row.staleGeneratedCopies;
      acc[row.sourceGroup].replicatedBytes += row.replicatedBytes;
      acc[row.sourceGroup].extendedReplicatedBytes += row.extendedReplicatedBytes;
      acc[row.sourceGroup].mandatoryBytes += row.mandatoryBytes;
      return acc;
    }, {}),
    sources: rows.sort((a, b) => b.mandatoryBytes - a.mandatoryBytes || b.replicatedBytes - a.replicatedBytes),
    skills: skillRows.sort((a, b) => b.mandatoryBytes - a.mandatoryBytes || b.mandatoryReads - a.mandatoryReads),
    staleGeneratedCopies: generated.staleGeneratedCopies,
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
