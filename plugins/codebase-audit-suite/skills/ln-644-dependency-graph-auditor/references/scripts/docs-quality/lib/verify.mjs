import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { classifyDoc, detectStack, loadRules, normalizePath } from "./rules.mjs";

function addFinding(findings, rules, code, file, line, message, hint) {
    findings.push({
        severity: rules.severityByCode[code] || "MEDIUM",
        code,
        location: `${file}:${line}`,
        message,
        hint
    });
}

function lineNumberFor(content, marker) {
    const index = content.indexOf(marker);
    if (index < 0) return 1;
    return content.slice(0, index).split(/\r?\n/).length;
}

function extractMetadata(content, rules) {
    const header = content.split(/\r?\n/).slice(0, rules.metadataWithinFirstLines).join("\n");
    const result = {};
    for (const marker of ["SCOPE", ...rules.metadataMarkers]) {
        const regex = new RegExp(`<!--\\s*${marker}:\\s*([\\s\\S]*?)\\s*-->`, "i");
        const match = header.match(regex);
        if (match) result[marker] = match[1].trim();
    }
    return result;
}

function extractLinks(content) {
    const results = [];
    const regex = /\[[^\]]*]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        results.push({ target: match[1], line: content.slice(0, match.index).split(/\r?\n/).length });
    }
    return results;
}

function extractCodeFences(content) {
    const results = [];
    const regex = /^```([^\n`]*)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const raw = match[1].trim().toLowerCase();
        results.push({ language: raw || "plaintext", line: content.slice(0, match.index).split(/\r?\n/).length });
    }
    return results;
}

function extractDates(content) {
    const results = [];
    const regex = /\b(20\d{2}-\d{2}-\d{2})\b/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        results.push({ value: match[1], line: content.slice(0, match.index).split(/\r?\n/).length });
    }
    return results;
}

function withinAllowlist(relPath, allowlist) {
    return allowlist.includes(normalizePath(relPath));
}

function validateScope(content, relPath, docRule, rules, findings) {
    if (!docRule?.requiresScope) return;
    const firstLines = content.split(/\r?\n/).slice(0, rules.scopeTag.withinFirstLines).join("\n");
    if (!firstLines.includes("<!-- SCOPE:")) {
        addFinding(
            findings,
            rules,
            "MISSING_SCOPE",
            relPath,
            1,
            "Missing SCOPE tag in the first lines of the document.",
            "Add a `<!-- SCOPE: ... -->` comment near the top of the file."
        );
    }
}

function validateMetadata(content, relPath, docRule, rules, findings) {
    if (!docRule?.requiresMetadata) return;
    const metadata = extractMetadata(content, rules);

    for (const marker of rules.metadataMarkers) {
        if (metadata[marker]) continue;
        addFinding(
            findings,
            rules,
            "MISSING_METADATA",
            relPath,
            1,
            `Missing metadata marker: ${marker}.`,
            `Add \`<!-- ${marker}: ... -->\` near the top of the file.`
        );
    }

    if (metadata.DOC_KIND && !rules.allowedDocKinds.includes(metadata.DOC_KIND)) {
        addFinding(findings, rules, "INVALID_DOC_KIND", relPath, 1, `Invalid DOC_KIND: ${metadata.DOC_KIND}`, "Use one of: index, reference, how-to, explanation, record.");
    }
    if (metadata.DOC_ROLE && !rules.allowedDocRoles.includes(metadata.DOC_ROLE)) {
        addFinding(findings, rules, "INVALID_DOC_ROLE", relPath, 1, `Invalid DOC_ROLE: ${metadata.DOC_ROLE}`, "Use one of: canonical, navigation, working, derived.");
    }
    if (docRule?.docKind && metadata.DOC_KIND && metadata.DOC_KIND !== docRule.docKind) {
        addFinding(findings, rules, "MISMATCHED_DOC_KIND", relPath, 1, `DOC_KIND is ${metadata.DOC_KIND}, expected ${docRule.docKind} for this path.`, "Align the document kind with the path contract or move the file.");
    }
    if (docRule?.docRole && metadata.DOC_ROLE && metadata.DOC_ROLE !== docRule.docRole) {
        addFinding(findings, rules, "MISMATCHED_DOC_ROLE", relPath, 1, `DOC_ROLE is ${metadata.DOC_ROLE}, expected ${docRule.docRole} for this path.`, "Align the document role with the path contract.");
    }
}

