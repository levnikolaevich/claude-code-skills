# Token-efficient skills

Token efficiency means spending context on decisions and evidence that improve the requested outcome. It does not mean deleting domain checks, weakening verification, reducing the final self-check, or removing fields from the approved report.

## Loading and ownership

| Surface | Cost and authoring rule |
|---|---|
| Skill names and descriptions | Discovery context across installed skills. Describe the actual task and only useful neighboring exclusions; avoid broad trigger words that activate unrelated workflows. |
| Selected SKILL.md | Task context. Preserve its complete domain checklist, evidence and verdict; do not force other lifecycle stages merely because they exist. |
| Skill-local references | Conditional context. Load only when the entrypoint's trigger applies; keep each procedure in one owner. |
| Repository instructions | Repository-wide context. Keep repository policy here and skill execution in the standalone entrypoints. CLAUDE.md imports AGENTS.md rather than duplicating it. |
| Task evidence and reports | Reuse current observations, refresh affected claims after changes, and link artifacts rather than repeating their full contents. Retain all five report fields. |

The common contract is intentionally copied into each standalone skill. Extracting it into a shared runtime would save source bytes while breaking independent installation. README and the website serve discovery; they are not mandatory inputs to every skill run. Do not split a coherent mandatory checklist into references just to reduce its apparent size.

## Verification

Compare the same set of names/descriptions before and after an edit with one named tokenizer. Separate discovery metadata from selected skill bodies and conditional resources. Report the encoding and scope: a reference tokenizer count is not an Astra-specific billing estimate, actual host context measurement, or behavioral-quality result.

Check that every body obligation remains intact, that neighboring skills still route distinctly, and that local catalogs agree. Required validation remains mandatory. Rerun successful checks only for relevant changes, failures or unresolved evidence.

Behavioral evaluation is separate: use the [isolated scenarios](behavioral-validation.md) to test task completion, misrouting, unnecessary work and side effects. Do not claim behavioral improvement from smaller descriptions alone.

## Sources

Checked on 2026-09-12: [OpenAI's Astra skill guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) explains precise discovery and contextual instruction loading; [Build skills](https://learn.chatgpt.com/docs/build-skills) describes skill packaging and progressive disclosure. Recheck when authoring guidance or host loading changes. The detailed checklist, self-check and five-field report are explicit repository requirements and remain authoritative here.
