#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSharedDistribution } from "./shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const CLAUDE_MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const CODEX_MARKETPLACE = path.join(ROOT, ".agents", "plugins", "marketplace.json");
const PLUGINS_ROOT = path.join(ROOT, "plugins");
const MCP_ROOT = path.join(ROOT, "mcp");
const MCP_REGISTRY_DESCRIPTION_MAX = 100;
const CODEX_INSTALLATION_POLICIES = new Set(["NOT_AVAILABLE", "AVAILABLE", "INSTALLED_BY_DEFAULT"]);
const CODEX_AUTH_POLICIES = new Set(["ON_INSTALL", "ON_USE"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkFiles(root, predicate) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (!predicate || predicate(fullPath))) {
        files.push(fullPath);
      }
    }
  }
  walk(root);
  return files;
}

function readSkillFrontmatter(skillDir) {
  const skillPath = path.join(skillDir, "SKILL.md");
  const text = fs.readFileSync(skillPath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Missing frontmatter: ${path.relative(ROOT, skillPath)}`);
  }
  const name = match[1].match(/^name:\s*["']?([^"'\r\n]+)["']?$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim()?.replace(/^["']|["']$/g, "");
  if (!name || !description) {
    throw new Error(`Missing name/description: ${path.relative(ROOT, skillPath)}`);
  }
  return { name, description, text };
}

function assertNoLegacyText(file, text) {
  const forbiddenTerms = [
    ["skills", "catalog"].join("-"),
    ["Codex", "native adapter"].join("-"),
    ["canonical", "skill"].join(" "),
  ];
  for (const forbidden of forbiddenTerms) {
    if (text.includes(forbidden)) {
      throw new Error(`Forbidden legacy text "${forbidden}" in ${path.relative(ROOT, file)}`);
    }
  }
}

function validateRootMarketplaces() {
  const claude = readJson(CLAUDE_MARKETPLACE);
  const codex = readJson(CODEX_MARKETPLACE);
  const claudeNames = claude.plugins.map((plugin) => plugin.name).sort();
  const codexNames = codex.plugins.map((plugin) => plugin.name).sort();

  if (claude.name !== codex.name) {
    throw new Error(`Claude/Codex marketplace name mismatch: ${claude.name} != ${codex.name}`);
  }

  for (const [label, names] of [["Claude", claudeNames], ["Codex", codexNames]]) {
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new Error(`${label} marketplace has duplicate plugin entries: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  if (JSON.stringify(claudeNames) !== JSON.stringify(codexNames)) {
    throw new Error(`Claude/Codex plugin mismatch: ${claudeNames.join(", ")} != ${codexNames.join(", ")}`);
  }

  assertNoLegacyText(CLAUDE_MARKETPLACE, fs.readFileSync(CLAUDE_MARKETPLACE, "utf8"));
  assertNoLegacyText(CODEX_MARKETPLACE, fs.readFileSync(CODEX_MARKETPLACE, "utf8"));
  return { claude, codex };
}

function validateCodexMarketplaceEntry(pluginName, entry) {
  if (!entry) {
    throw new Error(`Missing Codex marketplace entry: ${pluginName}`);
  }
  if (entry.name !== pluginName) {
    throw new Error(`Codex marketplace name mismatch: ${entry.name} != ${pluginName}`);
  }
  if (entry.source?.source !== "local") {
    throw new Error(`Codex plugin ${pluginName} must use source.source "local"`);
  }
  if (entry.source?.path !== `./plugins/${pluginName}`) {
    throw new Error(`Codex plugin ${pluginName} must use source.path ./plugins/${pluginName}`);
  }
  if (!CODEX_INSTALLATION_POLICIES.has(entry.policy?.installation)) {
    throw new Error(`Codex plugin ${pluginName} has invalid policy.installation`);
  }
  if (!CODEX_AUTH_POLICIES.has(entry.policy?.authentication)) {
    throw new Error(`Codex plugin ${pluginName} has invalid policy.authentication`);
  }
  if (!entry.category || typeof entry.category !== "string") {
    throw new Error(`Codex plugin ${pluginName} must declare category`);
  }
}

function validateCodexManifest(pluginName, pluginRoot, claudeSkillDirs) {
  const codexManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const codexManifest = readJson(codexManifestPath);
  if (codexManifest.name !== pluginName) {
    throw new Error(`Codex manifest name mismatch: ${path.relative(ROOT, codexManifestPath)}`);
  }
  if (!codexManifest.version || typeof codexManifest.version !== "string") {
    throw new Error(`Codex manifest must declare version: ${path.relative(ROOT, codexManifestPath)}`);
  }
  if (!codexManifest.description || typeof codexManifest.description !== "string") {
    throw new Error(`Codex manifest must declare description: ${path.relative(ROOT, codexManifestPath)}`);
  }
  if (codexManifest.skills !== "./skills/") {
    throw new Error(`Codex manifest must expose ./skills/: ${path.relative(ROOT, codexManifestPath)}`);
  }
  if (!codexManifest.interface?.displayName) {
    throw new Error(`Codex manifest must declare interface.displayName: ${path.relative(ROOT, codexManifestPath)}`);
  }
  if (!codexManifest.interface?.shortDescription) {
    throw new Error(`Codex manifest must declare interface.shortDescription: ${path.relative(ROOT, codexManifestPath)}`);
  }
  assertNoLegacyText(codexManifestPath, fs.readFileSync(codexManifestPath, "utf8"));

  const skillsRoot = path.join(pluginRoot, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Codex skills directory missing: ${path.relative(ROOT, skillsRoot)}`);
  }
  const codexSkillDirs = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const sortedClaudeSkillDirs = [...claudeSkillDirs].sort();
  if (JSON.stringify(codexSkillDirs) !== JSON.stringify(sortedClaudeSkillDirs)) {
    throw new Error(`Claude/Codex skill directory mismatch in ${pluginName}`);
  }
}

function validatePlugin(plugin, codexPlugin) {
  const pluginRoot = path.join(PLUGINS_ROOT, plugin.name);
  const source = plugin.source;
  if (source !== `./plugins/${plugin.name}`) {
    throw new Error(`Claude plugin ${plugin.name} must use source ./plugins/${plugin.name}`);
  }

  validateCodexMarketplaceEntry(plugin.name, codexPlugin);

  const pluginClaudeMarketplacePath = path.join(pluginRoot, ".claude-plugin", "marketplace.json");
  if (fs.existsSync(pluginClaudeMarketplacePath)) {
    throw new Error(`Per-plugin Claude marketplace is not allowed: ${path.relative(ROOT, pluginClaudeMarketplacePath)}`);
  }

  const frontmatterNames = new Set();
  const claudeSkillDirs = [];
  for (const skillRel of plugin.skills) {
    if (!skillRel.startsWith("./skills/")) {
      throw new Error(`Claude skill path must be plugin-local: ${plugin.name} ${skillRel}`);
    }
    const skillDir = path.join(pluginRoot, skillRel.replace(/^\.\//, ""));
    claudeSkillDirs.push(path.basename(skillDir));
    const skillPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      throw new Error(`Missing skill: ${path.relative(ROOT, skillPath)}`);
    }
    const { name, text } = readSkillFrontmatter(skillDir);
    if (frontmatterNames.has(name)) {
      throw new Error(`Duplicate skill name in ${plugin.name}: ${name}`);
    }
    frontmatterNames.add(name);
    if (name !== path.basename(skillDir)) {
      throw new Error(`Skill frontmatter name must match directory: ${path.relative(ROOT, skillDir)}`);
    }
    assertNoLegacyText(skillPath, text);
  }

  validateCodexManifest(plugin.name, pluginRoot, claudeSkillDirs);
  return plugin.skills.length;
}

function validateNoLegacySkillCatalog() {
  const legacy = path.join(ROOT, ["skills", "catalog"].join("-"));
  if (fs.existsSync(legacy)) {
    throw new Error("Legacy flat skills directory must be removed");
  }
}

function validateNoPluginLegacyText() {
  const files = walkFiles(PLUGINS_ROOT, (file) => path.basename(file) === "SKILL.md");
  for (const file of files) {
    assertNoLegacyText(file, fs.readFileSync(file, "utf8"));
  }
}

function validateMcpServerMetadata() {
  const packageDirs = fs
    .readdirSync(MCP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(MCP_ROOT, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "server.json")));

  for (const packageDir of packageDirs) {
    const relDir = path.relative(ROOT, packageDir);
    const serverPath = path.join(packageDir, "server.json");
    const packagePath = path.join(packageDir, "package.json");
    const server = readJson(serverPath);
    const pkg = readJson(packagePath);
    const npmPackage = server.packages?.[0];

    if (typeof server.description !== "string" || server.description.length === 0) {
      throw new Error(`MCP server description is required: ${path.relative(ROOT, serverPath)}`);
    }
    if (server.description.length > MCP_REGISTRY_DESCRIPTION_MAX) {
      throw new Error(`MCP server description exceeds ${MCP_REGISTRY_DESCRIPTION_MAX} chars (${server.description.length}): ${path.relative(ROOT, serverPath)}`);
    }
    if (server.version !== pkg.version) {
      throw new Error(`MCP version mismatch in ${relDir}: server.json ${server.version} != package.json ${pkg.version}`);
    }
    if (npmPackage?.version !== pkg.version) {
      throw new Error(`MCP package version mismatch in ${relDir}: server.json packages[0].version ${npmPackage?.version} != package.json ${pkg.version}`);
    }
    if (npmPackage?.identifier !== pkg.name) {
      throw new Error(`MCP package identifier mismatch in ${relDir}: ${npmPackage?.identifier} != ${pkg.name}`);
    }
  }

  return packageDirs.length;
}

function main() {
  const { claude, codex } = validateRootMarketplaces();
  validateNoLegacySkillCatalog();
  validateNoPluginLegacyText();
  const mcpCount = validateMcpServerMetadata();
  const codexPlugins = new Map(codex.plugins.map((plugin) => [plugin.name, plugin]));
  const skillCount = claude.plugins.reduce((sum, plugin) => sum + validatePlugin(plugin, codexPlugins.get(plugin.name)), 0);
  const sharedCount = validateSharedDistribution();
  console.log(`OK: ${claude.plugins.length} plugins, ${skillCount} skills, ${mcpCount} MCP servers, shared registry distributes ${sharedCount} sources`);
}

main();