function validateTopSections(content, relPath, docRule, rules, findings) {
    if (!docRule?.requiresTopSections) return;
    for (const section of rules.requiredTopSections) {
        if (content.includes(section)) continue;
        addFinding(
            findings,
            rules,
            "MISSING_TOP_SECTION",
            relPath,
            1,
            `Missing top section: ${section}.`,
            `Add \`${section}\` near the top of the document.`
        );
    }
}

function validateMaintenance(content, relPath, docRule, rules, findings) {
    if (!docRule?.requiresMaintenance) return;
    if (!content.includes("## Maintenance")) {
        addFinding(
            findings,
            rules,
            "MISSING_MAINTENANCE",
            relPath,
            1,
            "Missing `## Maintenance` section.",
            "Add a Maintenance section with Update Triggers, Verification, and Last Updated."
        );
        return;
    }
    for (const marker of rules.maintenanceMarkers) {
        if (!content.includes(marker)) {
            addFinding(
                findings,
                rules,
                "MISSING_MAINTENANCE",
                relPath,
                lineNumberFor(content, "## Maintenance"),
                `Missing Maintenance marker: ${marker}.`,
                `Add \`${marker}\` inside the Maintenance section.`
            );
        }
    }
}

function validatePlaceholders(content, relPath, rules, findings) {
    const allowPlaceholders = withinAllowlist(relPath, rules.placeholderAllowlist);
    for (const token of rules.placeholderDenylist) {
        if (allowPlaceholders && token !== "{{" && token !== "}}") continue;
        if (!content.includes(token)) continue;
        addFinding(
            findings,
            rules,
            "FORBIDDEN_PLACEHOLDER",
            relPath,
            lineNumberFor(content, token),
            `Forbidden placeholder token found: ${token}`,
            allowPlaceholders
                ? "Replace template markers before finishing the pipeline."
                : "Replace placeholder text with project-specific content."
        );
    }
}

function validateTemplateMetadata(content, relPath, rules, findings) {
    for (const token of rules.templateMetadataDenylist) {
        if (!content.includes(token)) continue;
        addFinding(
            findings,
            rules,
            "FORBIDDEN_TEMPLATE_METADATA",
            relPath,
            lineNumberFor(content, token),
            `Template maintenance metadata leaked into generated documentation: ${token}`,
            "Remove template-only metadata from generated output."
        );
    }
}

function validateLinks(projectRoot, content, relPath, rules, findings) {
    for (const link of extractLinks(content)) {
        if (link.target.startsWith("http://") || link.target.startsWith("https://") || link.target.startsWith("#")) {
            continue;
        }
        const target = normalizePath(link.target.split("#")[0]);
        const resolved = resolve(projectRoot, relPath, "..", target);
        if (!existsSync(resolved)) {
            addFinding(
                findings,
                rules,
                "BROKEN_LINK",
                relPath,
                link.line,
                `Broken internal link: ${link.target}`,
                "Update the link target or create the referenced file."
            );
        }
    }
}

function validateCodeFences(content, relPath, rules, findings) {
    for (const fence of extractCodeFences(content)) {
        if (rules.allowedFenceLanguages.includes(fence.language)) continue;
        addFinding(
            findings,
            rules,
            "DISALLOWED_CODE_FENCE",
            relPath,
            fence.line,
            `Disallowed fenced code block language: ${fence.language}`,
            "Replace implementation code with tables, diagrams, commands, or source links."
        );
    }
}

