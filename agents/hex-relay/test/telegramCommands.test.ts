import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TELEGRAM_COMMAND_LIST,
  TELEGRAM_COMMANDS,
  telegramSetMyCommandsPayload,
} from "../src/domain/telegramCommands.js";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

test("telegram command manifest is valid for Telegram Bot API", () => {
  const names = new Set<string>();

  for (const entry of TELEGRAM_COMMAND_LIST) {
    assert.match(entry.command, /^[a-z0-9_]{1,32}$/);
    assert.ok(entry.telegramDescription.length > 0);
    assert.ok(entry.telegramDescription.length <= 256);
    assert.ok(entry.operatorDescription.length > 0);
    assert.equal(names.has(entry.command), false, `duplicate command: ${entry.command}`);
    names.add(entry.command);
  }

  for (const [key, entry] of Object.entries(TELEGRAM_COMMANDS)) {
    assert.equal(entry.command, key);
  }
});

test("telegram setMyCommands payload comes from the command manifest", () => {
  assert.deepEqual(
    telegramSetMyCommandsPayload().commands,
    TELEGRAM_COMMAND_LIST.map(({ command, telegramDescription }) => ({
      command,
      description: telegramDescription,
    }))
  );
});

test("telegram handlers do not hardcode command literals", () => {
  const telegramHandlerDir = join(repoRoot, "agents/hex-relay/src/handlers/telegram");
  const handlerFiles = readdirSync(telegramHandlerDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => join(telegramHandlerDir, fileName));

  for (const filePath of handlerFiles) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /\.command\("[a-z_]+"/, filePath);
  }
});
