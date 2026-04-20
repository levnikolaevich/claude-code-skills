# Grammar golden fixtures

Small, deterministic text fixtures that illustrate the hex-graph-mcp response
grammar defined in `PROTOCOL.md`. These are **illustrative**, not
string-identical expectations — the live server may interleave additional
`!warning=` lines or different row orderings depending on the index state.

The `test/schema-contract.mjs > grammar body contract` suite validates the
structural invariants (action-line regex, row prefixes, pointer format) against
a live server, not against these files. Fixtures exist to:

1. Anchor the documented shape for reviewers.
2. Serve as diff targets when refining the renderer.

Update fixtures by hand whenever PROTOCOL.md changes; do NOT parse them in
tests.
