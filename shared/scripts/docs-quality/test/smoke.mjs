import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildManifest } from "../lib/manifest.mjs";
import { summarizeReport, verifyManifest } from "../lib/verify.mjs";

const tempDirs = [];

function createProject(name, files) {
    const root = mkdtempSync(join(tmpdir(), `${name}-`));
    tempDirs.push(root);
    for (const [relative, content] of Object.entries(files)) {
        const full = join(root, relative);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, content, "utf8");
    }
    return root;
}

function maintenance(date = "2026-03-26") {
    return [
        "## Maintenance",
        "",
        "**Update Triggers:**",
        "- Project structure changes",
        "",
        "**Verification:**",
        "- [ ] Links checked",
        "",
        `**Last Updated:** ${date}`
    ].join("\n");
}

function header({ scope, kind, role, readWhen, skipWhen, sources }) {
    return [
        `<!-- SCOPE: ${scope} -->`,
        `<!-- DOC_KIND: ${kind} -->`,
        `<!-- DOC_ROLE: ${role} -->`,
        `<!-- READ_WHEN: ${readWhen} -->`,
        `<!-- SKIP_WHEN: ${skipWhen} -->`,
        `<!-- PRIMARY_SOURCES: ${sources.join(", ")} -->`
    ].join("\n");
}

function topSections() {
    return [
        "## Quick Navigation",
        "",
        "- [Docs](docs/README.md)",
        "",
        "## Agent Entry",
        "",
        "- Purpose: Route the reader to the right canonical doc",
        "- Read when: You need the next canonical source",
        "- Skip when: You already know the exact target doc",
        "- Canonical: Yes",
        "- Read next: docs/README.md",
        "- Primary sources: AGENTS.md, docs/README.md"
    ].join("\n");
}

