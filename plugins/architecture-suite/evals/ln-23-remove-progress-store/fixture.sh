#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p app docs/requirements docs/proposals
cat > docs/requirements/export.md <<'MD'
# Catalog export: approved requirements

- EX-1: An operator exports one immutable input file to a catalog file on the same local filesystem.
- EX-2: Readers must see either the previous complete catalog or the new complete catalog, never partial output.
- EX-3: Failure leaves the previous catalog usable. Retrying from the original input is sufficient; resumable progress is not required.
- EX-4: Preserve the command's exit status and completion/error message. No API or UI for progress is required.

The single-operator tool runs on one workstation. Concurrent exports are prevented by the existing scheduler. The largest supported input finishes within one minute. There are no other consumers of internal export state and no additional audit or durability requirements.
MD
cat > docs/proposals/export.md <<'MD'
# Proposed implementation design, not yet accepted

Keep the current same-directory atomic file replacement. Add progress.sqlite so an operator can inspect percentage complete later, although no such interface is planned in this increment.

Since progress commits and file replacement cannot be one transaction, add an export journal, a startup reconciliation command and a recovery-state diagram. Give the scheduler a new preflight: refuse another export until the journal and progress table agree. Add failure-injection coverage for all journal/progress combinations and retain both databases indefinitely for troubleshooting.

The design discussion so far has focused on which reconciliation states we need. No consumer of the progress table other than the proposed reconciler has been identified.
MD
cat > app/export.py <<'PY'
import os
import tempfile
from pathlib import Path


def publish(source, destination):
    destination = Path(destination)
    pending = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as stream:
            pending = Path(stream.name)
            stream.write(Path(source).read_bytes())
        os.replace(pending, destination)
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)
PY
git add -A
git commit -q -m "Catalog export baseline"
