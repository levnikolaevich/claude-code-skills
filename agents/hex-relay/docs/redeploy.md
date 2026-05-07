# hex-relay redeploy after source changes

<!-- SCOPE: Update procedure for ln-030 hex-relay code after the VPS is already bootstrapped. -->

Use this when any file under `agents/hex-relay/` changes. Do not edit `dist/` on the VPS and do not upload `node_modules/`.

## Inputs

- `${SERVICE_PREFIX}`: project service prefix; tmux socket and hex-relay directory derive from it.
- `${PROJECT_NAME}`: state/config dir name.
- `${BOT_USER}`: shared Linux user that owns `/opt/${SERVICE_PREFIX}-hex-relay`.

## Procedure

```bash
# 1. Build artifact from local source, excluding generated/install output.
tar -czf /tmp/${SERVICE_PREFIX}-hex-relay-src.tgz \
  --exclude node_modules \
  --exclude dist \
  --exclude .hex-skills \
  --exclude .codegraph \
  --exclude .cache \
  --exclude '*.tgz' \
  --exclude '*.tsbuildinfo' \
  -C agents/hex-relay .

# 2. Upload /tmp/${SERVICE_PREFIX}-hex-relay-src.tgz to the VPS.

# 3. Replace source on VPS, build there with Node from nvm, prune dev deps, restart service.
systemctl stop ${SERVICE_PREFIX}-hex-relay.service
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 /opt/${SERVICE_PREFIX}-hex-relay
find /opt/${SERVICE_PREFIX}-hex-relay -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf /tmp/${SERVICE_PREFIX}-hex-relay-src.tgz -C /opt/${SERVICE_PREFIX}-hex-relay
chown -R ${BOT_USER}:${BOT_USER} /opt/${SERVICE_PREFIX}-hex-relay
sudo -i -u ${BOT_USER} bash -lc 'cd /opt/${SERVICE_PREFIX}-hex-relay && . /home/${BOT_USER}/.nvm/nvm.sh && npm ci && npm run build && ./node_modules/.bin/tsc --version'
systemctl start ${SERVICE_PREFIX}-hex-relay.service
```

## Verify

```bash
systemctl is-active ${SERVICE_PREFIX}-hex-relay.service
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
test -d /opt/${SERVICE_PREFIX}-hex-relay/dist
test -x /opt/${SERVICE_PREFIX}-hex-relay/node_modules/.bin/tsc
sudo -u ${BOT_USER} install -d -m 750 /var/lib/${PROJECT_NAME}/tg-media
sudo -u ${BOT_USER} test -w /var/lib/${PROJECT_NAME}/tg-media
journalctl -u ${SERVICE_PREFIX}-hex-relay.service -n 50 --no-pager
```

Restart active `${SERVICE_PREFIX}-god@*.service` instances only when hooks, project-scope `.claude/settings.json`, or god-session instructions changed. hex-relay source-only changes require only `${SERVICE_PREFIX}-hex-relay.service` restart.

## Optional Local Voice Transcription

Voice support does not use Python, cloud ASR, or `ai-services-hub`. The VPS only needs:

```bash
command -v ffmpeg
test -x /opt/whisper.cpp/build/bin/whisper-cli
test -f /opt/whisper.cpp/models/ggml-small-q5_1.bin
```

Enable it in `/etc/${PROJECT_NAME}/secrets.env`:

```bash
RELAY_VOICE_TRANSCRIPTION=local
FFMPEG_BIN=ffmpeg
WHISPER_CPP_BIN=/opt/whisper.cpp/build/bin/whisper-cli
WHISPER_CPP_MODEL=/opt/whisper.cpp/models/ggml-small-q5_1.bin
```

Voice originals plus temporary WAV/transcript files stay under `/var/lib/${PROJECT_NAME}/tg-media`.
That path is outside the project checkout and is writable by `${SERVICE_PREFIX}-hex-relay.service`
through its `ReadWritePaths=/var/lib/${PROJECT_NAME}` sandbox entry. Do not create it as root
during verification; use `sudo -u ${BOT_USER}` so relay can clean up and continue writing.

`whisper.cpp` runs as a child of `${SERVICE_PREFIX}-hex-relay.service`, so the service cgroup
CPU and memory limits must fit the selected model. The current template uses `CPUQuota=200%`
and `MemoryMax=1G`; existing deployed units with older `CPUQuota=50%` or `MemoryMax=256M`
need a unit re-render or systemd override before `RELAY_VOICE_TRANSCRIPTION=local` will be
reliable.
