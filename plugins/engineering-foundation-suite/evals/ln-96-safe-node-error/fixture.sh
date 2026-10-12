#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > package.json <<'FIXTURE_CONTENT'
{"type":"module","engines":{"node":">=18"}}
FIXTURE_CONTENT
mkdir -p .
cat > app.mjs <<'FIXTURE_CONTENT'
export async function handle(action, log) {
  try { return await action(); }
  catch (error) { log(error); return {status:500,body:{code:"internal_error",message:error.message}}; }
}
FIXTURE_CONTENT
mkdir -p .
cat > policy.md <<'FIXTURE_CONTENT'
Unknown errors return status 500 and {code: internal_error, message: Please try again later.}. Emit the original error once to the supplied diagnostic owner. Do not expose arbitrary exception details or change the wire shape.
FIXTURE_CONTENT
mkdir -p checks
cat > checks/probe.mjs <<'FIXTURE_CONTENT'
import {handle} from "../app.mjs";
let events=0;
const response=await handle(async()=>{throw new Error("CANARY_PRIVATE_TOKEN")},()=>{events++});
console.log(JSON.stringify({...response,events,secret_exposed:JSON.stringify(response).includes("CANARY_PRIVATE_TOKEN")}));
FIXTURE_CONTENT
mkdir -p checks
cat > checks/verify.py <<'FIXTURE_CONTENT'
import json, subprocess
from pathlib import Path
process = subprocess.run(["node", "checks/probe.mjs"], text=True, capture_output=True, check=True)
observed=json.loads(process.stdout)
expected={"status":500,"body":{"code":"internal_error","message":"Please try again later."},"events":1,"secret_exposed":False}
Path("results").mkdir(exist_ok=True)
Path("results/acceptance.json").write_text(json.dumps(observed,sort_keys=True)+"\n")
assert observed == expected, (observed,expected)
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