afterEach(() => {
    while (tempDirs.length) {
        rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
});

describe("docs-quality verifier", () => {
    it("passes a minimal backend project", async () => {
        const root = createProject("docs-quality-backend", {
            "package.json": JSON.stringify({ name: "demo" }),
            "AGENTS.md": `# Demo\n\n${header({ scope: "Entry point for project docs ONLY.", kind: "index", role: "canonical", readWhen: "You need the repo map.", skipWhen: "You already know the target doc.", sources: ["AGENTS.md", "docs/README.md"] })}\n\n${topSections()}\n\n${maintenance()}\n`,
            "CLAUDE.md": `# Demo Claude\n\n${header({ scope: "Anthropic compatibility shim ONLY.", kind: "index", role: "derived", readWhen: "You are in Claude-compatible tools.", skipWhen: "AGENTS.md is already loaded.", sources: ["AGENTS.md"] })}\n\n## Quick Navigation\n\n- [AGENTS](AGENTS.md)\n\n## Agent Entry\n\n- Purpose: Thin compatibility wrapper\n- Read when: Tooling expects CLAUDE.md\n- Skip when: AGENTS.md is already loaded\n- Canonical: No\n- Read next: AGENTS.md\n- Primary sources: AGENTS.md\n\n${maintenance()}\n`,
            "docs/README.md": `# Docs\n\n${header({ scope: "Documentation hub ONLY.", kind: "index", role: "canonical", readWhen: "You need doc routing.", skipWhen: "You already know the target doc.", sources: ["docs/README.md", "docs/project/architecture.md"] })}\n\n## Quick Navigation\n\n- [Architecture](project/architecture.md)\n\n## Agent Entry\n\n- Purpose: Route to canonical docs\n- Read when: You need the documentation map\n- Skip when: You already know the exact canonical doc\n- Canonical: Yes\n- Read next: docs/project/architecture.md\n- Primary sources: docs/README.md, docs/project/architecture.md\n\n${maintenance()}\n`,
            "docs/project/architecture.md": `# Architecture\n\n${header({ scope: "System architecture ONLY.", kind: "explanation", role: "canonical", readWhen: "You need architecture rationale.", skipWhen: "You only need exact API or config facts.", sources: ["src/", "package.json"] })}\n\n## Quick Navigation\n\n- [Docs](../README.md)\n\n## Agent Entry\n\n- Purpose: Explain system structure and rationale\n- Read when: You need the mental model of the system\n- Skip when: You only need exact endpoint or schema lookup\n- Canonical: Yes\n- Read next: ../tech_stack.md\n- Primary sources: src/, package.json\n\nSee [Node.js Docs](https://nodejs.org/docs/latest/api/).\n\n\`\`\`mermaid\ngraph TD\nA-->B\n\`\`\`\n\n${maintenance()}\n`
        });
        const report = await verifyManifest(root, buildManifest(root), { now: new Date("2026-03-26T00:00:00Z") });
        assert.equal(report.ok, true);
        assert.equal(report.summary.HIGH, 0);
        assert.equal(report.summary.CRITICAL, 0);
    });

    it("passes a fullstack project and allows task placeholders only in allowlisted files", async () => {
        const root = createProject("docs-quality-fullstack", {
            "package.json": JSON.stringify({ name: "demo", dependencies: { react: "^19.0.0" } }),
            "AGENTS.md": `# Demo\n\n${header({ scope: "Entry point for project docs ONLY.", kind: "index", role: "canonical", readWhen: "You need the repo map.", skipWhen: "You already know the target doc.", sources: ["AGENTS.md", "docs/README.md"] })}\n\n${topSections()}\n\n${maintenance()}\n`,
            "CLAUDE.md": `# Demo\n\n${header({ scope: "Anthropic compatibility shim ONLY.", kind: "index", role: "derived", readWhen: "Tooling expects CLAUDE.md.", skipWhen: "AGENTS.md is already loaded.", sources: ["AGENTS.md"] })}\n\n## Quick Navigation\n\n- [AGENTS](AGENTS.md)\n\n## Agent Entry\n\n- Purpose: Thin compatibility wrapper\n- Read when: Tooling expects CLAUDE.md\n- Skip when: AGENTS.md is already loaded\n- Canonical: No\n- Read next: AGENTS.md\n- Primary sources: AGENTS.md\n\n${maintenance()}\n`,
            "docs/README.md": `# Docs\n\n${header({ scope: "Documentation hub ONLY.", kind: "index", role: "canonical", readWhen: "You need doc routing.", skipWhen: "You already know the target doc.", sources: ["docs/README.md", "docs/tasks/README.md"] })}\n\n## Quick Navigation\n\n- [Tasks](tasks/README.md)\n\n## Agent Entry\n\n- Purpose: Route to canonical docs\n- Read when: You need the doc map\n- Skip when: You already know the destination doc\n- Canonical: Yes\n- Read next: tasks/README.md\n- Primary sources: docs/README.md, docs/tasks/README.md\n\n${maintenance()}\n`,
            "docs/project/tech_stack.md": `# Stack\n\n${header({ scope: "Technology stack ONLY.", kind: "reference", role: "canonical", readWhen: "You need exact stack facts.", skipWhen: "You need high-level architecture only.", sources: ["package.json"] })}\n\n## Quick Navigation\n\n- [Docs](../README.md)\n\n## Agent Entry\n\n- Purpose: Reference current technology choices\n- Read when: You need versions, frameworks, and tooling facts\n- Skip when: You only need routing\n- Canonical: Yes\n- Read next: ../README.md\n- Primary sources: package.json\n\nSee [React Docs](https://react.dev/).\n\n${maintenance()}\n`,
            "docs/tasks/README.md": `# Tasks\n\n${header({ scope: "Task workflow ONLY.", kind: "index", role: "canonical", readWhen: "You need task workflow rules.", skipWhen: "You only need the live board.", sources: [".hex-skills/environment_state.json", "docs/tasks/kanban_board.md"] })}\n\n## Quick Navigation\n\n- [Kanban](kanban_board.md)\n\n## Agent Entry\n\n- Purpose: Define task workflow and routing\n- Read when: You need task-management rules\n- Skip when: You only need current task state\n- Canonical: Yes\n- Read next: kanban_board.md\n- Primary sources: .hex-skills/environment_state.json, docs/tasks/kanban_board.md\n\nWorkspace: [TBD: Set workspace]\n\n${maintenance()}\n`,
            "docs/tasks/kanban_board.md": `# Kanban\n\n${header({ scope: "Quick navigation to active tasks ONLY.", kind: "how-to", role: "working", readWhen: "You need current task state.", skipWhen: "You need workflow rules.", sources: ["docs/tasks/README.md"] })}\n\n## Quick Navigation\n\n- [Task Workflow](README.md)\n\n## Agent Entry\n\n- Purpose: Provide live task navigation\n- Read when: You need current work state and task links\n- Skip when: You need stable workflow rules\n- Canonical: No\n- Read next: README.md\n- Primary sources: docs/tasks/README.md\n\nTeam: [TBD: Set team]\n\n${maintenance()}\n`
        });
        const report = await verifyManifest(root, buildManifest(root), { now: new Date("2026-03-26T00:00:00Z") });
        assert.equal(report.ok, true);
        assert.equal(report.summary.HIGH, 0);
    });

    it("passes a minimal library project", async () => {
        const root = createProject("docs-quality-library", {
            "package.json": JSON.stringify({ name: "lib-demo", type: "module" }),
            "AGENTS.md": `# Library\n\n${header({ scope: "Entry point for project docs ONLY.", kind: "index", role: "canonical", readWhen: "You need the repo map.", skipWhen: "You already know the target doc.", sources: ["AGENTS.md", "docs/README.md"] })}\n\n${topSections()}\n\n${maintenance()}\n`,
            "CLAUDE.md": `# Library\n\n${header({ scope: "Anthropic compatibility shim ONLY.", kind: "index", role: "derived", readWhen: "Tooling expects CLAUDE.md.", skipWhen: "AGENTS.md is already loaded.", sources: ["AGENTS.md"] })}\n\n## Quick Navigation\n\n- [AGENTS](AGENTS.md)\n\n## Agent Entry\n\n- Purpose: Thin compatibility wrapper\n- Read when: Tooling expects CLAUDE.md\n- Skip when: AGENTS.md is already loaded\n- Canonical: No\n- Read next: AGENTS.md\n- Primary sources: AGENTS.md\n\n${maintenance()}\n`,
            "docs/README.md": `# Docs\n\n${header({ scope: "Documentation hub ONLY.", kind: "index", role: "canonical", readWhen: "You need doc routing.", skipWhen: "You already know the target doc.", sources: ["docs/README.md", "docs/principles.md"] })}\n\n## Quick Navigation\n\n- [Principles](principles.md)\n\n## Agent Entry\n\n- Purpose: Route to canonical docs\n- Read when: You need the documentation map\n- Skip when: You already know the target doc\n- Canonical: Yes\n- Read next: principles.md\n- Primary sources: docs/README.md, docs/principles.md\n\n${maintenance()}\n`,
            "docs/principles.md": `# Principles\n\n${header({ scope: "Core principles ONLY.", kind: "explanation", role: "canonical", readWhen: "You need project principles and rationale.", skipWhen: "You need exact API or config facts.", sources: ["docs/principles.md"] })}\n\n## Quick Navigation\n\n- [Docs](README.md)\n\n## Agent Entry\n\n- Purpose: Explain project principles and tradeoffs\n- Read when: You need architectural and behavioral guidance\n- Skip when: You need only routing\n- Canonical: Yes\n- Read next: README.md\n- Primary sources: docs/principles.md\n\nUse [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript).\n\n${maintenance()}\n`
        });
        const report = await verifyManifest(root, buildManifest(root), { now: new Date("2026-03-26T00:00:00Z") });
        assert.equal(report.ok, true);
    });

    it("fails on missing metadata, missing sections, placeholders, broken links, stale dates, and implementation code fences", async () => {
        const root = createProject("docs-quality-negative", {
            "package.json": JSON.stringify({ name: "bad-demo" }),
            "AGENTS.md": `# Bad Demo\n\nSee [Missing](docs/README.md).\n\n## Maintenance\n\n**Verification:**\n- [ ] Missing scope and stale date\n\n**Last Updated:** 2025-01-01\n`,
            "CLAUDE.md": `# Bad Claude\n\n${header({ scope: "Anthropic compatibility shim ONLY.", kind: "index", role: "derived", readWhen: "Tooling expects CLAUDE.md.", skipWhen: "AGENTS.md is already loaded.", sources: ["AGENTS.md"] })}\n\n## Quick Navigation\n\n- [AGENTS](AGENTS.md)\n\n## Agent Entry\n\n- Purpose: Wrapper\n- Read when: Needed\n- Skip when: Not needed\n- Canonical: No\n- Read next: AGENTS.md\n- Primary sources: AGENTS.md\n\n${maintenance()}\n`,
            "docs/README.md": `# Docs\n\nSee [Nowhere](project/missing.md).\n\n{{PROJECT_NAME}}\n\n\`\`\`ts\nexport const broken = true;\n\`\`\`\n\n${maintenance("2025-01-01")}\n`
        });
        const report = await verifyManifest(root, buildManifest(root), { now: new Date("2026-03-26T00:00:00Z") });
        assert.equal(report.ok, false);
        assert.ok(report.findings.some(item => item.code === "MISSING_SCOPE"));
        assert.ok(report.findings.some(item => item.code === "MISSING_METADATA"));
        assert.ok(report.findings.some(item => item.code === "MISSING_TOP_SECTION"));
        assert.ok(report.findings.some(item => item.code === "BROKEN_LINK"));
        assert.ok(report.findings.some(item => item.code === "FORBIDDEN_PLACEHOLDER"));
        assert.ok(report.findings.some(item => item.code === "DISALLOWED_CODE_FENCE"));
        assert.match(summarizeReport(report), /Gate: FAIL/);
    });
});
