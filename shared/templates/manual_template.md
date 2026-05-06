# {{PACKAGE_NAME}} v{{VERSION}} - Usage Manual

<!-- SCOPE: API/Method reference ONLY. Contains technical descriptions, parameters, return types. -->
<!-- DO NOT add: How-to instructions -> Guide, Decision rationale -> ADR -->

<!-- NO_CODE_EXAMPLES: Manuals document APIs, not implementations.
     FORBIDDEN: Code blocks, implementation snippets, code examples
     ALLOWED: Method signatures (1 line inline), parameter tables, ASCII diagrams
     INSTEAD OF CODE: Link to official documentation or real project file

     CORRECT: "See [Official docs: CreateClient()](https://docs.example.com/CreateClient)"
     CORRECT: "See [src/Services/RateLimiter.cs:42](src/Services/RateLimiter.cs#L42)"
     WRONG: Full code block with usage example -->
<!-- DOC_KIND: reference -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need package-specific API facts, methods, or version notes used by the project. -->
<!-- SKIP_WHEN: Skip when you only need project patterns or architectural decisions. -->
<!-- PRIMARY_SOURCES: docs/reference/README.md, official docs, package manifests, src/ -->

## Quick Navigation

- [Reference Hub](../README.md)
- [Architecture](../../project/architecture.md)
- [Tech Stack](../../project/tech_stack.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Summarizes the external package API surface actually relevant to the project. |
| Read When | You need package methods, parameters, return types, or version-specific notes. |
| Skip When | You only need project-specific patterns or architectural rationale. |
| Canonical | Yes |
| Next Docs | [Tech Stack](../../project/tech_stack.md), [Architecture](../../project/architecture.md), [Reference Hub](../README.md) |
| Primary Sources | `docs/reference/README.md`, official docs, package manifests, `src/` |

## Package Information

**Package:** {{PACKAGE_NAME}}
**Version:** {{VERSION}}
**Installation:** `{{INSTALL_COMMAND}}`
**Documentation:** {{OFFICIAL_DOCS_URL}}

## Overview

{{PACKAGE_DESCRIPTION}}

## Methods We Use

---

### {{METHOD_1_NAME}}

**Signature:** `{{METHOD_1_SIGNATURE}}`

**Description:** {{METHOD_1_DESCRIPTION}}

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| {{PARAM_1_NAME}} | {{PARAM_1_TYPE}} | {{PARAM_1_REQUIRED}} | {{PARAM_1_DEFAULT}} | {{PARAM_1_DESCRIPTION}} |
| {{PARAM_2_NAME}} | {{PARAM_2_TYPE}} | {{PARAM_2_REQUIRED}} | {{PARAM_2_DEFAULT}} | {{PARAM_2_DESCRIPTION}} |

**Returns:**

{{RETURN_TYPE}} - {{RETURN_DESCRIPTION}}

**Raises:**

| Exception | Condition |
|-----------|-----------|
| `{{EXCEPTION_1}}` | {{EXCEPTION_1_CONDITION}} |
| `{{EXCEPTION_2}}` | {{EXCEPTION_2_CONDITION}} |

**Documentation:** [Official docs: {{METHOD_1_NAME}}]({{METHOD_1_DOCS_URL}})

**Project usage:** See [{{PROJECT_FILE_PATH}}]({{PROJECT_FILE_PATH}}) (if exists)

{{METHOD_1_WARNINGS}}

---

### {{METHOD_2_NAME}}

**Signature:** `{{METHOD_2_SIGNATURE}}`

**Description:** {{METHOD_2_DESCRIPTION}}

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| {{PARAM_1_NAME}} | {{PARAM_1_TYPE}} | {{PARAM_1_REQUIRED}} | {{PARAM_1_DEFAULT}} | {{PARAM_1_DESCRIPTION}} |

**Returns:** {{RETURN_TYPE}} - {{RETURN_DESCRIPTION}}

**Raises:**

| Exception | Condition |
|-----------|-----------|
| `{{EXCEPTION_1}}` | {{EXCEPTION_1_CONDITION}} |

**Documentation:** [Official docs: {{METHOD_2_NAME}}]({{METHOD_2_DOCS_URL}})

---

## Configuration

<!-- TABLE-FIRST: Configuration MUST be in table format, not code -->

{{CONFIGURATION_SECTION}}

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| {{CONFIG_1_NAME}} | {{CONFIG_1_TYPE}} | {{CONFIG_1_DEFAULT}} | {{CONFIG_1_DESCRIPTION}} |
| {{CONFIG_2_NAME}} | {{CONFIG_2_TYPE}} | {{CONFIG_2_DEFAULT}} | {{CONFIG_2_DESCRIPTION}} |

## Known Limitations

{{LIMITATIONS}}

* {{LIMITATION_1}}
* {{LIMITATION_2}}

## Version-Specific Notes

{{VERSION_NOTES}}

## Related Resources

* **Official Documentation:** {{OFFICIAL_DOCS_LINK}}
* **GitHub Repository:** {{GITHUB_URL}}
* **Related Guides:** {{RELATED_GUIDES}}
* **Related ADRs:** {{RELATED_ADRS}}

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- Package version changes
- Relevant methods or configuration usage change
- Official documentation changes materially

**Verification:**
- [ ] Version matches the project dependency
- [ ] Method signatures still match current package usage
- [ ] Official documentation links resolve
