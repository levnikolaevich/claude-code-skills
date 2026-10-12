#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > config.py <<'FIXTURE_CONTENT'
def load(env):
    return {"database": env.get("DB_NAME") or "shared_billing"}
FIXTURE_CONTENT
mkdir -p .
cat > README.md <<'FIXTURE_CONTENT'
Local mode requires APP_MODE=local and a nonempty DB_NAME beginning run_. Missing or invalid values must raise ValueError before any connection. No aliases or shared fallback are supported.
FIXTURE_CONTENT
mkdir -p checks
cat > checks/verify.py <<'FIXTURE_CONTENT'
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import load
observed={}
for name, env in [("valid", {"APP_MODE":"local","DB_NAME":"run_abc"}), ("missing",{}), ("shared",{"APP_MODE":"local","DB_NAME":"shared_billing"}), ("empty",{"APP_MODE":"local","DB_NAME":""})]:
    try:
        cfg=load(env)
        observed[name]=cfg["database"]
    except ValueError:
        observed[name]="rejected"
expected={"valid":"run_abc","missing":"rejected","shared":"rejected","empty":"rejected"}
Path("results").mkdir(exist_ok=True)
Path("results/acceptance.json").write_text(json.dumps(observed, sort_keys=True)+"\n")
assert observed == expected, (observed, expected)
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
