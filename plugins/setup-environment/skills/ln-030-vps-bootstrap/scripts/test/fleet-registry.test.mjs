#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadRegistry, validateRegistry } from "../fleet-registry.mjs";

function writeEnv(dir, name, overrides = {}) {
  const base = {
    environment_id: name,
    runtime_kind: "hex-relay",
    vps_host: "203.0.113.42",
    vps_ssh_key_ref: "~/.ssh/example",
    bot_user: "agent-bot",
    project_name: name,
    service_prefix: name,
    project_dir: `/opt/${name}`,
    repo_url: `https://github.com/example/${name}.git`,
    repo_ref: "main",
    target_repo_path: `D:\\Development\\example\\${name}`,
    git_provider: "github",
    repo_slug: `example/${name}`,
    relay_hook_port: String(overrides.relay_hook_port ?? 9999),
    telegram_enabled: "true",
    telegram_bot_token_ref: `/etc/${name}/secrets.env:TELEGRAM_BOT_TOKEN`,
    telegram_chat_id_ref: `/etc/${name}/secrets.env:TELEGRAM_CHAT_ID`,
    ...overrides,
  };

  const body = Object.entries(base)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  fs.writeFileSync(path.join(dir, `${name}.yaml`), `${body}\n`);
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-registry-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

withTempDir((dir) => {
  writeEnv(dir, "alpha");
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.count, 1);
});

withTempDir((dir) => {
  writeEnv(dir, "alpha");
  writeEnv(dir, "beta", { service_prefix: "alpha", relay_hook_port: 10000 });
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate host\+service_prefix/);
});

withTempDir((dir) => {
  writeEnv(dir, "alpha");
  writeEnv(dir, "beta", { relay_hook_port: 9999 });
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate host\+relay_hook_port/);
});

withTempDir((dir) => {
  writeEnv(dir, "alpha", { runtime_kind: "unknown-runtime" });
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown runtime_kind/);
});

withTempDir((dir) => {
  writeEnv(dir, "alpha", { telegram_bot_token_ref: "" });
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /telegram_bot_token_ref is required/);
});

withTempDir((dir) => {
  const fakeTelegramToken = ["123456", "ABCdefghijklmnopqrstuvwxyz"].join(":");
  writeEnv(dir, "alpha", { telegram_bot_token: fakeTelegramToken });
  const result = validateRegistry(loadRegistry(dir));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /secret value field|Telegram token value/);
});

console.log("fleet registry tests: PASS");
