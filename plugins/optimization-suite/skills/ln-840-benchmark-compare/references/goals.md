# Benchmark Goals - hex-line-mcp

Run the scenarios independently. Do not make unrelated changes. Show your work and keep the repository in a valid state after each scenario.

This file is the canonical scenario suite for internal built-in vs `hex-line` comparison. If maintainers run an external baseline later, reuse this suite unchanged together with the matching correctness expectations.

## Scenario A: Small Focused Edit

File `lib/search.mjs` defines the ripgrep timeout.

1. Find the timeout constant in `lib/search.mjs` and report its current line number and value.
2. Change the timeout from `30000` milliseconds to `45000`.
3. Update the nearby inline comment so it matches the new timeout.
4. Verify the file with `node --check lib/search.mjs`.
5. Report exactly what changed.

## Scenario B: Small Feature In Existing Module

File `lib/verify.mjs` already exports `verifyChecksums`, and `server.mjs` imports it.

1. Read `lib/verify.mjs` and understand the current verification flow.
2. Add a new exported function `verifyRevision(filePath, baseRevision)` that:
   - reads the current snapshot with `readSnapshot(filePath)`
   - reads the prior snapshot with `getSnapshotByRevision(baseRevision)`
   - returns `{ fresh: true, revision: current.revision }` when the revisions match
   - otherwise returns `{ fresh: false, revision: current.revision, changed: describeChangedRanges(...) }`
   - returns `{ fresh: false, revision: current.revision, changed: "unavailable (base revision evicted)" }` when the base revision is missing
3. Update `server.mjs` so the import from `./lib/verify.mjs` includes `verifyRevision`.
4. Verify both files with `node --check`.
5. Report the new function signature and the files you changed.

## Scenario C: Common Rename Refactor

The helper `readText` is defined in `lib/format.mjs` and reused in several internal modules.

1. Find where `readText` is defined and report the file, line number, and signature.
2. Find every import and call site under `lib/`.
3. Rename `readText` to `loadTextFile` everywhere under `lib/`.
4. Verify that no file under `lib/` still contains the string `readText`.
5. Run `node --check` on every changed `.mjs` file.
6. Report every changed file.

## Scenario D: Codebase Inventory Document

Create a concise inventory document for the `lib/` directory.

1. Inspect `lib/` and list all `.mjs` files with their line counts and byte sizes.
2. Identify the 5 largest files in `lib/`.
3. For each of those 5 files, list every exported function with its parameter signature only.
4. Build a dependency map showing which `lib/` files import other `lib/` files.
5. Identify leaf modules in `lib/` that are not imported by any sibling `lib/` file.
6. Write the final result to `lib/MODULES.md` with exactly these headings:
   - `## File Inventory`
   - `## Largest Modules`
   - `## Internal Imports`
   - `## Leaf Modules`
