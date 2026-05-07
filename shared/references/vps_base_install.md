# VPS base install

<!-- SCOPE: Host package, git CLI, and service-user setup for ln-030-vps-bootstrap. -->

Run these steps as root on `${VPS_HOST}` via `hex-ssh`.

## 1. Base packages

Install the common package set. `bubblewrap` is the hard filesystem boundary for Claude/Codex work-plane sessions.

```bash
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl wget git jq sqlite3 build-essential ca-certificates gnupg pipx \
  python3 bubblewrap apparmor-profiles apparmor-utils unzip tmux

if [ -f /usr/share/apparmor/extra-profiles/bwrap-userns-restrict ]; then
  install -m 0644 /usr/share/apparmor/extra-profiles/bwrap-userns-restrict /etc/apparmor.d/bwrap-userns-restrict
  apparmor_parser -r /etc/apparmor.d/bwrap-userns-restrict
fi
```

Verify:

```bash
which curl wget git jq sqlite3 gpg pipx python3 bwrap unzip tmux
pipx --version
bwrap --version
tmux -V
stat -c '%A %U:%G' /usr/bin/bwrap | grep -v '^...s'
```

## 2. Git platform CLIs

Install both `gh` and `glab`. They coexist and let one VPS host GitHub and GitLab projects.

```bash
mkdir -p /etc/apt/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y gh

ARCH=$(dpkg --print-architecture)
TAG=$(curl -fsSL https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases | jq -r '.[0].tag_name')
VER=${TAG#v}
curl -fsSL "https://gitlab.com/gitlab-org/cli/-/releases/${TAG}/downloads/glab_${VER}_linux_${ARCH}.deb" -o /tmp/glab-latest.deb
DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/glab-latest.deb
unlink /tmp/glab-latest.deb
```

Verify:

```bash
gh --version
glab --version
```

`glab` must be at least 1.40 because the dispatcher needs `--output json`.

## 3. Service user

```bash
id ${BOT_USER} 2>/dev/null && echo "exists, skipping" || (
  useradd -m -s /bin/bash ${BOT_USER} &&
  mkdir -p /home/${BOT_USER}/.ssh &&
  cp /root/.ssh/authorized_keys /home/${BOT_USER}/.ssh/authorized_keys &&
  chown -R ${BOT_USER}:${BOT_USER} /home/${BOT_USER}/.ssh &&
  chmod 700 /home/${BOT_USER}/.ssh &&
  chmod 600 /home/${BOT_USER}/.ssh/authorized_keys &&
  echo "created"
)
```

Verify:

```bash
id ${BOT_USER}
ls -la /home/${BOT_USER}/.ssh/
```