function validateDates(content, relPath, rules, findings, now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - rules.staleDays);
    for (const date of extractDates(content)) {
        if (content.slice(Math.max(0, content.indexOf(date.value) - 32), content.indexOf(date.value)).includes("Template ")) {
            continue;
        }
        const parsed = new Date(`${date.value}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime())) continue;
        if (parsed >= cutoff) continue;
        addFinding(
            findings,
            rules,
            "STALE_DATE",
            relPath,
            date.line,
            `Stale inline date found: ${date.value}`,
            "Refresh the date or move historical content out of the generated document."
        );
    }
}

function validateOfficialLinks(content, relPath, rules, findings, stack) {
    const allowed = rules.officialDomains[stack] || [];
    if (!allowed.length) return;
    for (const link of extractLinks(content)) {
        if (!link.target.startsWith("http://") && !link.target.startsWith("https://")) continue;
        const host = new URL(link.target).hostname.replace(/^www\./, "");
        const isOfficial = allowed.some(domain => host === domain || host.endsWith(`.${domain}`));
        const isNonDoc = !/docs|guide|learn|reference|manual|api/i.test(link.target);
        if (isOfficial || isNonDoc) continue;
        addFinding(
            findings,
            rules,
            "UNOFFICIAL_STACK_LINK",
            relPath,
            link.line,
            `External documentation link is not on the official allowlist for stack ${stack}: ${link.target}`,
            "Prefer stack-appropriate official documentation domains."
        );
    }
}

function scoreFindings(findings) {
    const penalties = { CRITICAL: 4, HIGH: 2, MEDIUM: 1, LOW: 0.5 };
    const total = findings.reduce((sum, finding) => sum + (penalties[finding.severity] || 0), 0);
    return Math.max(0, Number((10 - total).toFixed(1)));
}

export async function verifyManifest(projectRoot, manifest, options = {}) {
    const rules = loadRules();
    const stack = options.stack || await detectStack(projectRoot);
    const findings = [];
    const files = manifest.files || [];

    for (const entry of files) {
        const relPath = normalizePath(entry.path);
        const fullPath = join(projectRoot, relPath);
        const docRule = classifyDoc(relPath, rules);

        if (!existsSync(fullPath)) {
            addFinding(findings, rules, "MISSING_FILE", relPath, 1, "Expected generated file is missing.", "Re-run the owning creator or fix the manifest.");
            continue;
        }

        if (!docRule) continue;

        const content = readFileSync(fullPath, "utf8");
        validateScope(content, relPath, docRule, rules, findings);
        validateMetadata(content, relPath, docRule, rules, findings);
        validateTopSections(content, relPath, docRule, rules, findings);
        validateMaintenance(content, relPath, docRule, rules, findings);
        validatePlaceholders(content, relPath, rules, findings);
        validateTemplateMetadata(content, relPath, rules, findings);
        validateLinks(projectRoot, content, relPath, rules, findings);
        validateCodeFences(content, relPath, rules, findings);
        validateDates(content, relPath, rules, findings, options.now);
        validateOfficialLinks(content, relPath, rules, findings, stack);
    }

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const finding of findings) counts[finding.severity] += 1;

    return {
        project_root: projectRoot,
        stack,
        score: scoreFindings(findings),
        ok: counts.CRITICAL === 0 && counts.HIGH === 0,
        findings,
        summary: {
            total: findings.length,
            ...counts
        }
    };
}

export function summarizeReport(report) {
    return [
        `Docs quality score: ${report.score}/10`,
        `Issues: ${report.summary.total} (C:${report.summary.CRITICAL} H:${report.summary.HIGH} M:${report.summary.MEDIUM} L:${report.summary.LOW})`,
        report.ok ? "Gate: PASS" : "Gate: FAIL"
    ].join("\n");
}
