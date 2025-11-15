---
name: ln-23-manual-creator
description: Creates minimal package API reference manuals through automated research
---

# ln-23-manual-creator

## Purpose

Creates minimal Package API reference manuals (300-500 words, OpenAPI-inspired format) documenting specific version methods/APIs that will be used in implementation.

**Key Features:**
- AUTO-RESEARCH via MCP Context7 + Ref (library versions, method signatures, parameters)
- Neutral, factual tone (NO opinions, NO marketing)
- Method-focused structure (signatures, parameters tables, examples)
- Version-specific (httpx-0.24.0.md format)

**Use when:**
- New package/library introduced in Story
- Need to document specific API methods for implementation reference
- After Story Done (optional documentation step)

**Do NOT use for:**
- Best practices / patterns → use ln-21-guide-creator
- Architectural decisions → use ln-22-adr-creator

---

## Workflow

### Phase 0: Research & Discovery (Automated, 10-15 min)

**Automated research through MCP tools:**

1. **Context7: Library API Documentation**
   - Query: `resolve-library-id("[package name]")`
   - Then: `get-library-docs(library_id, topic="[methods]")`
   - Extract: Method signatures, parameter types, return types
   - Example: `resolve-library-id("httpx")` → `/python-httpx/httpx`

2. **MCP Ref: Official Documentation**
   - Query: `"[package] v[version] API reference"`
   - Extract: Installation instructions, configuration options, version-specific notes
   - Example: `"httpx v0.24.0 API reference"` → official docs, changelog

3. **Analysis**
   - Identify core methods user will interact with
   - Extract parameter details (type, required flag, defaults, descriptions)
   - Collect usage examples from docs
   - Note known limitations and version-specific behavior

**Output:**
- Package metadata (name, version, installation command, docs URL)
- Method list with signatures
- Parameter details for each method
- Usage examples
- Sources (2-3 official documentation links with versions/dates)

---

### Phase 1: Method Analysis

**Process extracted research data:**

1. **Parse Method Signatures**
   - Extract method names (e.g., `AsyncClient.request`)
   - Identify parameters with types (e.g., `url: str`, `timeout: Optional[float] = None`)
   - Determine return types
   - List possible exceptions

2. **Parameter Table Generation**
   - For each parameter: name, type, required flag, default value, description
   - Mark required parameters with ✅, optional with ❌
   - Document default behavior for optional parameters

3. **Example Code Extraction**
   - Find representative usage examples from official docs
   - Include both success cases and error handling
   - Show initialization + method call + response handling

---

### Phase 2: Manual Generation

**Generate manual from `references/manual_template.md`:**

**Template Structure (OpenAPI-inspired):**

1. **Package Information** (metadata table)
   - Package name, version, installation command, official docs URL

2. **Overview** (1 paragraph)
   - What does package do? Core capabilities (neutral, factual)

3. **Methods We Use** (for each method)
   - Method signature (code block)
   - Description (neutral statement of what method does)
   - Parameters table (name | type | required | default | description)
   - Returns (type + description)
   - Raises (exceptions + conditions)
   - Example (code block with expected output)
   - Warnings (if applicable)

4. **Configuration** (options table)
   - Configuration options (name | type | default | description)

5. **Known Limitations**
   - Bulleted list of constraints/limitations

6. **Version-Specific Notes**
   - What changed in this version? Breaking changes?

7. **Related Resources**
   - Official documentation links
   - Related Guides (links to docs/guides/)
   - Related ADRs (links to docs/adrs/)
   - Last Updated date

**Copy-then-Edit Pattern:**
```python
# 1. Copy template
manual_content = read("ln-23-manual-creator/references/manual_template.md")

# 2. Replace placeholders
manual_content = manual_content.replace("{{PACKAGE_NAME}}", package_name)
manual_content = manual_content.replace("{{VERSION}}", version)
# ... all placeholders

# 3. Generate methods sections (repeat for each method)
for method in methods:
    method_section = generate_method_section(method)
    manual_content = insert_method_section(manual_content, method_section)
```

**Validation:**
- ✅ SCOPE tags present (first 3-5 lines after title)
- ✅ All sources dated (2025 or version specified)
- ✅ Neutral, factual tone (NO opinions like "best", "recommended", "should")
- ✅ All parameters documented (type + required flag + description)
- ✅ Default values for optional parameters specified
- ✅ At least 1 usage example per method
- ✅ Official documentation link present
- ❌ NO "how-to" instructions (those go in guides)
- ❌ NO decision rationale (that goes in ADRs)
- ❌ NO subjective statements (only objective facts)

**Show preview:**
```
MANUAL CREATION PREVIEW:

Will create: docs/manuals/[package]-[version].md

Package: {{PACKAGE}}
Version: {{VERSION}}
Methods: {{METHOD_COUNT}}
Length: {{WORD_COUNT}} words

[... manual content ...]

Type "confirm" to create this manual.
```

---

### Phase 3: Confirmation & Storage

