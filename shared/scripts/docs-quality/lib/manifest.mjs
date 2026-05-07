import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { classifyDoc, loadRules, normalizePath } from "./rules.mjs";

function walkMarkdown(root, current, files) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
            continue;
        }
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
            walkMarkdown(root, full, files);
            continue;
        }
        if (!entry.name.endsWith(".md")) continue;
        files.push(normalizePath(relative(root, full)));
    }
}

export function collectDocFiles(projectRoot) {
    const candidates = [
        "CLAUDE.md",
        "docs",
        "tests/README.md"
    ];
    const collected = [];
    for (const candidate of candidates) {
        const full = join(projectRoot, candidate);
        if (!existsSync(full)) continue;
        const stats = statSync(full);
        if (stats.isDirectory()) {
            walkMarkdown(projectRoot, full, collected);
        } else if (candidate.endsWith(".md")) {
            collected.push(normalizePath(candidate));
        }
    }
    return [...new Set(collected)].sort();
}

function extractMetadata(content, rules) {
    const header = content.split(/\r?\n/).slice(0, rules.metadataWithinFirstLines).join("\n");
    const markers = ["SCOPE", ...rules.metadataMarkers];
    const metadata = {};
    for (const marker of markers) {
        const regex = new RegExp(`<!--\\s*${marker}:\\s*([\\s\\S]*?)\\s*-->`, "i");
        const match = header.match(regex);
        if (match) metadata[marker] = match[1].trim();
    }
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(20\d{2}-\d{2}-\d{2})/i);
    const sections = rules.requiredTopSections.filter(section => content.includes(section)).map(section => section.replace(/^##\s+/, ""));
    return {
        scope: metadata.SCOPE || "",
        doc_kind: metadata.DOC_KIND || "",
        doc_role: metadata.DOC_ROLE || "",
        read_when: metadata.READ_WHEN || "",
        skip_when: metadata.SKIP_WHEN || "",
        primary_sources: (metadata.PRIMARY_SOURCES || "")
            .split(",")
            .map(item => normalizePath(item.trim()))
            .filter(Boolean),
        key_sections: sections,
        last_updated: lastUpdatedMatch ? lastUpdatedMatch[1] : ""
    };
}

export function buildManifest(projectRoot, explicitFiles = null, options = {}) {
    const rules = loadRules();
    const owners = options.owners || {};
    const files = (explicitFiles && explicitFiles.length ? explicitFiles : collectDocFiles(projectRoot))
        .map(normalizePath)
        .sort();

    return {
        project_root: projectRoot,
        created_at: new Date().toISOString(),
        files: files.map(path => ({
            path,
            class: classifyDoc(path, rules)?.class || "other",
            owner: owners[path] || null,
            ...(existsSync(join(projectRoot, path)) ? extractMetadata(readFileSync(join(projectRoot, path), "utf8"), rules) : {})
        }))
    };
}

export function buildRegistry(projectRoot, manifest, owners = {}) {
    const rules = loadRules();
    return {
        project_root: projectRoot,
        generated_at: new Date().toISOString(),
        docs: (manifest.files || []).map(entry => {
            const docRule = classifyDoc(entry.path, rules);
            return {
                path: normalizePath(entry.path),
                doc_kind: entry.doc_kind || docRule?.docKind || null,
                doc_role: entry.doc_role || docRule?.docRole || null,
                owner: owners[normalizePath(entry.path)] || entry.owner || null,
                primary_sources: entry.primary_sources || [],
                key_sections: entry.key_sections || [],
                last_updated: entry.last_updated || null
            };
        })
    };
}
