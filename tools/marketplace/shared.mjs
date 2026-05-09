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

function listPluginSharedFiles() {
  const files = [];
  for (const plugin of fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const sharedRoot = path.join(PLUGINS_ROOT, plugin.name, "shared");
    files.push(...walkFiles(sharedRoot).map(rel));
  }
  return files.sort();
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) || path.basename(file) === "SKILL.md";
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const MARKER_PATTERN = /SOURCE-OF-TRUTH:\s+((?:shared|plugins\/[^/]+\/shared)\/\S+?)\.\s/;

function readHead(file, lines = 8) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split(/\r?\n/).slice(0, lines).join("\n");
  } catch {
    return "";
  }
}

function hasDistributionMarker(file, expectedSharedPath) {
  // .json files use a sidecar `<file>.SOURCE.md` since JSON has no comment syntax.
  if (file.endsWith(".json")) {
    return fs.existsSync(`${file}.SOURCE.md`);
  }
  const head = readHead(file);
  const m = head.match(MARKER_PATTERN);
  if (!m) return false;
  if (!expectedSharedPath) return true;
  if (m[1] === expectedSharedPath) return true;
  // Sidecar (.json.SOURCE.md) carries a marker pointing to its companion .json.
  if (expectedSharedPath.endsWith(".json.SOURCE.md") && m[1] === expectedSharedPath.replace(/\.SOURCE\.md$/, "")) {
    return true;
  }
  return false;
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

function pluginForSkill(skill) {
  return skill.match(/^plugins\/([^/]+)\//)?.[1] ?? null;
}

function pluginForSource(source) {
  return source.match(/^plugins\/([^/]+)\/shared\//)?.[1] ?? null;
}

function isSharedSource(source) {
  return source.startsWith("shared/") || /^plugins\/[^/]+\/shared\//.test(source);
}

function pluginSharedSourceForTarget(target, plugin) {
  if (!plugin) return null;
  if (target === "references/replan_algorithm_common.md") return `plugins/${plugin}/shared/references/replan_algorithm.md`;
  if (target.startsWith("references/scripts/")) return `plugins/${plugin}/shared/scripts/${target.slice("references/scripts/".length)}`;
  if (target.startsWith("references/templates/")) return `plugins/${plugin}/shared/templates/${target.slice("references/templates/".length)}`;
  if (target.startsWith("references/agents/")) return `plugins/${plugin}/shared/agents/${target.slice("references/agents/".length)}`;
  if (target.startsWith("references/")) return `plugins/${plugin}/shared/references/${target.slice("references/".length)}`;
  return null;
}

function rootSharedSourceForTarget(target) {
  if (target === "references/replan_algorithm_common.md") return "shared/references/replan_algorithm.md";
  if (target.startsWith("references/scripts/")) return `shared/scripts/${target.slice("references/scripts/".length)}`;
  if (target.startsWith("references/templates/")) return `shared/templates/${target.slice("references/templates/".length)}`;
  if (target.startsWith("references/agents/")) return `shared/agents/${target.slice("references/agents/".length)}`;
  if (target.startsWith("references/")) return `shared/references/${target.slice("references/".length)}`;
  return null;
}

function sourceForTarget(target, plugin = null) {
  const pluginSource = pluginSharedSourceForTarget(target, plugin);
  if (pluginSource && fs.existsSync(path.join(ROOT, fromPosix(pluginSource)))) return pluginSource;
  const rootSource = rootSharedSourceForTarget(target);
  if (rootSource && fs.existsSync(path.join(ROOT, fromPosix(rootSource)))) return rootSource;
  return null;
}

function targetForSource(source) {
  if (source === "shared/references/replan_algorithm.md") return "references/replan_algorithm_common.md";
  const pluginSourceMatch = source.match(/^plugins\/[^/]+\/shared\/(references|scripts|templates|agents)\/(.+)$/);
  if (pluginSourceMatch) {
    const [, kind, rest] = pluginSourceMatch;
    if (kind === "references" && rest === "replan_algorithm.md") return "references/replan_algorithm_common.md";
    if (kind === "references") return `references/${rest}`;
    return `references/${kind}/${rest}`;
  }
  if (source.startsWith("shared/scripts/")) return `references/scripts/${source.slice("shared/scripts/".length)}`;
  if (source.startsWith("shared/templates/")) return `references/templates/${source.slice("shared/templates/".length)}`;
  if (source.startsWith("shared/agents/")) return `references/agents/${source.slice("shared/agents/".length)}`;
  if (source.startsWith("shared/references/")) return `references/${source.slice("shared/references/".length)}`;
  return null;
}

function sharedImportDeps(source) {
  if (!source.match(/\.(mjs|js|cjs)$/)) return [];
  const fullPath = path.join(ROOT, fromPosix(source));
  if (!fs.existsSync(fullPath)) return [];
  const text = fs.readFileSync(fullPath, "utf8");
  const dir = path.dirname(fullPath);
  const deps = new Set();
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
      const relPath = toPosix(path.relative(ROOT, hit));
      if (isSharedSource(relPath)) deps.add(relPath);
    }
  }
  return [...deps].sort();
}

function sharedTextRefDeps(source) {
  if (!source.match(/\.(md|json|yaml|yml|toml|txt)$/i)) return [];
  const fullPath = path.join(ROOT, fromPosix(source));
  if (!fs.existsSync(fullPath)) return [];
  const text = fs.readFileSync(fullPath, "utf8");
  const deps = new Set();
  const plugin = pluginForSource(source);
  for (const match of text.matchAll(/references[\\/][A-Za-z0-9_@=:+\-.[\]/]+/g)) {
    const target = cleanToken(match[0]);
    if (target.endsWith("/")) continue;
    if (!/\.\w+$/.test(target)) continue;
    const sharedSource = sourceForTarget(target, plugin);
    if (sharedSource && fs.existsSync(path.join(ROOT, fromPosix(sharedSource)))) {
      deps.add(sharedSource);
    }
  }
  return [...deps].sort();
}

export function buildExtendedRegistry(registry) {
  const extended = new Map();
  const transitiveSources = new Set();
  function addTarget(source, skill, targetPath) {
    if (!extended.has(source)) extended.set(source, new Map());
    const skillTargets = extended.get(source);
    if (!skillTargets.has(skill)) {
      skillTargets.set(skill, targetPath);
      return true;
    }
    return false;
  }
  for (const entry of registry) {
    for (const target of entry.targets ?? []) {
      addTarget(entry.source, target.skill, target.path);
    }
  }
  const stack = [...extended.keys()];
  while (stack.length) {
    const source = stack.pop();
    const skillMap = extended.get(source);
    const skills = [...skillMap.keys()];
    for (const dep of [...new Set([...sharedImportDeps(source), ...sharedTextRefDeps(source)])]) {
      const depTargetPath = targetForSource(dep);
      if (!depTargetPath) continue;
      let added = false;
      for (const skill of skills) {
        if (addTarget(dep, skill, depTargetPath)) {
          transitiveSources.add(dep);
          added = true;
        }
      }
      if (added) stack.push(dep);
    }
  }
  return { extended, transitiveSources };
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
        const source = sourceForTarget(target, pluginForSkill(skillRel));
        if (source && fs.existsSync(path.join(ROOT, fromPosix(source)))) directTargets.add(source);
      }
    }
    const sources = new Set();
    const seenTargets = new Set();
    const stack = [...directTargets].map((source) => targetForSource(source)).filter(Boolean);
    while (stack.length) {
      const target = stack.pop();
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
      const source = sourceForTarget(target, pluginForSkill(skillRel));
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

function buildCiReachableSet() {
  const reachable = new Set();
  const stack = [];
  const runtimesWithTests = new Set();
  for (const filePath of walkFiles(SHARED_ROOT)) {
    const r = rel(filePath);
    const m = r.match(/^shared\/scripts\/([^/]+)\/test\/[^/]+\.(mjs|js|cjs)$/);
    if (m) {
      runtimesWithTests.add(m[1]);
      reachable.add(r);
      stack.push(r);
    }
  }
  for (const filePath of walkFiles(SHARED_ROOT)) {
    const r = rel(filePath);
    const m = r.match(/^shared\/scripts\/([^/]+)\//);
    if (m && runtimesWithTests.has(m[1]) && !reachable.has(r)) {
      reachable.add(r);
      stack.push(r);
    }
  }
  while (stack.length) {
    const source = stack.pop();
    for (const dep of sharedImportDeps(source)) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        stack.push(dep);
      }
    }
  }
  return reachable;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSkillRefsOrphans(extendedRegistry) {
  const orphans = [];
  const distributedFiles = new Set();
  for (const [, skillTargets] of extendedRegistry) {
    for (const [skill, targetRel] of skillTargets) {
      distributedFiles.add(toPosix(path.join(skill, fromPosix(targetRel))));
    }
  }

  for (const skillRoot of listSkillDirs()) {
    const refsDir = path.join(skillRoot, "references");
    if (!fs.existsSync(refsDir)) continue;
    const skillRel = rel(skillRoot);
    const refsFiles = walkFiles(refsDir);
    if (refsFiles.length === 0) continue;

    const reachable = new Set();
    function visit(filePath) {
      if (reachable.has(filePath)) return;
      reachable.add(filePath);
      if (!isTextFile(filePath)) return;
      const text = fs.readFileSync(filePath, "utf8");
      for (const m of text.matchAll(/references[\\/][A-Za-z0-9_@=:+\-.[\]/]+/g)) {
        const tok = cleanToken(m[0]).split("/");
        const rest = tok.slice(1).join("/");
        const target = path.join(refsDir, rest);
        const cands = [target, `${target}.mjs`, `${target}.js`, `${target}.cjs`];
        for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) { visit(c); break; }
      }
      const dir = path.dirname(filePath);
      for (const m of text.matchAll(/(?:from|import|require\()[\s"']*((?:\.\/|\.\.\/)[^"')\s]+)/g)) {
        const spec = m[1];
        const resolved = path.resolve(dir, spec);
        const cands = [resolved, `${resolved}.mjs`, `${resolved}.js`, `${resolved}.cjs`, path.join(resolved, "index.mjs"), path.join(resolved, "index.js")];
        for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) { visit(c); break; }
      }
      for (const refFile of refsFiles) {
        if (reachable.has(refFile)) continue;
        const basename = path.basename(refFile);
        if (basename.length < 4) continue;
        const re = new RegExp(`(?:^|[^A-Za-z0-9_])${escapeRegex(basename)}(?:[^A-Za-z0-9_.]|$)`);
        if (re.test(text)) visit(refFile);
      }
    }

    for (const refFile of refsFiles) {
      if (distributedFiles.has(rel(refFile))) visit(refFile);
    }
    for (const f of walkFiles(skillRoot)) {
      const fr = rel(f);
      if (fr.startsWith(`${skillRel}/references/`)) continue;
      visit(f);
    }

    for (const refFile of refsFiles) {
      if (!reachable.has(refFile)) orphans.push(rel(refFile));
    }
  }
  return orphans;
}

function stripCodeFences(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^( {4,}|\t).*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

function buildMissingSkillReferences() {
  const missing = [];
  for (const skillRoot of listSkillDirs()) {
    const skillRel = rel(skillRoot);
    for (const file of walkFiles(skillRoot).filter(isTextFile)) {
      if (rel(file).match(/\/references\/scripts\/.+\.(mjs|js|cjs)$/)) continue;
      let text = fs.readFileSync(file, "utf8");
      if (path.extname(file).toLowerCase() === ".md" || path.basename(file) === "SKILL.md") {
        text = stripCodeFences(text);
      }
      const seen = new Set();
      for (const m of text.matchAll(/references[\\/][A-Za-z0-9_@=:+\-.[\]/]+/g)) {
        const target = cleanToken(m[0]);
        if (target.endsWith("/")) continue;
        if (seen.has(target)) continue;
        seen.add(target);
        const targetPath = path.join(skillRoot, fromPosix(target));
        if (fs.existsSync(targetPath)) continue;
        if (!/\.\w+$/.test(target)) {
          if (fs.existsSync(`${targetPath}.mjs`) || fs.existsSync(`${targetPath}.js`) || fs.existsSync(`${targetPath}.cjs`)) continue;
          continue;
        }
        missing.push({ skill: skillRel, source: rel(file), target });
      }
    }
  }
  return missing;
}

function buildCrossSkillDuplicates(extendedRegistry) {
  const distributedFiles = new Set();
  for (const [, skillTargets] of extendedRegistry) {
    for (const [skill, targetRel] of skillTargets) {
      distributedFiles.add(toPosix(path.join(skill, fromPosix(targetRel))));
    }
  }
  const groups = new Map();
  for (const skillRoot of listSkillDirs()) {
    for (const f of walkFiles(skillRoot).filter(isTextFile)) {
      const fr = rel(f);
      if (distributedFiles.has(fr)) continue;
      const m = fr.match(/^plugins\/[^/]+\/skills\/[^/]+\/(.+)$/);
      if (!m) continue;
      const suffix = m[1];
      if (!suffix.startsWith("references/")) continue;
      const h = hashFile(f);
      const key = `${suffix}|${h}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(fr);
    }
  }
  const dups = [];
  for (const [key, files] of groups) {
    if (files.length >= 2) dups.push({ suffix: key.split("|")[0], files });
  }
  return dups;
}

export function buildReport() {
  const registry = loadRegistry();
  const registrySources = new Set(registry.map((entry) => entry.source));
  const rootSharedFiles = walkFiles(SHARED_ROOT).map(rel);
  const pluginSharedFiles = listPluginSharedFiles();
  const usage = buildUsageFromSkillLocalRefs();
  const { extended, transitiveSources } = buildExtendedRegistry(registry);
  const reachableSources = new Set(extended.keys());
  const ciReachable = buildCiReachableSet();

  const pluginSharedDirs = fs
    .readdirSync(PLUGINS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLUGINS_ROOT, entry.name, "shared"))
    .filter((dir) => fs.existsSync(dir))
    .map(rel);

  const distributedFiles = new Set();
  for (const [, skillTargets] of extended) {
    for (const [skill, targetRel] of skillTargets) {
      distributedFiles.add(toPosix(path.join(skill, fromPosix(targetRel))));
    }
  }

  const skillSharedPathRefs = [];
  for (const skillRoot of listSkillDirs()) {
    for (const file of walkFiles(skillRoot).filter(isTextFile)) {
      if (distributedFiles.has(rel(file))) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/shared[\\/](references|scripts|templates|agents)[\\/][A-Za-z0-9_@{}*.,=:+\-[\]/]+/g)) {
        skillSharedPathRefs.push({ file: rel(file), token: cleanToken(match[0]) });
      }
    }
  }

  const orphanRootShared = [];
  const orphanPluginShared = [];
  const singleUseRootShared = [];
  for (const source of rootSharedFiles) {
    if (!reachableSources.has(source)) {
      const count = usage.get(source)?.size ?? 0;
      orphanRootShared.push({ source, count, ciReachable: ciReachable.has(source) });
      continue;
    }
    if (registrySources.has(source)) continue;
    if (transitiveSources.has(source)) continue;
    singleUseRootShared.push({ source });
  }
  for (const source of pluginSharedFiles) {
    if (!reachableSources.has(source)) {
      orphanPluginShared.push({ source, plugin: pluginForSource(source) });
    }
  }

  const skillRefsOrphans = buildSkillRefsOrphans(extended);
  const crossSkillDuplicates = buildCrossSkillDuplicates(extended);
  const missingSkillReferences = buildMissingSkillReferences();

  return {
    rootSharedFiles: rootSharedFiles.length,
    pluginSharedFiles: pluginSharedFiles.length,
    sharedSourceGroups: {
      rootShared: rootSharedFiles.length,
      pluginShared: pluginSharedFiles.length,
      registryRootShared: registry.filter((entry) => entry.source.startsWith("shared/")).length,
      registryPluginShared: registry.filter((entry) => /^plugins\/[^/]+\/shared\//.test(entry.source)).length,
    },
    registryEntries: registry.length,
    registryTargets: registry.reduce((sum, entry) => sum + entry.targets.length, 0),
    extendedTargets: [...extended.values()].reduce((sum, m) => sum + m.size, 0),
    transitiveSources: transitiveSources.size,
    pluginSharedDirs,
    skillSharedPathRefs,
    unresolvedDynamicRefs: [],
    orphanRootShared,
    orphanPluginShared,
    singleUseRootShared,
    skillRefsOrphans,
    crossSkillDuplicates,
    missingSkillReferences,
  };
}

export function syncShared() {
  const registry = loadRegistry();
  const { extended } = buildExtendedRegistry(registry);
  const seenTargets = new Map();
  for (const [source, skillTargets] of extended) {
    const sourcePath = path.join(ROOT, fromPosix(source));
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing shared source: ${source}`);
    if (!hasDistributionMarker(sourcePath, source)) {
      throw new Error(`Shared source missing SOURCE-OF-TRUTH marker (expected to reference ${source}): ${source}`);
    }
    for (const [skill, targetRel] of skillTargets) {
      if (!targetRel.startsWith("references/")) {
        throw new Error(`Shared target must stay under references/: ${skill}/${targetRel}`);
      }
      const targetKey = `${skill}/${targetRel}`;
      const existingSource = seenTargets.get(targetKey);
      if (existingSource && existingSource !== source) {
        throw new Error(`Shared target conflict: ${targetKey} from ${existingSource} and ${source}`);
      }
      seenTargets.set(targetKey, source);
      const targetPath = path.join(ROOT, fromPosix(skill), fromPosix(targetRel));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (fs.existsSync(targetPath) && hashFile(targetPath) !== hashFile(sourcePath)) {
        if (!hasDistributionMarker(targetPath)) {
          throw new Error(`Shared target differs and is not marked as generated; refusing overwrite: ${targetKey}`);
        }
      }
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
  const expectedTargets = new Set(seenTargets.keys());
  for (const skillRoot of listSkillDirs()) {
    const skillRel = rel(skillRoot);
    const refsDir = path.join(skillRoot, "references");
    for (const file of walkFiles(refsDir)) {
      const fileRel = rel(file);
      const targetRel = toPosix(path.relative(skillRoot, file));
      const targetKey = `${skillRel}/${targetRel}`;
      if (expectedTargets.has(targetKey)) continue;
      if (!hasDistributionMarker(file)) continue;
      fs.unlinkSync(file);
    }
  }
}

export function validateSharedDistribution() {
  const registry = loadRegistry();
  const problems = [];
  const report = buildReport();
  const { extended } = buildExtendedRegistry(registry);

  for (const ref of report.skillSharedPathRefs) problems.push(`skill runtime references root shared path: ${ref.file}: ${ref.token}`);

  for (const entry of registry) {
    const sourcePath = path.join(ROOT, fromPosix(entry.source));
    const sourcePlugin = pluginForSource(entry.source);
    if (!entry.source.startsWith("shared/") && !sourcePlugin) {
      problems.push(`shared source must be under shared/ or plugins/<plugin>/shared/: ${entry.source}`);
    }
    if (!fs.existsSync(sourcePath)) {
      problems.push(`missing shared source: ${entry.source}`);
      continue;
    }
    if (!entry.targets || entry.targets.length < 1) problems.push(`registry source must have at least one target: ${entry.source}`);
    for (const target of entry.targets ?? []) {
      const targetPlugin = pluginForSkill(target.skill);
      if (sourcePlugin && targetPlugin !== sourcePlugin) {
        problems.push(`plugin-local shared source targets another plugin: ${entry.source} -> ${target.skill}`);
      }
    }
  }

  for (const [source, skillTargets] of extended) {
    const sourcePath = path.join(ROOT, fromPosix(source));
    if (!fs.existsSync(sourcePath)) {
      problems.push(`missing shared source: ${source}`);
      continue;
    }
    if (!hasDistributionMarker(sourcePath, source)) {
      problems.push(`shared source missing SOURCE-OF-TRUTH marker: ${source}`);
    }
    for (const [skill, targetRel] of skillTargets) {
      const skillRoot = path.join(ROOT, fromPosix(skill));
      const targetPath = path.join(skillRoot, fromPosix(targetRel));
      if (!fs.existsSync(path.join(skillRoot, "SKILL.md"))) problems.push(`registry target skill missing: ${skill}`);
      if (!targetRel.startsWith("references/")) problems.push(`registry target outside references/: ${skill}/${targetRel}`);
      if (!fs.existsSync(targetPath)) problems.push(`registry target missing: ${skill}/${targetRel}`);
      else if (hashFile(targetPath) !== hashFile(sourcePath)) {
        problems.push(`registry target hash mismatch: ${skill}/${targetRel}`);
      } else if (!hasDistributionMarker(targetPath, source)) {
        problems.push(`registry target missing distribution marker: ${skill}/${targetRel}`);
      }
    }
  }

  for (const o of report.orphanRootShared) {
    if (o.ciReachable) continue;
    if (o.count >= 2) {
      problems.push(`shared file referenced by ${o.count} skills but missing from registry: ${o.source}`);
    } else if (o.count === 1) {
      problems.push(`shared file used by only 1 skill (move to that skill or register multi-use): ${o.source}`);
    } else {
      problems.push(`shared file unused (remove or wire to skills): ${o.source}`);
    }
  }
  for (const o of report.orphanPluginShared) {
    problems.push(`plugin shared file unused (remove or wire to skills): ${o.source}`);
  }

  for (const f of report.skillRefsOrphans) {
    problems.push(`skill references/ orphan (no skill content references it): ${f}`);
  }

  for (const dup of report.crossSkillDuplicates) {
    problems.push(`cross-skill duplicate not in registry (${dup.files.length} skills): ${dup.suffix}`);
  }

  for (const m of report.missingSkillReferences) {
    problems.push(`skill ${m.skill} references nonexistent ${m.target} (mentioned in ${m.source})`);
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
