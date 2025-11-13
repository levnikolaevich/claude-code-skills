# Concise Terms Dictionary

**Quick reference for optimizing SKILL.md files**

Use these replacements to reduce tokens by 30-40% in descriptive text.

## Usage

Apply via search/replace in SKILL.md files:
1. Search for verbose phrase (left column)
2. Replace with concise equivalent (right column)
3. Verify context still makes sense

## Dictionary (57 pairs)

| ❌ Avoid (Verbose) | ✅ Use (Concise) |
|-------------------|------------------|
| in order to | to |
| at this point in time | now |
| has the ability to | can |
| is able to | can |
| in the event that | if |
| prior to | before |
| for the purpose of | to/for |
| make use of | use |
| provides a description of | describes |
| a number of | several |
| with regard to | about |
| in relation to | about |
| with reference to | about |
| in accordance with | per/following |
| due to the fact that | because |
| for the reason that | because |
| in spite of the fact that | although |
| on the basis of | based on |
| in the process of | (remove) |
| during the course of | during |
| with the exception of | except |
| in close proximity to | near |
| at the present time | now |
| in the near future | soon |
| at an earlier time | previously |
| on a regular basis | regularly |
| in most cases | usually |
| the majority of | most |
| a large number of | many |
| a small number of | few |
| is in a position to | can |
| has a tendency to | tends to |
| it is necessary to | must |
| it is recommended that | recommend |
| it should be noted that | note that |
| it is important to note | (remove) |
| take into consideration | consider |
| give consideration to | consider |
| have an impact on | affect |
| make a decision | decide |
| make a determination | determine |
| make an adjustment | adjust |
| perform an analysis | analyze |
| conduct an investigation | investigate |
| provide assistance | help |
| have a need for | need |
| exhibit a tendency | tend |
| brings about a change | changes |
| has the potential to | can/may |
| is responsible for | handles |
| serves the function of | functions as |
| in conjunction with | with |
| subsequent to | after |
| as a consequence of | because of |
| with the result that | so |
| for this reason | therefore |
| it may be said that | (remove) |

## Filler Words to Remove

**Remove these words entirely (they add no meaning):**

- simply
- quickly
- easily
- basically
- actually
- really
- very (use stronger adjective instead)
- on top of that (use "and")
- in many cases (use "often")

## Example Transformation

```markdown
❌ Before (48 words):
"In order to execute tasks, x-task-executor has the ability to load the task
from Linear. At this point in time, the skill provides a description of the
implementation approach. It is important to note that quality gates are run
prior to completion."

✅ After (26 words, -46% reduction):
"To execute tasks, x-task-executor can load the task from Linear.
Now, the skill describes the implementation approach.
Quality gates run before completion."
```

## Additional Rules

1. **Active Voice:** Convert "tasks are executed by the skill" → "the skill executes tasks"
2. **Sentence Length:** Max 20-25 words per sentence
3. **Paragraph Length:** 3-5 sentences, one idea per paragraph

**Full documentation:** See [docs/SKILL_ARCHITECTURE_GUIDE.md](../docs/SKILL_ARCHITECTURE_GUIDE.md#appendix-a-concise-terms-dictionary)

---

**Version:** 1.0.0
**Last Updated:** 2025-11-14
