#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(__dirname, "..");
const npmCli = process.env.npm_execpath;

function npmStep(label, args) {
  return npmCli
    ? [label, process.execPath, [npmCli, ...args]]
    : [label, "npm", args];
}

const runtimeSteps = [
  ["shared registry", process.execPath, ["../tools/marketplace/shared.mjs", "validate"]],
  ["marketplace validation", process.execPath, ["../tools/marketplace/validate.mjs"]],
  npmStep("hex-line check", ["--workspace", "@levnikolaevich/hex-line-mcp", "run", "check"]),
  npmStep("hex-line lint", ["--workspace", "@levnikolaevich/hex-line-mcp", "run", "lint"]),
  npmStep("hex-line test", ["--workspace", "@levnikolaevich/hex-line-mcp", "test"]),
  npmStep("hex-graph check", ["--workspace", "@levnikolaevich/hex-graph-mcp", "run", "check"]),
  npmStep("hex-graph lint", ["--workspace", "@levnikolaevich/hex-graph-mcp", "run", "lint"]),
  npmStep("hex-graph test", ["--workspace", "@levnikolaevich/hex-graph-mcp", "test"]),
  npmStep("hex-ssh check", ["--workspace", "@levnikolaevich/hex-ssh-mcp", "run", "check"]),
  npmStep("hex-ssh lint", ["--workspace", "@levnikolaevich/hex-ssh-mcp", "run", "lint"]),
  npmStep("hex-ssh test", ["--workspace", "@levnikolaevich/hex-ssh-mcp", "test"]),
  npmStep("hex-common test", ["--workspace", "@levnikolaevich/hex-common", "test"]),
  npmStep("hex-research check", ["--workspace", "@levnikolaevich/hex-research-mcp", "run", "check"]),
  npmStep("hex-research lint", ["--workspace", "@levnikolaevich/hex-research-mcp", "run", "lint"]),
  npmStep("hex-research test", ["--workspace", "@levnikolaevich/hex-research-mcp", "test"]),
  npmStep("hex-research evals", ["--workspace", "@levnikolaevich/hex-research-mcp", "run", "evals"]),
  npmStep("hex-research benchmark", ["--workspace", "@levnikolaevich/hex-research-mcp", "run", "benchmark"]),
  npmStep("hex-research docs quality", ["--workspace", "@levnikolaevich/hex-research-mcp", "run", "docs:quality:check"]),
];

const interopSteps = [
  npmStep("hex-ssh interop", ["--workspace", "@levnikolaevich/hex-ssh-mcp", "run", "test:interop"]),
];

function runSteps(steps) {
  for (const [label, command, args] of steps) {
    console.log(`\n[ci] ${label}`);
    const result = spawnSync(command, args, { cwd: MCP_ROOT, stdio: "inherit", shell: process.platform === "win32" && command === "npm" });
    if (result.error) {
      console.error(`[ci] ${label} failed to start: ${result.error.message}`);
      process.exit(1);
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

const mode = process.argv[2] || "local";
if (mode === "runtime") {
  runSteps(runtimeSteps);
} else if (mode === "interop") {
  runSteps(interopSteps);
} else if (mode === "local") {
  runSteps(runtimeSteps);
  runSteps(interopSteps);
} else {
  console.error("Usage: node scripts/ci.mjs [runtime|interop|local]");
  process.exit(2);
}
