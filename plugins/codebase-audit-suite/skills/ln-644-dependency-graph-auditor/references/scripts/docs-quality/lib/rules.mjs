import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, "..", "..", "..", "references", "docs_quality_rules.json");

export function loadRules() {
    return JSON.parse(readFileSync(RULES_PATH, "utf8"));
}

export function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeRegex(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function globToRegex(pattern) {
    const normalized = normalizePath(pattern);
    const regex = normalized
        .split("**").map(part => part.split("*").map(escapeRegex).join("[^/]*")).join(".*");
    return new RegExp(`^${regex}$`);
}

export function classifyDoc(relPath, rules) {
    const target = normalizePath(relPath);
    for (const rule of rules.pathRules) {
        if (globToRegex(rule.match).test(target)) {
            return rule;
        }
    }
    return null;
}

export function detectStack(projectRoot) {
    const candidates = [
        { name: "dotnet", test: () => readdirSync(projectRoot, { recursive: true }).some(name => String(name).endsWith(".csproj")) },
        { name: "node", test: () => existsSync(join(projectRoot, "package.json")) },
        { name: "python", test: () => existsSync(join(projectRoot, "pyproject.toml")) || existsSync(join(projectRoot, "requirements.txt")) },
        { name: "go", test: () => existsSync(join(projectRoot, "go.mod")) },
        { name: "rust", test: () => existsSync(join(projectRoot, "Cargo.toml")) }
    ];

    for (const candidate of candidates) {
        try {
            if (candidate.test()) return candidate.name;
        } catch {
            // Ignore detection failures and continue.
        }
    }
    return "node";
}
