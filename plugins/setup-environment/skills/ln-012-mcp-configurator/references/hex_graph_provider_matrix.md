# Hex Graph Provider Matrix

<!-- SCOPE: Graph-specific optional provider and SCIP exporter setup guidance for ln-012 ONLY. -->

Use this reference only for `hex-graph` setup.

Assume the project already has its own runtimes and app dependencies. This matrix is only for extra packages or binaries that unlock fuller `hex-graph` analysis and SCIP interoperability.

## Detection Scope

- Detect from the current project root, not the whole workspace
- Prefer explicit project metadata first
- Use framework markers only to confirm the language, not to trigger framework installs

Detection order:
1. `docs/project/tech_stack.md` if present
2. Root marker files
3. Fallback file extensions under the current project root

## Precise Providers

| Detected language | Root markers | Framework hints | Provider package/binary | Check command | Install command | Capability unlocked |
|---|---|---|---|---|---|---|
| JavaScript / TypeScript | `package.json`, `tsconfig.json`, `jsconfig.json` | React, Next.js, Express, NestJS | None | None | None | Embedded TypeScript precise overlay already covers JS/TS |
| Python | `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile` | FastAPI, Django, Flask | `basedpyright` / `basedpyright-langserver` | `basedpyright-langserver --version` | `pip install basedpyright` | Python precise references/calls |
| C# | `*.csproj`, `*.sln` | ASP.NET Core | `csharp-ls` | `csharp-ls --version` | `dotnet tool install -g csharp-ls` | C# precise references/calls |
| PHP | `composer.json` | Laravel | `phpactor` | `phpactor --version` | Install `phpactor` by the project's PHP toolchain or package manager | PHP precise references/calls |

## Optional SCIP Export Tools

Install these too when you want `export_scip` to work out of the box for the detected language.

| Detected language | Binary | Check command | Install command | Notes |
|---|---|---|---|---|
| JavaScript / TypeScript | None | None | None | Native compiler-backed lane is built into `hex-graph-mcp` |
| Python | `scip-python` | `scip-python index --help` | Windows: `npm install -g github:levnikolaevich/scip-python#fix/windows-path-sep-regex` | Temporary Windows policy until upstream fix for `sourcegraph/scip-python#210` ships. If a patched binary lives outside `PATH`, set `HEX_GRAPH_SCIP_PYTHON_BINARY` |
| Python | `scip-python` | `scip-python index --help` | macOS / Linux: `npm install -g @sourcegraph/scip-python` | Official upstream package |
| C# | `scip-dotnet` | `scip-dotnet --help` | `dotnet tool install -g scip-dotnet` | Official upstream exporter |
| PHP | `scip-php` | `scip-php --help` or `php vendor/bin/scip-php --help` | `composer global config repositories.levnikolaevich-scip-php vcs https://github.com/levnikolaevich/scip-php` then `composer global require davidrjenni/scip-php:dev-fix/windows-runtime-fixes --prefer-source` | Preferred isolated fallback for Windows/Laravel. Project-local upstream install is still acceptable when it works |

## Rules

- Do not install project dependencies
- Do not install framework packages
- Do not install runtimes
- Only install provider packages or SCIP exporter binaries for languages detected in the current project root
- For Python on Windows, prefer the patched `scip-python` install above until upstream ships the fix
- For PHP on Windows or on projects where `composer require --dev davidrjenni/scip-php` conflicts with the app dependency graph, prefer the isolated patched fork install above
- Ask the user before any install command
- If a tool is missing, report the exact install command in the summary

## Reporting

Report this table shape in the final summary:

| Language | Detected | Tool | Status | Action |
|---|---|---|---|---|
| Python | yes | basedpyright | WARN | Ask user to run `pip install basedpyright` |
| Python | yes | scip-python | WARN | On Windows ask user to run `npm install -g github:levnikolaevich/scip-python#fix/windows-path-sep-regex` |
| C# | no | csharp-ls | SKIP | Not needed for this project |
