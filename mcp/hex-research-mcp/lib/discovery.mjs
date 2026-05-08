import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function walk(root, base, predicate, out = []) {
    const dir = join(root, base);
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        const rel = base ? `${base}/${name}` : name;
        const abs = join(root, rel);
        const st = statSync(abs);
        if (st.isDirectory()) {
            if (name === "node_modules" || name === ".git" || name === ".hex-skills") continue;
            walk(root, rel, predicate, out);
        } else if (predicate(rel)) {
            out.push(rel.replace(/\\/g, "/"));
        }
    }
    return out;
}

export function discoverResearchFiles(projectPath) {
    const hypotheses = walk(projectPath, "docs/hypotheses", rel => rel.endsWith(".md"));
    const goals = walk(projectPath, "docs/goals", rel => rel.endsWith(".md"));
    const runs = walk(projectPath, "benchmark/runs", rel => /manifest\.ya?ml$/i.test(rel));
    return { hypotheses, goals, runs, all: [...hypotheses, ...goals, ...runs] };
}

export function toRel(projectPath, absPath) {
    return relative(projectPath, absPath).replace(/\\/g, "/");
}

