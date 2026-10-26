#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p docs/requirements docs/plans docs/runtime
cat > docs/requirements/report.md <<'MD'
# Approved report requirements

- RP-1: The report executor must not write to the shared database or alter database roles.
- RP-2: The report's totals and detail rows must describe one consistent snapshot of orders. The validation evidence must refer to that same snapshot.
- RP-3: Normal concurrent application writes must remain available during reporting. The report need not show orders committed after its snapshot began.

No requirement says that all database content must remain unchanged while the executor works. The report has no write-back, delivery or migration step.
MD
cat > docs/runtime/database.md <<'MD'
# Relevant environment

The application uses PostgreSQL 17. A DBA already provisioned a SELECT-only report role; the operator cannot create or alter roles. Native read-only transactions with a repeatable snapshot are available.

The report reads only orders. An independent heartbeat worker inserts into worker_events every ten seconds. The application can update orders concurrently. There are no triggers linking worker_events to orders.

The existing evidence helper reads totals in a separate transaction from the report's detail query. A heartbeat insert does not change report inputs. An orders update between these separate reads can invalidate their comparison, even though the report executor made neither write.
MD
cat > docs/plans/report.md <<'MD'
# Report implementation plan

1. Use the existing report role. Compute a fingerprint of every table before reporting.
2. Fetch the order detail rows and finish that transaction.
3. Ask the existing evidence helper to read current order totals in a new transaction and compare them with the report.
4. Fingerprint every table again. Reject the run if anything changed: a changed fingerprint proves that the report executor violated RP-1. Recompute the fingerprints until a quiet window is available.
5. If the heartbeat prevents a quiet window, add a database clone, a write-attribution log and a coordination service before allowing reporting. Keep the fingerprint condition as a mandatory acceptance gate.

Acceptance: unchanged database fingerprint, matching detail/total values and no observed SQL error. The team has not yet implemented this plan.
MD
git add -A
git commit -q -m "Report requirements and proposed acceptance"
