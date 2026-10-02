#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p docs analytics
cat > docs/hypothesis-H-12.md <<'MD'
# H-12 - Smart templates

Written: 2026-06-18 by the product owner.

- Capability: smart templates (suggested document templates in the "New document" dialog).
- Hypothesis: smart templates increase documents created per active team per week.
- Primary metric: documents created per active team per week (`docs_created / active_teams`).
- Guardrail: support tickets about document creation must not increase.
- Target: to be set after launch.
- Comparison: none planned.
MD
cat > docs/launch-notes.md <<'MD'
# Launch and business events, summer 2026

- 2026-08-03: Acme Corp enterprise contract went live; 140 Acme teams onboarded in one batch.
- 2026-08-04: Smart templates released in v3.2 to 100% of teams (no holdout).
- 2026-08-10: "Back to school" campaign started, targeting student teams on the free tier; runs until 2026-10-31.
MD
cat > docs/leadership-thread-2026-09-25.md <<'MD'
# Leadership thread (exported 2026-09-25)

- CEO: Docs created are up almost 50% since July. Templates are a hit.
- VP Product: Let's call +20% the success bar for templates and green-light phase 2.
MD
cat > analytics/weekly_usage.csv <<'CSV'
week_start,active_teams,active_acme_teams,new_self_serve_teams,new_campaign_teams,docs_created,docs_created_from_template
2026-07-06,1210,0,38,0,25410,0
2026-07-13,1198,0,41,0,25160,0
2026-07-20,1215,0,36,0,25520,0
2026-07-27,1206,0,40,0,25330,0
2026-08-03,1352,140,39,0,29070,3410
2026-08-10,1420,141,37,52,30530,3980
2026-08-17,1488,142,40,61,32290,4420
2026-08-24,1551,142,38,58,33970,4810
2026-08-31,1610,141,41,64,35260,5100
2026-09-07,1665,142,39,60,36460,5390
2026-09-14,1702,141,37,55,37100,5530
2026-09-21,1731,142,40,49,37560,5640
CSV
cat > analytics/README.md <<'MD'
# Analytics exports

- weekly_usage.csv: product event warehouse, weeks start Monday (UTC). `active_teams` counts teams with at least one session in the week, including Acme and campaign teams. Team-level rows and per-cohort document counts are not exported.
- Support ticket data for the guardrail was not exported.
MD
git add -A
git commit -q -m "H-12 hypothesis, launch notes and usage exports"
