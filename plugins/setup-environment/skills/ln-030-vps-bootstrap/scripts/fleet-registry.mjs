#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FIELDS = [
  "environment_id",
  "runtime_kind",
  "vps_host",
  "vps_ssh_key_ref",
  "bot_user",
  "project_name",
  "service_prefix",
  "project_dir",
  "repo_url",
  "repo_ref",
  "target_repo_path",
  "git_provider",
  "repo_slug",
  "relay_hook_port",
];

const RUNTIME_KINDS = new Set(["hex-relay", "openclaw-gateway", "hermes-gateway"]);
const SECRET_VALUE_KEY = /(^|_)(token|secret|password|private_key|api_key)$/i;
const SECRET_REF_KEY = /(_ref|_path|_file|_env)$/i;

export function parseFlatYaml(source, filePath = "<inline>") {
  const data = {};
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "---") continue;
    if (/^\s+-\s+/.test(raw)) continue;

    const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!match) {
      throw new Error(`${filePath}:${index + 1}: unsupported YAML line; use flat key: value pairs`);
    }

    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`${filePath}:${index + 1}: duplicate key ${key}`);
    }

    data[key] = normalizeScalar(rawValue);
  }

  return data;
}

function normalizeScalar(rawValue) {
  const value = stripInlineComment(rawValue).trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stripInlineComment(value) {
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if ((char === '"' || char === "'") && value[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === "#" && quote === null && /\s/.test(value[i - 1] ?? " ")) {
      return value.slice(0, i);
    }
  }
  return value;
}

export function validateEnvironment(entry, filePath = "<inline>") {
  const errors = [];
  const warnings = [];

  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === "") {
      errors.push(`${filePath}: missing required field ${field}`);
    }
  }

  if (entry.runtime_kind && !RUNTIME_KINDS.has(String(entry.runtime_kind))) {
    errors.push(`${filePath}: unknown runtime_kind ${entry.runtime_kind}`);
  }

  const port = Number(entry.relay_hook_port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`${filePath}: relay_hook_port must be an integer from 1 to 65535`);
  }

  if (entry.telegram_enabled !== false && entry.runtime_kind === "hex-relay") {
    for (const field of ["telegram_bot_token_ref", "telegram_chat_id_ref"]) {
      if (entry[field] === undefined || entry[field] === "") {
        errors.push(`${filePath}: ${field} is required when telegram_enabled is not false`);
      }
    }
  }

  for (const [key, value] of Object.entries(entry)) {
    if (SECRET_VALUE_KEY.test(key) && !SECRET_REF_KEY.test(key)) {
      errors.push(`${filePath}: ${key} looks like a secret value field; use a *_ref field`);
    }
    if (typeof value === "string" && /bot\d*:[A-Za-z0-9_-]{20,}|[0-9]{6,}:[A-Za-z0-9_-]{20,}/.test(value)) {
      errors.push(`${filePath}: ${key} appears to contain a Telegram token value`);
    }
  }

  return { errors, warnings };
}

export function validateRegistry(entries) {
  const errors = [];
  const warnings = [];
  const seen = new Map();

  const addUnique = (scope, key, filePath) => {
    if (!key) return;
    const composite = `${scope}:${key}`;
    const existing = seen.get(composite);
    if (existing) {
      errors.push(`${filePath}: duplicate ${scope} ${key}; first seen in ${existing}`);
    } else {
      seen.set(composite, filePath);
    }
  };

  for (const { entry, filePath } of entries) {
    const result = validateEnvironment(entry, filePath);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    const host = entry.vps_host;
    addUnique("environment_id", entry.environment_id, filePath);
    addUnique("host+service_prefix", host && entry.service_prefix ? `${host}/${entry.service_prefix}` : "", filePath);
    addUnique("host+relay_hook_port", host && entry.relay_hook_port ? `${host}/${entry.relay_hook_port}` : "", filePath);
    addUnique("host+project_name", host && entry.project_name ? `${host}/${entry.project_name}` : "", filePath);
    addUnique("host+project_dir", host && entry.project_dir ? `${host}/${entry.project_dir}` : "", filePath);
  }

  return { ok: errors.length === 0, errors, warnings, count: entries.length };
}

export function loadRegistry(registryPath) {
  const stat = fs.statSync(registryPath);
  const files = stat.isDirectory()
    ? fs
        .readdirSync(registryPath)
        .filter((name) => /\.ya?ml$/i.test(name))
        .sort()
        .map((name) => path.join(registryPath, name))
    : [registryPath];

  return files.map((filePath) => ({
    filePath,
    entry: parseFlatYaml(fs.readFileSync(filePath, "utf8"), filePath),
  }));
}

function printResult(result) {
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    return 1;
  }
  console.log(`fleet registry: PASS (${result.count} environment${result.count === 1 ? "" : "s"})`);
  return 0;
}

const DEFAULT_REGISTRY_PATH = "/etc/agent-fleet/environments";

function main(argv) {
  const [command, registryPath = DEFAULT_REGISTRY_PATH] = argv;
  if (command !== "validate") {
    console.error(`Usage: node fleet-registry.mjs validate [${DEFAULT_REGISTRY_PATH}]`);
    return 2;
  }

  const entries = loadRegistry(registryPath);
  return printResult(validateRegistry(entries));
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  process.exitCode = main(process.argv.slice(2));
}
