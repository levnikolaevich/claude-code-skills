import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const bootstrapRefs = join(
  repoRoot,
  "plugins/setup-environment/skills/ln-030-vps-bootstrap/references"
);

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("Codex god-session hook port is an explicit config requirement", () => {
  const script = readFileSync(join(bootstrapRefs, "scripts/god-session-codex.sh"), "utf8");
  const unit = readFileSync(join(bootstrapRefs, "templates/god-session-codex.service"), "utf8");

  assert.match(script, /RELAY_HOOK_PORT is required/);
  assert.doesNotMatch(script, /RELAY_HOOK_PORT=\$\{RELAY_HOOK_PORT:-8090\}/);
  assert.match(unit, /Environment=RELAY_HOOK_PORT=\$\{RELAY_HOOK_PORT\}/);
});

test("Telegram relay gate is documented as all-or-nothing for hex-relay", () => {
  const secrets = readFileSync(join(bootstrapRefs, "templates/secrets.env.template"), "utf8");
  const deploy = readFileSync(join(bootstrapRefs, "hex_relay_deploy.md"), "utf8");

  assert.match(secrets, /Required when `\$\{SERVICE_PREFIX\}-hex-relay\.service` is deployed/);
  assert.match(deploy, /do not deploy or start `\$\{SERVICE_PREFIX\}-hex-relay\.service`/);
  assert.doesNotMatch(secrets, /optional; leave blank to disable Telegram integration/);
});

test("env docs keep idle vars and remove dead GitHub client id", () => {
  const envExample = read("agents/hex-relay/.env.example");
  const readme = read("agents/hex-relay/README.md");
  const secrets = readFileSync(join(bootstrapRefs, "templates/secrets.env.template"), "utf8");

  for (const name of [
    "RELAY_IDLE_SHUTDOWN_ENABLED",
    "RELAY_IDLE_SHUTDOWN_SEC",
    "RELAY_IDLE_TICK_SEC",
    "RELAY_IDLE_BOOT_GRACE_SEC",
  ]) {
    assert.match(envExample, new RegExp(name));
    assert.match(readme, new RegExp(name));
  }
  assert.doesNotMatch(secrets, /GITHUB_APP_CLIENT_ID/);
});

test("relay HTTP token is propagated through deploy references", () => {
  const substitutions = readFileSync(join(bootstrapRefs, "substitution_rules.md"), "utf8");
  const operatorInstall = readFileSync(
    join(bootstrapRefs, "operator_dispatcher_install.md"),
    "utf8"
  );
  const settingsHooks = JSON.parse(
    readFileSync(join(bootstrapRefs, "settings.hooks.fragment.json"), "utf8")
  ) as { hooks: Record<string, { hooks: { headers?: Record<string, string> }[] }[]> };

  assert.match(substitutions, /\$RELAY_HTTP_TOKEN/);
  assert.match(operatorInstall, /append_env VPS_RELAY_HTTP_TOKEN/);
  assert.match(operatorInstall, /RELAY_HTTP_TOKEN=/);
  assert.match(operatorInstall, /RELAY_HTTP_TOKEN\|DISPATCH_COMMAND_NAME/);

  const hookHeaders = Object.values(settingsHooks.hooks)
    .flat()
    .flatMap((entry) => entry.hooks.map((hook) => hook.headers?.Authorization));
  assert.ok(hookHeaders.length > 0);
  for (const authorization of hookHeaders) {
    assert.equal(authorization, "Bearer ${RELAY_HTTP_TOKEN}");
  }
});

test("protected local API examples include bearer auth", () => {
  const operator = readFileSync(join(bootstrapRefs, "operator.CLAUDE.md"), "utf8");
  const verification = readFileSync(join(bootstrapRefs, "verification_recipes.md"), "utf8");
  const refsReadme = readFileSync(join(bootstrapRefs, "README.md"), "utf8");

  assert.match(operator, /memory\/add[\s\S]*Authorization: Bearer \${RELAY_HTTP_TOKEN}/);
  assert.match(operator, /memory\/recent\?n=20/);
  assert.match(operator, /dispatch\/recent\?n=10/);
  assert.match(operator, /Authorization: Bearer \${RELAY_HTTP_TOKEN}.*dispatch\/recent/s);
  assert.match(verification, /Authorization: Bearer \${RELAY_HTTP_TOKEN}.*\/tasks\/poll/);
  assert.match(refsReadme, /\/hook\/\*/, "README documents protected hook routes");
  assert.match(refsReadme, /Authorization: Bearer \${RELAY_HTTP_TOKEN}/);
});

test("redeploy archive excludes local artifacts and package outputs", () => {
  const redeploy = read("agents/hex-relay/docs/redeploy.md");

  for (const excluded of [".hex-skills", ".codegraph", ".cache", "*.tgz", "*.tsbuildinfo"]) {
    assert.match(redeploy, new RegExp(excluded.replaceAll("*", String.raw`\*`)));
  }
});
