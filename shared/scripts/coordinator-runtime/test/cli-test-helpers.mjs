import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    const compileCacheDir = join(projectRoot, ".node-compile-cache");
    mkdirSync(compileCacheDir, { recursive: true });
    const env = {
        ...process.env,
        NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE || compileCacheDir,
    };

    return function run(args, { allowFailure = false } = {}) {
        try {
            return JSON.parse(execFileSync(process.execPath, [cliPath, ...args], {
                cwd: projectRoot,
                encoding: "utf8",
                env,
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
