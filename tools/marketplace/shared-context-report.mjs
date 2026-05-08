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

function sourceGroup(source) {
  return /^plugins\/[^/]+\/shared\//.test(source) ? "pluginShared" : "rootShared";
}

function loadSkillText(skill) {
  const file = path.join(ROOT, fromPosix(skill), "SKILL.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
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
  for (const file of walkFiles(path.join(skillRoot, "references")).filter(isTextFile)) {
    if (file === targetFile || file === `${targetFile}.SOURCE.md`) continue;
    const text = readText(file);
    if (mentionsTarget(text, target.path)) nestedMention = true;
    if (/\.(mjs|js|cjs)$/i.test(file) && scriptImportsTarget(text, target.path)) scriptImport = true;
  }
  return { directMention, mandatory, nestedMention, scriptImport };
}

function protectedReason(row) {
  if (row.source.endsWith(".SOURCE.md")) return "json-sidecar";
  if (row.mandatoryBy > 0) return "mandatory-read";
  if (row.scriptImportConsumers > 0) return "script-import";
  if (row.nestedMentions > 0) return "nested-reference";
  if (row.directMentions > 0) return "direct-skill-reference";
  return "";
}

function parseArgs() {
  return {
    json: process.argv.includes("--json"),
    limit: Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 30),
  };
}

function buildReport() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  const { extended } = buildExtendedRegistry(registry);
  const generated = collectGeneratedCopies(extended);
  const skillTexts = new Map(listSkillDirs().map((skill) => [skill, loadSkillText(skill)]));
  const rows = registry.map((entry) => {
    const size = fileSize(entry.source);
    const mentionedBy = [];
    const mandatoryBy = [];
    const directMentionBy = [];
    const nestedMentionBy = [];
    const scriptImportBy = [];
    for (const target of entry.targets ?? []) {
      const evidence = targetEvidence(target);
      if (evidence.directMention || evidence.nestedMention) mentionedBy.push(target.skill);
      if (evidence.directMention) directMentionBy.push(target.skill);
      if (evidence.nestedMention) nestedMentionBy.push(target.skill);
      if (evidence.scriptImport) scriptImportBy.push(target.skill);
      if (evidence.mandatory) mandatoryBy.push(target.skill);
    }
    const row = {
      source: entry.source,
      sourceGroup: sourceGroup(entry.source),
      kind: entry.kind,
      size,
      targets: entry.targets?.length ?? 0,
      directRegistryTargets: entry.targets?.length ?? 0,
      extendedTargets: generated.sourceExpectedTargets.get(entry.source)?.size ?? 0,
      trackedGeneratedCopies: generated.sourceTracked.get(entry.source)?.length ?? 0,
      staleGeneratedCopies: generated.sourceStale.get(entry.source)?.length ?? 0,
      mentionedBy: mentionedBy.length,
      mandatoryBy: mandatoryBy.length,
      directMentions: directMentionBy.length,
      nestedMentions: nestedMentionBy.length,
      scriptImportConsumers: scriptImportBy.length,
      replicatedBytes: size * (entry.targets?.length ?? 0),
      extendedReplicatedBytes: size * (generated.sourceExpectedTargets.get(entry.source)?.size ?? 0),
      topHeavySkills: mandatoryBy.slice(0, 8),
      topDirectMentionSkills: directMentionBy.slice(0, 8),
      topNestedMentionSkills: nestedMentionBy.slice(0, 8),
      topScriptImportSkills: scriptImportBy.slice(0, 8),
    };
    row.protectedReason = protectedReason(row);
    return row;
  });
  rows.sort((a, b) => b.replicatedBytes - a.replicatedBytes || b.size - a.size || a.source.localeCompare(b.source));
  const extendedTargetsTotal = [...generated.sourceExpectedTargets.values()].reduce((sum, targets) => sum + targets.size, 0);
  const trackedGeneratedCopiesTotal = [...generated.sourceTracked.values()].reduce((sum, copies) => sum + copies.length, 0);
  const extendedReplicatedBytesTotal = [...generated.sourceExpectedTargets.entries()].reduce((sum, [source, targets]) => sum + fileSize(source) * targets.size, 0);
  const transitiveGeneratedSources = [...generated.sourceExpectedTargets.keys()].filter((source) => !registry.some((entry) => entry.source === source)).length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      registryEntries: rows.length,
      registryTargets: rows.reduce((sum, row) => sum + row.targets, 0),
      directRegistryTargets: rows.reduce((sum, row) => sum + row.directRegistryTargets, 0),
      extendedTargets: extendedTargetsTotal,
      trackedGeneratedCopies: trackedGeneratedCopiesTotal,
      staleGeneratedCopies: generated.staleGeneratedCopies.length,
      transitiveGeneratedSources,
      sourceBytes: rows.reduce((sum, row) => sum + row.size, 0),
      replicatedBytes: rows.reduce((sum, row) => sum + row.replicatedBytes, 0),
      extendedReplicatedBytes: extendedReplicatedBytesTotal,
      mandatoryReadBytes: rows.reduce((sum, row) => sum + row.size * row.mandatoryBy, 0),
    },
    sourceGroups: rows.reduce((acc, row) => {
      acc[row.sourceGroup] ??= {
        registryEntries: 0,
        registryTargets: 0,
        directRegistryTargets: 0,
        extendedTargets: 0,
        trackedGeneratedCopies: 0,
        staleGeneratedCopies: 0,
        sourceBytes: 0,
        replicatedBytes: 0,
        extendedReplicatedBytes: 0,
        mandatoryReadBytes: 0,
      };
      acc[row.sourceGroup].registryEntries += 1;
      acc[row.sourceGroup].registryTargets += row.targets;
      acc[row.sourceGroup].directRegistryTargets += row.directRegistryTargets;
      acc[row.sourceGroup].extendedTargets += row.extendedTargets;
      acc[row.sourceGroup].trackedGeneratedCopies += row.trackedGeneratedCopies;
      acc[row.sourceGroup].staleGeneratedCopies += row.staleGeneratedCopies;
      acc[row.sourceGroup].sourceBytes += row.size;
      acc[row.sourceGroup].replicatedBytes += row.replicatedBytes;
      acc[row.sourceGroup].extendedReplicatedBytes += row.extendedReplicatedBytes;
      acc[row.sourceGroup].mandatoryReadBytes += row.size * row.mandatoryBy;
      return acc;
    }, {}),
    rows,
    zeroMention: rows.filter((row) => row.mentionedBy === 0),
    zeroMandatory: rows.filter((row) => row.mandatoryBy === 0),
    staleGeneratedCopies: generated.staleGeneratedCopies,
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
