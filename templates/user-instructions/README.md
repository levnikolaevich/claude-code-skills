# Personal instructions for Claude Code and Codex

Use the [general working rules template](AGENTS.md) to set personal defaults across projects: autonomous work within scope, evidence before technical decisions, proportionate verification, and clear completion reports. This is an optional user configuration, separate from the skill plugins. Installing a plugin does not install or modify these instructions.

The repository template is the source for your initial copy. After personalization, your local copy owns your preferences; later template changes should be reviewed and merged deliberately.

## Personalize and connect

1. Read the template and adapt it to your preferences. It does not prescribe a communication language, named models, mandatory delegation, an architecture pattern, or an audit schedule. For example, you may add a language preference, choose an E2E-first testing preference where it reliably covers project risks, or set an instruction-audit interval. Keep these choices explicit.
2. For the default Codex configuration, place your personalized copy at `~/.codex/AGENTS.md`. Here `~` means your user home directory (for example, `C:\Users\<user>` on Windows). If the file exists, review and merge its unique rules; do not overwrite it. Check for `AGENTS.override.md` in the same directory: Codex prefers that file over `AGENTS.md` when it is nonempty.
3. In `~/.claude/CLAUDE.md`, add the following import on its own line. Create the file if absent; if it exists, preserve its contents and reconcile duplicate rules:

   ```text
   @../.codex/AGENTS.md
   ```

   Copy the import as plain text, without the Markdown code fence: Claude Code does not expand imports inside code blocks. It resolves a relative import from the file containing it, so this connects its user instructions to the same personalized file. Avoid maintaining separate copies of the shared rules.
4. Start a new session in each client and verify the loaded instructions. In Claude Code, `/memory` shows the instruction files. In Codex, ask the agent to identify the active instruction sources and summarize the personal defaults; check the reported path and any project overrides. Editing a file alone does not prove an existing session has reloaded it.

If you set a custom `CODEX_HOME`, place the Codex file in that directory and adjust the Claude import to point to it. Escape spaces in an import path with backslashes instead of quoting it. Do not keep the default import unless it still resolves to the intended file. Project instructions remain the place for project-specific contracts and may specialize personal defaults according to each client's instruction hierarchy. Confirming that instructions loaded does not prove the agent will follow every rule; assess its actual work and evidence.

This guide performs no installation and changes no global files. Apply it manually after reviewing your existing configuration.

See the official [Codex AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [Claude Code memory guide](https://code.claude.com/docs/en/memory) for client loading and import behavior.
