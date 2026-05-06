# Git provider credentials

<!-- SCOPE: Provider-specific git/API credential setup for ln-032-vps-project-runtime. -->

Each project owns its own provider secrets in `/etc/${PROJECT_NAME}/secrets.env`. Do not store provider tokens in `.env.local`; local dispatcher config only identifies the VPS and project.

## GitHub

Use GitHub App auth for private repository clone/pull/push and `gh` API calls.

```bash
install -d -o root -g ${BOT_USER} -m 750 /etc/${PROJECT_NAME}
# Operator places ${GITHUB_APP_PRIVATE_KEY_PATH}; owner root:${BOT_USER}, mode 640.
sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8
sudo -u ${BOT_USER} git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=$('${SERVICE_PREFIX}'-mint-gh-token)"; }; f'
```

Expected token prefix: `ghs_`.

## GitLab

Use explicit git and API credentials:

- `GITLAB_GIT_USERNAME` + `GITLAB_GIT_TOKEN`: HTTPS git clone/pull/push. Token needs `read_repository` + `write_repository`.
- `GITLAB_API_TOKEN`: `glab issue list` and MR creation. Token needs `api`.

```bash
sudo -u ${BOT_USER} git config --global credential.helper store
sudo -u ${BOT_USER} bash -lc 'set -a && . /etc/${PROJECT_NAME}/secrets.env && set +a && python3 - <<PY
import os, pathlib, urllib.parse
host = os.environ["GITLAB_HOST"]
line = "https://{}:{}@{}\\n".format(
  urllib.parse.quote(os.environ["GITLAB_GIT_USERNAME"], safe=""),
  urllib.parse.quote(os.environ["GITLAB_GIT_TOKEN"], safe=""),
  host,
)
p = pathlib.Path.home() / ".git-credentials"
existing = p.read_text().splitlines() if p.exists() else []
p.write_text("\\n".join([x for x in existing if ("@" + host) not in x] + [line.rstrip()]) + "\\n")
p.chmod(0o600)
PY'
```

Verify:

```bash
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} ls-remote --heads origin | head -3
sudo -u ${BOT_USER} bash -lc 'set -a && . /etc/${PROJECT_NAME}/secrets.env && set +a && GITLAB_HOST=$GITLAB_HOST GITLAB_TOKEN=$GITLAB_API_TOKEN glab issue list --repo $REPO_SLUG --opened --output json | jq length'
```
