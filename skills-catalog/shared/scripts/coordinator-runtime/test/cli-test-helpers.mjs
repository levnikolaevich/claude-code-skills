import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createProjectRoot(prefix) {
    return mkdtempSync(join(tmpdir(), prefix));
}

export function writeJson(path, value) {
    writeFileSync(path, JSON.stringify(value, null, 2));
}

export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function createJsonCliRunner(cliPath, projectRoot) {
    return function run(args, { allowFailure = false } = {}) {
        try {
            return JSON.parse(execFileSync("node", [cliPath, ...args], {
                cwd: projectRoot,
                encoding: "utf8",
            }));
        } catch (error) {
            if (!allowFailure) {
                throw error;
            }
            const stdout = error.stdout?.toString().trim();
            const stderr = error.stderr?.toString().trim();
            const body = stdout || stderr || "{}";
            return JSON.parse(body);
        }
    };
}
