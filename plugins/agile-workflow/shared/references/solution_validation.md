<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/solution_validation.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Solution Validation (Criteria #6, #21)

<!-- SCOPE: Library version (#6) and alternative solutions (#21). Contains version verification, alternatives analysis. -->
<!-- DO NOT add here: Standards validation → standards_validation.md, other criteria → structural_validation.md -->

Detailed rules for library version verification and alternative solutions analysis.

---

## Criterion #6: Library & Version

**Check:** Libraries are latest stable versions

**Penalty:** HIGH (5 points)

✅ **GOOD:**
- "Using express v4.19.2 (latest stable as of 2025-01)"
- "Prisma v5.8.1 (current stable, verified via npm)"
- "OAuth2-proxy v7.6.0 (latest release)"

❌ **BAD:**
- "Using express v3.x" (outdated, v4.x available)
- "Any JWT library" (no specific version)
- "Latest version" (no verification)

**Auto-fix actions:**
1. Check if manuals exist from Phase 3 research (created inline)
2. IF manuals exist:
   - Read recommended version from manual (e.g., Manual: oauth2-proxy v7.6.0)
   - Compare with Story Technical Notes current version
   - IF outdated or unspecified → Update with version from manual
   - Add manual reference: "See [Manual: library-vX](docs/manuals/library-vX.md)"
3. IF no manuals exist (fallback to Context7):
   - Query `mcp__context7__resolve-library-id(libraryName="[library]")`
   - Query `mcp__context7__query-docs(libraryId="...", query="latest version")`
   - Extract latest stable version from docs
   - Add inline reference: "Library v[version] (verified via Context7)"
3a. IF Context7 also fails (per `references/epistemic_protocol.md`):
   - Mark version as `(from training, verify before implementation)` instead of asserting
   - Add to Library References table: Source = `training (unverified)`
   - DO NOT present training-sourced version as current fact
   - Phase 6 summary comment: report as `FROM TRAINING` (not as "verified")
4. Update Linear issue via `save_issue`
5. Add comment: "Library versions verified and updated"

**Example transformation:**

**Before:**
```markdown
## Technical Notes

### Integration Points
- Use Passport.js for authentication
- PostgreSQL database
```

**After (with manuals from Phase 3):**
```markdown
## Technical Notes

### Integration Points
- Passport.js v0.7.0 (latest stable, see [Manual: Passport v0.7](docs/manuals/passport-v0.7.md))
- PostgreSQL v16.1 (compatible with Prisma v5.8.1, see [Manual: Prisma v5](docs/manuals/prisma-v5.md))

### Library References
| Library | Version | Source |
|---------|---------|--------|
| passport | v0.7.0 | docs/manuals/passport-v0.7.md |
| @prisma/client | v5.8.1 | docs/manuals/prisma-v5.md |
| postgresql | v16.1 | Context7 verified |
```

**Skip Fix When:**
- All libraries have specific versions with sources
- Story in Done/Canceled status

---

## Criterion #21: Alternative Solutions

**Check:** Story approach is optimal vs modern alternatives

**Penalty:** MEDIUM (3 points)

**Rule:** Verify the chosen approach against current alternatives. Cross-reference ln-645 audit if available.

**Auto-fix actions:**
1. Search MCP Ref + web for alternatives to primary libraries/patterns in Technical Notes
2. Check for ln-645 audit: `Glob("docs/project/.audit/ln-640/*/645-open-source-replacer*.md")` — take latest by date
3. IF ln-645 report exists AND HIGH-confidence replacement touches Story's affected files:
   - Add advisory note to Technical Notes: package name + migration effort
   - IF Effort=L → recommend creating separate [REFACTOR] Story instead of blocking current implementation
4. IF better alternative found (without ln-645): add "Alternative Considered" note to Technical Notes
5. Update Linear issue + add comment

**Skip when:** Story in Done/Canceled, no libraries in Technical Notes, or all alternatives already documented.

---

## Criterion #28: Library Feature Utilization

**Check:** Planned custom implementations don't duplicate features of already-declared project dependencies

**Penalty:** MEDIUM (3 points)

**Rule:** Cross-reference Task Implementation Plans against project manifest + Story Library Research. Flag when a Task plans to build something a declared dependency already provides.

✅ **GOOD:**
- "Use `prisma.user.createMany()` for batch insert" (uses existing Prisma method)
- "Retry via Polly's `WaitAndRetryAsync` policy" (uses declared .NET library)
- "Format dates with `date-fns/format`" (uses installed package)

❌ **BAD:**
- "Implement custom retry with exponential backoff" (project has Polly in *.csproj)
- "Write date formatting utility" (date-fns already in package.json)
- "Build manual SQL batch insert loop" (Prisma supports createMany)

**Detection algorithm:**

1. **Dependency Extraction:**
   - Read project manifest: `package.json`, `requirements.txt`, `pyproject.toml`, `*.csproj`, `go.mod`, `Cargo.toml`, `build.gradle`, `pom.xml` (Glob up to 2 levels deep; if Story Affected Components point to a subdirectory, check that directory's manifest first)
   - Read Story Library Research table (populated by #6)
   - Build library set: `{name, version, domain}` for top dependencies

2. **Intent Extraction from Tasks:**
   - Scan each Task's Implementation Plan + Technical Approach for custom-build signals:
     - Keywords: `"implement custom"`, `"write from scratch"`, `"build manually"`, `"create utility/helper"`, `"hand-roll"`, `"hand-code"`, `"add [X] function/method/class"`
     - Co-occurrence required: custom-build keyword + functional noun (`parser`, `validator`, `formatter`, `serializer`, `retry`, `cache`, `scheduler`, `HTTP client`, `logger`, `queue`, `date`, `sort`, `auth`, `crypto`)
   - Single keyword matches without functional noun → skip (too vague)

3. **Context7 Cross-Reference (max 3 queries per Story):**
   - For top matches (by confidence: custom-build signal strength + library domain overlap):
     - `resolve-library-id(libraryName="{library}")` → `query-docs(libraryId="...", query="{extracted_intent} built-in method API")`
   - Batch intents per library: if 3 Tasks reference same library → 1 combined query
   - Reuse #6's Context7 responses if same library already queried
   - Fallback: Context7 → built-in knowledge. No WebSearch for #28

**Confidence levels:**
- **HIGH:** Task says "implement custom X" AND library docs show `library.X()` method exists → **penalty + advisory**
- **MEDIUM:** Task describes behavior that resembles a library feature but uses different terminology → **advisory note only, no penalty**
- **LOW:** Vague overlap → **skip, do not flag**

**Auto-fix actions:**
1. For each HIGH-confidence finding, add advisory note to Task Technical Approach:
   ```
   > **Library Feature Available:** [library] v[version] provides `[method]` for [purpose].
   > Consider using instead of custom implementation. [Context7/docs reference]
   ```
2. If Story has Library Research table: add "Key APIs (underutilized)" subsection with method signatures mapped to Task intents
3. Update Linear issue / file via appropriate provider
4. Add comment: "Library feature utilization check: N findings (advisory)"

**Skip when:**
- No manifest files found in project (no dependencies to check)
- Task has no Implementation Plan section
- Library method already documented in Technical Approach as being used for this purpose
- Story/Task in Done/Canceled status
- Story has 0 external dependencies (pure internal refactoring)

---

## Execution Notes

**Sequential Dependency:**
- Criteria #6, #21, #28 depend on #1-#5 being completed first
- Cannot verify libraries until Technical Notes exist (#1)
- Cannot verify libraries until Standards checked (#5)
- #28 depends on #6 completing first (needs verified Library Research table)
- Group 3 execution order: #6 → #21 → #28

**Research Integration:**
- Phase 3 creates documentation inline
- Criterion #6 reads from Phase 3 docs, fallback to Context7 if needed
- Criterion #28 reuses #6's Context7 responses when querying the same library
- All research completed BEFORE Phase 4 auto-fix begins

**Token Efficiency (#28):**
- Max 3 Context7 queries per Story (not per Task)
- Only query DECLARED dependencies (suggesting new ones is #21's job)
- Batch intents per library into single query
- Reuse #6's cached Context7 responses

**Linear Updates:**
- Criterion auto-fix updates Linear issue once per criterion
- Add single comment summarizing library version updates (#6) and feature findings (#28)

---

**Version:** 4.0.0
**Last Updated:** 2025-01-07
