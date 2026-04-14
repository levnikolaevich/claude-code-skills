# MCP Provider Requirements (thin lookup)

> **SCOPE:** Which MCP servers require which language-analyzer providers. This file intentionally delegates to `mcp__hex-graph__install_graph_providers` rather than duplicating its internal matrix.

## Philosophy

`install_graph_providers` is the single source of truth for per-language provider requirements (which language-server binary, which install method per OS, which checks decide `installed` vs `missing`). It is documented to **never install runtimes or project dependencies** — only the agent-level language servers. That is exactly the boundary `ln-013` must respect.

This reference therefore keeps the per-MCP mapping thin: it says *which MCPs should invoke the provider check at all*, and lets the provider tool decide the rest.

## MCP lookup table

| MCP server | Provider check delegate | Notes |
|------------|------------------------|-------|
| `hex-graph` | `mcp__hex-graph__install_graph_providers` (`mode: "check"`; `mode: "install"` when `auto_install_providers=true`) | Covers Python (basedpyright via pip, npm fallback), TypeScript (`typescript`), Rust (`rust-analyzer` via rustup), Go (`gopls`), C# (.NET SDK + OmniSharp). |
| any other MCP | — | Skipped with status `not_applicable`. Log the server name so it is easy to add later. |

## Extension policy

- Add a new row only when an MCP server has a verifiable, per-language install requirement that fails silently without the provider.
- Prefer delegation (`mcp__*__install_*`) over embedding an OS-specific install matrix here.
- If a new MCP needs providers on languages `install_graph_providers` does not cover, file an upstream request first and record a `skipped` row in the meantime.

## Project-dependency boundary

Even when a project lists `basedpyright` in its own `dev-dependencies`, `ln-013` does **not** install it into the project. The provider check is about system/agent-level tooling. Project installs are the user's choice and conflict with the contract of `install_graph_providers`.
