#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const REGISTRY_PATH = path.join(__dirname, "shared-registry.json");
const PLUGINS_ROOT = path.join(ROOT, "plugins");
const SHARED_ROOT = path.join(ROOT, "shared");

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".json",
  ".toml",
  ".yaml",
  ".yml",
  ".txt",
  ".mjs",
  ".js",
  ".cjs",
  ".sh",
  ".ps1",
  ".py",
  ".template",
  ".service",
  ".timer",
  ".xml",
  ".cs",
  ".html",
  ".css",
]);

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

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) || path.basename(file) === "SKILL.md";
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error(`Missing shared registry: ${rel(REGISTRY_PATH)}`);
  }
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  if (!Array.isArray(registry)) {
    throw new Error("Shared registry must be an array");
  }
  return registry;
}

function listSkillDirs() {
  const skills = [];
  for (const plugin of fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const skillsRoot = path.join(PLUGINS_ROOT, plugin.name, "skills");
    if (!fs.existsSync(skillsRoot)) continue;
    for (const skill of fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const skillRoot = path.join(skillsRoot, skill.name);
      if (fs.existsSync(path.join(skillRoot, "SKILL.md"))) skills.push(skillRoot);
    }
  }
  return skills;
}

function sourceForTarget(target) {
  if (target === "references/replan_algorithm_common.md") return "shared/references/replan_algorithm.md";
  if (target.startsWith("references/scripts/")) return `shared/scripts/${target.slice("references/scripts/".length)}`;
  if (target.startsWith("references/templates/")) return `shared/templates/${target.slice("references/templates/".length)}`;
  if (target.startsWith("references/agents/")) return `shared/agents/${target.slice("references/agents/".length)}`;
  if (target.startsWith("references/")) return `shared/references/${target.slice("references/".length)}`;
  return null;
}

function cleanToken(token) {
  return token
    .replaceAll("\\", "/")
    .replace(/[),.;:!?\]}>]+$/g, "")
    .replace(/[`'"]+$/g, "")
    .replace(/^[`'"]+/g, "");
}

function importDeps(skillRoot, target) {
  if (!target.match(/\.(mjs|js|cjs)$/)) return [];
  const fullPath = path.join(skillRoot, fromPosix(target));
  if (!fs.existsSync(fullPath)) return [];
  const text = fs.readFileSync(fullPath, "utf8");
  const dir = path.dirname(fullPath);
  const deps = [];
  const patterns = [
    /import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g,
    /export\s+[^"']*\s+from\s+["']([^"']+)["']/g,
    /import\(["']([^"']+)["']\)/g,
    /require\(["']([^"']+)["']\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const resolved = path.resolve(dir, specifier);
      const candidates = [
        resolved,
        `${resolved}.mjs`,
        `${resolved}.js`,
        `${resolved}.cjs`,
        path.join(resolved, "index.mjs"),
        path.join(resolved, "index.js"),
      ];
      const hit = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!hit) continue;
      const targetRel = toPosix(path.relative(skillRoot, hit));
      if (targetRel.startsWith("references/")) deps.push(targetRel);
    }
  }
  return [...new Set(deps)].sort();
}

function buildUsageFromSkillLocalRefs() {
  const usage = new Map();
  for (const skillRoot of listSkillDirs()) {
    const skillRel = rel(skillRoot);
    const directTargets = new Set();
    for (const file of walkFiles(skillRoot).filter(isTextFile)) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/references[\\/][A-Za-z0-9_@=:+\-.[\]/]+/g)) {
        const target = cleanToken(match[0]);
        const source = sourceForTarget(target);
        if (source && fs.existsSync(path.join(ROOT, fromPosix(source)))) directTargets.add(source);
      }
    }
    const sources = new Set();
    const seenTargets = new Set();
    const stack = [...directTargets].map((source) => {
      if (source.startsWith("shared/scripts/")) return `references/scripts/${source.slice("shared/scripts/".length)}`;
      if (source.startsWith("shared/templates/")) return `references/templates/${source.slice("shared/templates/".length)}`;
      if (source.startsWith("shared/agents/")) return `references/agents/${source.slice("shared/agents/".length)}`;
      return `references/${source.slice("shared/references/".length)}`;
    });
    while (stack.length) {
      const target = stack.pop();
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
      const source = sourceForTarget(target);
      if (source && fs.existsSync(path.join(ROOT, fromPosix(source)))) sources.add(source);
      for (const dep of importDeps(skillRoot, target)) stack.push(dep);
    }
    for (const source of sources) {
      if (!usage.has(source)) usage.set(source, new Set());
      usage.get(source).add(skillRel);
    }
  }
  return usage;
}

