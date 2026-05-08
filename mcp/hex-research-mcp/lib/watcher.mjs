import { watch } from "chokidar";
import { resolve } from "node:path";
import { indexProject } from "./indexer.mjs";
import { RESEARCHGRAPH_DIR } from "./constants.mjs";

const _watchers = new Map();

export function watchProject(projectPath) {
    const absPath = resolve(projectPath);
    if (_watchers.has(absPath)) return `Watcher already active for ${absPath}`;
    const watcher = watch([
        `${absPath}/docs/hypotheses/**/*.md`,
        `${absPath}/docs/goals/**/*.md`,
        `${absPath}/benchmark/runs/**/manifest.y*ml`,
    ], {
        ignored: [`**/${RESEARCHGRAPH_DIR}/**`, "**/node_modules/**", "**/.git/**"],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    let timer = null;
    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            try { indexProject(absPath); }
            catch (error) { process.stderr.write(`researchgraph watcher: ${error.message}\n`); }
        }, 500);
    };
    watcher.on("change", schedule).on("add", schedule).on("unlink", schedule);
    _watchers.set(absPath, watcher);
    return `Watcher started for ${absPath}`;
}

