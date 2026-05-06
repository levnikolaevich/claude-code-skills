# Response Styles & Writing Quality

<!-- SCOPE: Response style templates for community replies. Used by ln-914 to compose varied, high-quality responses. -->
<!-- DO NOT add here: GitHub markdown syntax → discussion_formatting.md; strategy/triggers → community_strategy_template.md -->

## Classification Matrix

| Item Signals | Response Style |
|-------------|---------------|
| Q&A category + question in body + answer found in codebase | **Technical Answer** |
| Labels: `bug`, error message in body, reproduction steps | **Bug Acknowledgment** |
| Ideas category, labels: `enhancement`/`feature`, "would be nice" | **Feature Acknowledgment** |
| Question already answered in docs/other discussion | **Redirect** |
| Author's first discussion in repo (0 prior) | **Welcome** (combine with appropriate content style) |
| Item stale > 14d, work in progress or recently fixed | **Status Update** |

---

## Style Templates

### 1. Technical Answer

**When:** User asks "how do I...", "where is...", "why does...".

```
Thanks for asking, @{author}!

{Direct answer — 2-4 sentences max}

{Code reference or link:}
- [{relevant_file.md}](https://github.com/{owner}/{repo}/blob/{branch}/{path})
- {Optional: specific section/line reference}

{If multiple approaches exist:}
> [!TIP]
> {Alternative approach or best practice}

Let us know if this resolves your question!
```

**Tone:** Helpful, direct. Answer first, context second.
**Anti-pattern:** Don't explain what the user already knows. Don't start with "Great question!".

### 2. Bug Acknowledgment

**When:** User reports a bug, error, or unexpected behavior.

```
Thanks for reporting this, @{author}.

{Acknowledgment — confirm you understand the issue}

**Status:** {One of:}
- "We can reproduce this — tracking for a fix."
- "This was fixed in {commit/version} — can you try updating?"
- "We need more info to reproduce. Could you share {specific detail}?"

{If fixed:}
The fix is in [{commit_message}](https://github.com/{owner}/{repo}/commit/{hash}).

{If needs investigation:}
We'll look into this. In the meantime, {workaround if known}.
```

**Tone:** Empathetic, action-oriented. Acknowledge → Status → Next step.
**Anti-pattern:** Don't say "works for me" without investigation. Don't promise timeline.

### 3. Feature Acknowledgment

**When:** User suggests a feature, improvement, or idea.

```
Interesting idea, @{author}! Thanks for sharing.

{Brief assessment — does this align with project direction?}

{One of:}
- "This aligns with our direction — we'll consider it for {area}."
- "This already exists! Check [{feature_name}]({link})."
- "This is a bigger change that would benefit from an RFC. Would you like to open one in Ideas?"

{If significant feature:}
> [!NOTE]
> For larger proposals, we use [RFC discussions]({ideas_category_url}) to gather community input before implementation.
```

**Tone:** Appreciative, honest. Don't over-promise. Link to existing if applicable.
**Anti-pattern:** Don't dismiss without explanation. Don't commit to building it.

### 4. Redirect

**When:** Question is answered elsewhere, in wrong category, or duplicate.

```
Hi @{author}! This is covered in our docs:

→ [{document_title}]({link}) — {1 sentence describing what they'll find there}

{If duplicate discussion:}
→ See #{number} for the existing discussion on this topic.

{Brief direct answer if simple — don't make the user click away for a one-line answer.}

Feel free to follow up if the docs don't cover your specific case!
```

**Tone:** Helpful, not dismissive. Always add a brief answer alongside the redirect.
**Anti-pattern:** Don't just post a link with no context. Don't say "RTFM" in any form.

### 5. Welcome

**When:** Author's first discussion in the repo. Combine with another style for the content.

```
Welcome to the project, @{author}! 👋 Great to have you here.

{Content response using the appropriate style above}

{If they can contribute:}
If you're interested in contributing, check out our [README]({link}) for how to get started.
```

**Tone:** Warm, inclusive. Make them feel valued.
**Anti-pattern:** Don't skip the welcome to go straight to the technical answer.

### 6. Status Update

**When:** Stale item (>14 days) with progress to report, or recently fixed.

```
Update on this — {brief status}:

{One of:}
- "This was addressed in [{commit_message}]({link}). Closing as resolved."
- "We're tracking this for {milestone/area}. No timeline yet, but it's on our radar."
- "Still investigating. The complexity is in {brief explanation}."

{If no longer relevant:}
Is this still an issue for you, @{author}? If not, feel free to close it.
```

**Tone:** Transparent, proactive. Show the project is alive and listening.
**Anti-pattern:** Don't leave stale items without any response. Silence = abandonment signal.

---

## Mixing Styles

| Author Status | Content Style | Result |
|---------------|--------------|--------|
| First-time poster | Technical Answer | Welcome greeting + technical answer |
| First-time poster | Bug Acknowledgment | Welcome + "thanks for the report" + status |
| Repeat contributor | Any | Skip welcome, use direct content style |

---

## Writing Quality Rules

| Rule | Description |
|------|-------------|
| **Answer first** | Lead with the answer, not context. User is scrolling for the solution |
| **Link to code** | Every response should have at least one link to relevant file/doc |
| **Thank genuinely** | Vary phrasing: "Thanks for reporting", "Good catch", "Appreciate the detail" |
| **No filler** | Cut "Great question!", "Thanks for reaching out!", "Happy to help!" |
| **Brevity** | 5-15 lines per response. Long answers → collapsible `<details>` |
| **Invite follow-up** | End with "Let us know..." or "Feel free to follow up" |
| **No promises** | Don't commit to timelines or features. Use "we'll consider", "tracking" |

## Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Link-only redirect (no context) | Add 1 sentence explaining what's at the link |
| "Works for me" without investigation | Reproduce or ask for more details |
| Promising features or timelines | Use "we'll consider" / "no timeline yet" |
| Ignoring the actual question | Re-read before composing — answer what was asked |
| Wall of text response | Keep to 5-15 lines, use `<details>` for extras |
| Same greeting every time | Vary: "Thanks for...", "Good catch", "Appreciate the..." |

## Quality Checklist

Before publishing, verify:

- [ ] Response directly answers the question asked (not a tangent)
- [ ] At least one link to relevant code/docs in the repo
- [ ] Author thanked with varied phrasing
- [ ] No promises about timelines or features
- [ ] First-time poster detected and welcomed
- [ ] Response is 5-15 lines (use `<details>` for longer content)
- [ ] All file paths and links verified against repo
- [ ] Ends with follow-up invitation

---

**Version:** 1.0.0
**Last Updated:** 2026-03-14
