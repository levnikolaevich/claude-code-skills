import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { semanticGitDiff } from "../src/git/semantic-diff.mjs";

function git(cwd, args) {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).replace(/\r\n/g, "\n");
}

function configureGitLf(cwd) {
    git(cwd, ["config", "core.autocrlf", "false"]);
    git(cwd, ["config", "core.eol", "lf"]);
    git(cwd, ["config", "core.safecrlf", "false"]);
}

test("semanticGitDiff reports added, removed, modified, renamed, and unsupported files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hex-common-semantic-diff-"));
    try {
        git(dir, ["init"]);
        configureGitLf(dir);
        git(dir, ["config", "user.name", "hex-common"]);
        git(dir, ["config", "user.email", "hex-common@example.com"]);

        writeFileSync(join(dir, "keep.ts"), "export function keep() {\n  return 1;\n}\n", "utf8");
        writeFileSync(join(dir, "drop.ts"), "export function drop() {\n  return 1;\n}\n", "utf8");
        mkdirSync(join(dir, "src"), { recursive: true });
        writeFileSync(join(dir, "src", "old.ts"), "export function oldName() {\n  return 1;\n}\n", "utf8");
        git(dir, ["add", "."]);
        git(dir, ["commit", "-m", "base"]);

        writeFileSync(join(dir, "keep.ts"), "export function keep() {\n  return 2;\n}\nexport function fresh() {\n  return keep();\n}\n", "utf8");
        rmSync(join(dir, "drop.ts"));
        renameSync(join(dir, "src", "old.ts"), join(dir, "src", "new.ts"));
        writeFileSync(join(dir, "note.txt"), "unsupported text file\n", "utf8");
        git(dir, ["add", "note.txt"]);

        const diff = await semanticGitDiff(dir, { baseRef: "HEAD" });
        assert.equal(diff.summary.changed_file_count, 4);
        assert.equal(diff.summary.semantic_file_count, 3);
        assert.equal(diff.summary.unsupported_file_count, 1);

        const keep = diff.changed_files.find(file => file.path === "keep.ts");
        assert.ok(keep, "modified TS file is listed");
        assert.equal(keep.status, "modified");
        assert.equal(keep.modified_symbols.length, 1);
        assert.equal(keep.added_symbols.length, 1);

        const removed = diff.changed_files.find(file => file.path === "drop.ts");
        assert.ok(removed, "deleted TS file is listed");
        assert.equal(removed.status, "deleted");
        assert.equal(removed.removed_symbols[0]?.name, "drop");

        const renamed = diff.changed_files.find(file => file.path === "src/new.ts");
        assert.ok(renamed, "renamed file is listed");
        assert.equal(renamed.status, "renamed");
        assert.equal(renamed.old_path, "src/old.ts");

        const unsupported = diff.changed_files.find(file => file.path === "note.txt");
        assert.ok(unsupported, "unsupported file is listed");
        assert.equal(unsupported.semantic_supported, false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
