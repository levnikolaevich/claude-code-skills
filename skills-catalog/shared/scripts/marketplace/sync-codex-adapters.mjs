#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../../..");
const CLAUDE_MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const CODEX_MARKETPLACE = path.join(ROOT, ".agents", "plugins", "marketplace.json");
const PLUGINS_ROOT = path.join(ROOT, "plugins");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function toDisplayName(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readSkillFrontmatter(skillDir) {
  const skillPath = path.join(ROOT, skillDir, "SKILL.md");
  const text = fs.readFileSync(skillPath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Missing frontmatter: ${skillDir}/SKILL.md`);
  }
  const name = match[1].match(/^name:\s*["']?([^"'\r\n]+)["']?$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim()?.replace(/^["']|["']$/g, "");
  if (!name || !description) {
    throw new Error(`Missing name/description: ${skillDir}/SKILL.md`);
  }
  return { name, description };
}

function wrapperFor(skillDir) {
  const { name, description } = readSkillFrontmatter(skillDir);
  return `---\nname: ${name}\ndescription: "${description.replaceAll("\"", "\\\"")}"\nlicense: MIT\n---\n\n> **Paths:** This is a Codex-native adapter. Load canonical files relative to the skills repo root.\n\n# ${name} Codex Adapter\n\n## Mandatory Read\n\n**MANDATORY READ:** Load \`${skillDir}/SKILL.md\`.\n\n## Workflow\n\n1. Load the canonical skill file listed above.\n2. Follow the canonical skill exactly.\n3. Treat this adapter as discovery metadata only; do not duplicate or override canonical instructions.\n\n## Definition of Done\n\n- [ ] Canonical skill loaded\n- [ ] Canonical workflow followed\n- [ ] Result reported per canonical skill contract\n\n**Version:** 1.0.0\n**Last Updated:** 2026-04-24\n`;
}

function sync() {
  const marketplace = readJson(CLAUDE_MARKETPLACE);
  const codexPlugins = [];
  const seenSkills = new Set();
  const duplicateSkills = [];

  for (const plugin of marketplace.plugins) {
    const pluginRoot = path.join(PLUGINS_ROOT, plugin.name);
    const adaptersRoot = path.join(pluginRoot, "skills");

    for (const skillRel of plugin.skills || []) {
      const normalized = skillRel.replace(/^\.\//, "").replaceAll("\\", "/");
      const skillPath = path.join(ROOT, normalized, "SKILL.md");
      if (!fs.existsSync(skillPath)) {
        throw new Error(`Missing skill from ${plugin.name}: ${normalized}`);
      }
      const { name } = readSkillFrontmatter(normalized);
      if (seenSkills.has(`${plugin.name}:${name}`)) {
        duplicateSkills.push(`${plugin.name}:${name}`);
      }
      seenSkills.add(`${plugin.name}:${name}`);
      const adapterPath = path.join(adaptersRoot, name, "SKILL.md");
      fs.mkdirSync(path.dirname(adapterPath), { recursive: true });
      fs.writeFileSync(adapterPath, wrapperFor(normalized), "utf8");
    }

    writeJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), {
      name: plugin.name,
      version: "1.0.0",
      description: plugin.description,
      author: marketplace.owner,
      homepage: `https://github.com/levnikolaevich/claude-code-skills/blob/main/docs/plugins/${plugin.name}.md`,
      repository: "https://github.com/levnikolaevich/claude-code-skills",
      license: "MIT",
      keywords: ["codex", "skills", plugin.name],
      skills: "./skills/",
      interface: {
        displayName: toDisplayName(plugin.name),
        shortDescription: plugin.description,
        longDescription: plugin.description,
        developerName: marketplace.owner?.name || "Lev Nikolaevich",
        category: "Productivity",
        capabilities: ["Interactive", "Write"],
        websiteURL: "https://github.com/levnikolaevich/claude-code-skills",
        defaultPrompt: [
          `Use ${plugin.name} for this repository.`,
          `Run the ${plugin.name} workflow.`,
        ],
        brandColor: "#2563EB",
      },
    });

    codexPlugins.push({
      name: plugin.name,
      source: {
        source: "local",
        path: `./plugins/${plugin.name}`,
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Productivity",
    });
  }

  if (duplicateSkills.length) {
    throw new Error(`Duplicate adapter skills: ${duplicateSkills.join(", ")}`);
  }

  writeJson(CODEX_MARKETPLACE, {
    name: marketplace.name,
    interface: {
      displayName: "Lev Nikolaevich Skills Marketplace",
    },
    plugins: codexPlugins,
  });
}

function validate() {
  const claude = readJson(CLAUDE_MARKETPLACE);
  const codex = readJson(CODEX_MARKETPLACE);
  const claudeNames = claude.plugins.map((plugin) => plugin.name).sort();
  const codexNames = codex.plugins.map((plugin) => plugin.name).sort();

  if (JSON.stringify(claudeNames) !== JSON.stringify(codexNames)) {
    throw new Error(`Claude/Codex plugin mismatch: ${claudeNames.join(", ")} != ${codexNames.join(", ")}`);
  }

  for (const plugin of claude.plugins) {
    const manifestPath = path.join(PLUGINS_ROOT, plugin.name, ".codex-plugin", "plugin.json");
    const manifest = readJson(manifestPath);
    if (manifest.name !== plugin.name) {
      throw new Error(`Codex manifest name mismatch: ${manifestPath}`);
    }
    if (manifest.skills !== "./skills/") {
      throw new Error(`Codex manifest must expose only local adapters: ${manifestPath}`);
    }
    const adapterNames = new Set();
    for (const skillRel of plugin.skills || []) {
      const normalized = skillRel.replace(/^\.\//, "").replaceAll("\\", "/");
      const { name } = readSkillFrontmatter(normalized);
      const adapterPath = path.join(PLUGINS_ROOT, plugin.name, "skills", name, "SKILL.md");
      if (!fs.existsSync(adapterPath)) {
        throw new Error(`Missing Codex adapter: ${adapterPath}`);
      }
      if (adapterNames.has(name)) {
        throw new Error(`Duplicate adapter in plugin ${plugin.name}: ${name}`);
      }
      adapterNames.add(name);
    }
  }

  console.log(`OK: ${codex.plugins.length} Codex plugin adapters match Claude marketplace`);
}

const command = process.argv[2] || "sync";
if (command === "sync") {
  sync();
  validate();
} else if (command === "validate") {
  validate();
} else {
  console.error("Usage: node sync-codex-adapters.mjs [sync|validate]");
  process.exit(2);
}