export function buildReport() {
  const registry = loadRegistry();
  const registrySources = new Set(registry.map((entry) => entry.source));
  const rootSharedFiles = walkFiles(SHARED_ROOT).map(rel);
  const usage = buildUsageFromSkillLocalRefs();

  const pluginSharedDirs = fs
    .readdirSync(PLUGINS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLUGINS_ROOT, entry.name, "shared"))
    .filter((dir) => fs.existsSync(dir))
    .map(rel);

  const skillSharedPathRefs = [];
  for (const skillRoot of listSkillDirs()) {
    for (const file of walkFiles(skillRoot).filter(isTextFile)) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/shared[\\/](references|scripts|templates|agents)[\\/][A-Za-z0-9_@{}*.,=:+\-[\]/]+/g)) {
        skillSharedPathRefs.push({ file: rel(file), token: cleanToken(match[0]) });
      }
    }
  }

  const singleUseRootShared = [];
  const unusedRootShared = [];
  for (const source of rootSharedFiles) {
    const count = usage.get(source)?.size ?? 0;
    if (!registrySources.has(source)) {
      if (count <= 1) singleUseRootShared.push({ source, count });
      else unusedRootShared.push({ source, count });
    }
  }

  return {
    rootSharedFiles: rootSharedFiles.length,
    registryEntries: registry.length,
    registryTargets: registry.reduce((sum, entry) => sum + entry.targets.length, 0),
    pluginSharedDirs,
    skillSharedPathRefs,
    unresolvedDynamicRefs: [],
    singleUseRootShared,
    unusedRootShared,
  };
}

export function syncShared() {
  const registry = loadRegistry();
  const seenTargets = new Map();
  for (const entry of registry) {
    const sourcePath = path.join(ROOT, fromPosix(entry.source));
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing shared source: ${entry.source}`);
    for (const target of entry.targets) {
      if (!target.path.startsWith("references/")) {
        throw new Error(`Shared target must stay under references/: ${target.skill}/${target.path}`);
      }
      const targetKey = `${target.skill}/${target.path}`;
      const existingSource = seenTargets.get(targetKey);
      if (existingSource && existingSource !== entry.source) {
        throw new Error(`Shared target conflict: ${targetKey} from ${existingSource} and ${entry.source}`);
      }
      seenTargets.set(targetKey, entry.source);
      const targetPath = path.join(ROOT, fromPosix(target.skill), fromPosix(target.path));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (fs.existsSync(targetPath) && hashFile(targetPath) !== hashFile(sourcePath)) {
        throw new Error(`Shared target differs; refusing overwrite: ${targetKey}`);
      }
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

export function validateSharedDistribution() {
  const registry = loadRegistry();
  const problems = [];
  const report = buildReport();

  for (const dir of report.pluginSharedDirs) problems.push(`plugin shared directory must not exist: ${dir}`);
  for (const ref of report.skillSharedPathRefs) problems.push(`skill runtime references root shared path: ${ref.file}: ${ref.token}`);
  for (const item of report.singleUseRootShared) problems.push(`root shared file is not registered multi-use: ${item.source}`);
  for (const item of report.unusedRootShared) problems.push(`root shared file has no usage: ${item.source}`);

  for (const entry of registry) {
    const sourcePath = path.join(ROOT, fromPosix(entry.source));
    if (!fs.existsSync(sourcePath)) {
      problems.push(`missing shared source: ${entry.source}`);
      continue;
    }
    if (!entry.targets || entry.targets.length < 2) problems.push(`registry source must have 2+ targets: ${entry.source}`);
    for (const target of entry.targets ?? []) {
      const skillRoot = path.join(ROOT, fromPosix(target.skill));
      const targetPath = path.join(skillRoot, fromPosix(target.path));
      if (!fs.existsSync(path.join(skillRoot, "SKILL.md"))) problems.push(`registry target skill missing: ${target.skill}`);
      if (!target.path.startsWith("references/")) problems.push(`registry target outside references/: ${target.skill}/${target.path}`);
      if (!fs.existsSync(targetPath)) problems.push(`registry target missing: ${target.skill}/${target.path}`);
      else if (hashFile(targetPath) !== hashFile(sourcePath)) {
        problems.push(`registry target hash mismatch: ${target.skill}/${target.path}`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Shared registry validation failed:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
  }
  return registry.length;
}

function main() {
  const command = process.argv[2] || "validate";
  if (command === "report") {
    const report = buildReport();
    if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else console.log(report);
  } else if (command === "sync") {
    syncShared();
    const count = validateSharedDistribution();
    console.log(`OK: synced ${count} shared registry sources into skill references`);
  } else if (command === "validate") {
    const count = validateSharedDistribution();
    console.log(`OK: shared registry validates ${count} multi-use sources`);
  } else {
    console.error("Usage: node tools/marketplace/shared.mjs [report [--json]|sync|validate]");
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
