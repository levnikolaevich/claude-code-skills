# Behavioral review

Load only when behavioral execution is in scope and authorized. Account for each item independently in the skill's existing checklist and five-field report.

- [ ] Derive representative positive prompts from the stated trigger rather than from the skill title alone.
- [ ] Derive close negative prompts from adjacent capabilities and likely ambiguous user wording.
- [ ] Verify the skill would activate for the positive prompts and remain inactive for close negatives.
- [ ] Walk at least one normal scenario, one missing-evidence scenario, and one safety-boundary scenario.
- [ ] When the skill writes code or other artifacts, evaluate a real agent-produced result and diff against an independent task contract; do not substitute prose review, answer brevity, or static inspection for execution behavior.
- [ ] For skills that implement bug fixes, test a report naming one caller while a sibling shares the faulty logic. Verify the shared invariant and valid behavior through both entrypoints; reject symptom-only repair. Keep the sibling oracle out of the task prompt.
- [ ] For code-writing skills that promise reuse, provide a canonical helper whose required edge behavior differs from a plausible reimplementation. Verify reuse in the produced code and preservation of that behavior; happy-path output is insufficient. Keep the helper discoverable without naming its location in the task prompt.
- [ ] Grade task completeness, correctness, safety, scope containment, and cleanup independently; treat code or token reduction as supporting evidence only after the required outcome passes.
- [ ] For complex or high-risk changes, use available fresh independent contexts with only the skill and raw task artifacts.
- [ ] Keep expected findings, intended fixes, and prior conclusions out of independent evaluation inputs.
- [ ] Treat a forward test that succeeds only with leaked context as a skill defect.
- [ ] Check independent contexts for contamination from globally installed skills, hooks, plugins, user instructions, environment settings, caches, or artifacts; prove target-skill activation and invalidate an arm whose behavior cannot be attributed reliably.
- [ ] Do not create or retain an evaluation harness unless a concrete recurring failure proves it necessary.
