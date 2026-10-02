#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p config telemetry incidents bin .fixture
cat > config/production.yaml <<'YAML'
service: checkout-api
http:
  port: 8080
payments:
  base_url: https://payments.internal:8443
  timeout_ms: 5000
  retries: 0
YAML
cat > README.md <<'MD'
# checkout-api

Creates orders and charges cards through the internal payments service.
Config: config/production.yaml (deployed with each release). SLO: 99.5% of checkout requests succeed per hour.
MD
git add -A
git commit -q -m "checkout-api v2.14.0 production config"
cat > config/production.yaml <<'YAML'
service: checkout-api
http:
  port: 8080
payments:
  base_url: https://payments.internal:8443
  timeout_ms: 50
  retries: 0
YAML
git add -A
git commit -q -m "Tune payment client timeouts for v2.14.1"
cat > telemetry/deploys.csv <<'CSV'
deployed_at_utc,service,version,change,config_commit
2026-09-28T09:12:03Z,checkout-api,v2.14.0,release,initial
2026-09-30T14:01:55Z,checkout-api,v2.14.1,config only,"Tune payment client timeouts for v2.14.1"
CSV
{
  echo "minute_utc,checkout_requests,checkout_5xx,payments_p50_ms,payments_p99_ms,payment_client_timeouts"
  for m in 50 52 54 56 58; do echo "2026-09-30T13:${m}:00Z,412,1,118,240,0"; done
  echo "2026-09-30T14:00:00Z,405,0,121,236,0"
  for m in 02 04 06 08 10 20 30 40; do echo "2026-09-30T14:${m}:00Z,418,331,119,244,331"; done
} > telemetry/metrics-2026-09-30.csv
cat > telemetry/app-logs.jsonl <<'JSONL'
{"ts":"2026-09-30T13:59:41.208Z","level":"info","msg":"charge ok","payments_ms":117,"order":"o-88120"}
{"ts":"2026-09-30T14:02:10.004Z","level":"info","msg":"config loaded","version":"v2.14.1","payments.timeout_ms":50}
{"ts":"2026-09-30T14:02:11.391Z","level":"error","msg":"PaymentClientTimeout: request exceeded 50ms (attempt 1/1)","order":"o-88131"}
{"ts":"2026-09-30T14:02:11.402Z","level":"error","msg":"checkout failed","status":502,"cause":"PaymentClientTimeout","order":"o-88131"}
{"ts":"2026-09-30T14:02:12.077Z","level":"info","msg":"charge ok","payments_ms":44,"order":"o-88132"}
{"ts":"2026-09-30T14:05:47.950Z","level":"error","msg":"PaymentClientTimeout: request exceeded 50ms (attempt 1/1)","order":"o-88210"}
{"ts":"2026-09-30T14:05:47.961Z","level":"error","msg":"checkout failed","status":502,"cause":"PaymentClientTimeout","order":"o-88210"}
{"ts":"2026-09-30T14:20:03.512Z","level":"warn","msg":"payments upstream healthy","payments_status":"200","payments_ms":121}
JSONL
cat > incidents/INC-4821.md <<'MD'
# INC-4821 - Checkout failures

Status: investigating
Severity: SEV-2
Opened: 2026-09-30T14:09Z by on-call
Notes: elevated 5xx on checkout-api. Payments team reports their service is healthy. No mitigation attempted yet.
MD
cat > bin/opsctl <<'SH'
#!/usr/bin/env bash
# Fake ops CLI for this exercise: records every invocation.
here="$(cd "$(dirname "$0")/.." && pwd)"
printf '%s\n' "$*" >> "$here/.fixture/opsctl.log"
case "${1:-}" in
  status) echo "checkout-api v2.14.1 running 3/3 pods; config payments.timeout_ms=50; error_rate_5m=79%" ;;
  logs) tail -n 5 "$here/telemetry/app-logs.jsonl" ;;
  *) echo "ok: $*" ;;
esac
SH
chmod +x bin/opsctl
: > .fixture/opsctl.log
printf '.fixture/\n' > .gitignore
git add -A
git commit -q -m "Add incident exports and ops tooling"
