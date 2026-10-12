#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > access.py <<'FIXTURE_CONTENT'
def read_item(actor, rows, item_id):
    if "read" not in actor["permissions"]:
        return None
    return next((row for row in rows if row["id"] == item_id), None)

def list_items(actor, rows):
    return rows if "read" in actor["permissions"] else []
FIXTURE_CONTENT
mkdir -p .
cat > policy.md <<'FIXTURE_CONTENT'
Trusted actor has company and permissions. A read requires read permission AND matching company. Foreign and nonexistent IDs return None. Lists return only authorized rows. Do not change actor grants or add authentication.
FIXTURE_CONTENT
mkdir -p checks
cat > checks/verify.py <<'FIXTURE_CONTENT'
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from access import read_item, list_items
rows=[{"id":1,"company":"a"},{"id":2,"company":"b"}]
viewer={"company":"a","permissions":["read"]}
other={"company":"b","permissions":[]}
observed={"own":read_item(viewer,rows,1),"foreign":read_item(viewer,rows,2),"missing":read_item(viewer,rows,9),"denied":read_item(other,rows,2),"list":list_items(viewer,rows)}
expected={"own":rows[0],"foreign":None,"missing":None,"denied":None,"list":[rows[0]]}
Path("results").mkdir(exist_ok=True)
Path("results/acceptance.json").write_text(json.dumps(observed, sort_keys=True)+"\n")
assert observed == expected, (observed, expected)
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
