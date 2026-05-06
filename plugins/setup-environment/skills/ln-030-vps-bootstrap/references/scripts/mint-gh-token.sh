#!/bin/bash
# ${SERVICE_PREFIX}-mint-gh-token — mints a GitHub App installation access token (~1h validity).
# Reads APP_ID / INSTALL_ID / PEM_PATH from /etc/${PROJECT_NAME}/secrets.env.
# Writes the bare token to stdout. Use as:  GH_TOKEN=$(${SERVICE_PREFIX}-mint-gh-token) gh ...
#
# Required env keys in secrets.env:
#   GITHUB_APP_ID
#   GITHUB_INSTALLATION_ID
#   GITHUB_APP_PRIVATE_KEY_PATH   # PEM file owned by ${BOT_USER}, mode 640
set -euo pipefail
SECRETS=/etc/${PROJECT_NAME}/secrets.env
[[ -r "$SECRETS" ]] || { echo "cannot read $SECRETS" >&2; exit 1; }
set -a; . "$SECRETS"; set +a
: "${GITHUB_APP_ID:?missing GITHUB_APP_ID in secrets.env}"
: "${GITHUB_INSTALLATION_ID:?missing GITHUB_INSTALLATION_ID in secrets.env}"
: "${GITHUB_APP_PRIVATE_KEY_PATH:?missing GITHUB_APP_PRIVATE_KEY_PATH in secrets.env}"
[[ -r "$GITHUB_APP_PRIVATE_KEY_PATH" ]] || { echo "cannot read PEM at $GITHUB_APP_PRIVATE_KEY_PATH" >&2; exit 1; }

NOW=$(date +%s)
b64url() { base64 -w0 | tr -d '=' | tr '+/' '-_'; }
HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
PAYLOAD=$(printf '{"iat":%s,"exp":%s,"iss":%s}' $((NOW-60)) $((NOW+540)) "$GITHUB_APP_ID" | b64url)
SIG=$(printf '%s.%s' "$HEADER" "$PAYLOAD" | openssl dgst -sha256 -sign "$GITHUB_APP_PRIVATE_KEY_PATH" | b64url)
JWT="$HEADER.$PAYLOAD.$SIG"

curl -fsS -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/$GITHUB_INSTALLATION_ID/access_tokens" \
  | jq -er .token
