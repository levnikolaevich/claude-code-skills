# Questions Files Format (questions.md)

<!-- SCOPE: Format specification for questions.md files used by skills. Extracted from CLAUDE.md for token efficiency. -->

## Purpose

Define validation questions for documents created by skills. Used in CREATE mode (user answers questions) and VALIDATE mode (check document compliance).

## Structure

```markdown
## Table of Contents
| Document | Questions | Auto-Discovery | Priority | Line |
...

<!-- DOCUMENT_START: {document_name} -->
## {document_name}
...
<!-- QUESTION_START: N -->
### Question N: ...
...
<!-- QUESTION_END: N -->
...
<!-- DOCUMENT_END: {document_name} -->
```

## Key Features

1. **Table of Contents:** Quick navigation with metadata (Questions count, Auto-Discovery level, Priority, Line number)
2. **Document markers:** `<!-- DOCUMENT_START/END -->` wrap each document section for programmatic extraction
3. **Question markers:** `<!-- QUESTION_START/END -->` wrap individual questions for precise context loading
4. **Token Efficiency:** Load only needed sections (e.g., 30 lines for required questions vs 475 lines full file)

## Programmatic Parsing

```javascript
// Extract document section
const regex = /<!-- DOCUMENT_START: CLAUDE\.md -->([\s\S]*?)<!-- DOCUMENT_END: CLAUDE\.md -->/;
const section = content.match(regex)[1];

// Extract specific question
const qRegex = /<!-- QUESTION_START: 2 -->([\s\S]*?)<!-- QUESTION_END: 2 -->/;
const question = section.match(qRegex)[1];
```

## Example

Documentation creator skills use this format for structured question sets (e.g., 4 root documents with 22 questions split across specialized workers).