1. **User Confirmation**
   - Wait for "confirm" input
   - Allow review of generated content

2. **Save Manual**
   - **Filename format:** `docs/manuals/[package]-[version].md`
     - Example: `docs/manuals/httpx-0.24.0.md`
     - Package name in lowercase, kebab-case if multi-word
     - Version exactly as specified
   - **No sequential numbering** (manuals are version-specific, not sequential)

3. **Return Path**
   - Return file path for linking: `docs/manuals/httpx-0.24.0.md`
   - Used by ln-20-story-validator or ln-31-task-executor for inserting links

**Output:**
```
✓ Manual created: docs/manuals/httpx-0.24.0.md

Package: httpx v0.24.0
Methods documented: 3
Total: 1 document, 450 words
```

---

## Definition of Done

### Research Completed (Phase 0)
- [ ] Context7 search: library API documentation retrieved
- [ ] MCP Ref search: official documentation found
- [ ] Analysis: method signatures + parameters + examples extracted
- [ ] Sources: 2-3 official docs links with versions/dates

### Method Analysis Complete (Phase 1)
- [ ] Method signatures parsed
- [ ] Parameter tables generated (name, type, required, default, description)
- [ ] Return types identified
- [ ] Exceptions listed
- [ ] Usage examples extracted

### Manual Generated (Phase 2)
- [ ] All sections present (Package Info, Overview, Methods, Configuration, Limitations, Version Notes, Related)
- [ ] No placeholders remaining
- [ ] Preview generated

### Quality Verification (Phase 2)
- [ ] SCOPE tags present
- [ ] All sources dated (2025 or version specified)
- [ ] Neutral, factual tone (NO opinions)
- [ ] All parameters have: type + required flag + description
- [ ] Default values documented for optional parameters
- [ ] At least 1 usage example per method
- [ ] Official documentation link present
- [ ] NO "how-to" instructions (guides only)
- [ ] NO decision rationale (ADRs only)
- [ ] NO subjective statements (only facts)

### User Confirmation (Phase 3)
- [ ] Preview shown to user
- [ ] User typed "confirm"

### Manual Saved (Phase 3)
- [ ] File created in docs/manuals/
- [ ] Filename format: [package]-[version].md
- [ ] Path returned for linking

---

## Integration

### Invoked By

**Manual invocation:** User creates manual when needed

**Example use cases:**
- After implementing Story with new package
- When documenting third-party API integration
- Before complex implementation requiring API reference

### Can Be Invoked From

**ln-20-story-validator (Phase 2) - Auto-invoked:**
```python
# When Story introduces new package (package+version trigger)
if new_package_detected(story.technical_notes):
    # Auto-invoke ln-23-manual-creator
    manual_path = Skill(skill="ln-23-manual-creator", prompt="[package] [version]")
    # Returns: docs/manuals/package-version.md for linking in Phase 3 #13
```

**ln-31-task-executor (Phase 1):**
```python
# Read manual links from Task Technical Approach
manual_links = extract_links(task.technical_approach, pattern="docs/manuals/*.md")
for link in manual_links:
    manual_content = read(link)
    # Reference during implementation
```

---

## Example Usage

**Input:**
```
Create manual for httpx AsyncClient v0.24.0
Methods: request, get, post
```

**Phase 0: Research (10-15 min)**
```
Context7: resolve-library-id("httpx") → /python-httpx/httpx
Context7: get-library-docs("/python-httpx/httpx", topic="AsyncClient methods")
→ AsyncClient.request(method, url, **kwargs)
→ AsyncClient.get(url, **kwargs)
→ AsyncClient.post(url, data=None, **kwargs)

MCP Ref: "httpx v0.24.0 API reference"
→ Official docs: https://www.python-httpx.org/api/
→ Installation: pip install httpx==0.24.0
→ Config options: timeout, limits, proxies
```

**Phase 1: Analysis**
```
Method: AsyncClient.request
Parameters:
- method: str, required, HTTP method (GET, POST, etc.)
- url: Union[URL, str], required, request URL
- params: Optional[QueryParamTypes], optional, None, query parameters
- headers: Optional[HeaderTypes], optional, None, request headers
- timeout: Optional[Timeout], optional, 5.0, request timeout

Returns: Response

Raises:
- httpx.TimeoutException: when request exceeds timeout
- httpx.ConnectError: when connection fails
```

**Phase 2: Generation**
```
Generate manual from template:
- Package: httpx
- Version: 0.24.0
- Methods: 3 (request, get, post)
- Length: ~480 words
```

**Phase 3: Confirmation & Save**
```
✓ Manual created: docs/manuals/httpx-0.24.0.md
```

---

## Related Skills

- **ln-21-guide-creator:** Create best practices guides (patterns, "how to")
- **ln-22-adr-creator:** Create architecture decision records (decisions, "why")
- **ln-61-docs-creator:** Create comprehensive project documentation (pre-planning)

---

**Version:** 1.1.0 (Auto-invocation by ln-20-story-validator)
**Last Updated:** 2025-11-14
