# Fleet registry

<!-- SCOPE: Declarative registry contract for ln-030 fleet plan/apply. -->

Fleet mode reads real environment files from the VPS-local registry:

```text
/etc/agent-fleet/environments/*.yaml
```

The repository `ops/environments/` directory is template-only. It documents the file contract for maintainers, but it is not the source of truth for live fleet membership and must not contain real environment entries.

## Location And Ownership

Create the live registry on each VPS that hosts managed environments:

```bash
sudo install -d -o root -g root -m 755 /etc/agent-fleet/environments
```

Store one root-owned YAML file per managed project environment:

```bash
sudo install -o root -g root -m 644 environment.yaml /etc/agent-fleet/environments/my-project-prod.yaml
```

The files are intentionally readable by operators and bot users because they contain references only. Secret values remain in environment-specific secret files or private providers.

## Shape

Use one file per managed project environment. Keep values flat in v1 so the registry is easy to validate without a custom YAML runtime.

Required fields:

```yaml
environment_id: my-project-prod
runtime_kind: hex-relay
vps_host: 203.0.113.42
vps_ssh_key_ref: ~/.ssh/my-project-vps
bot_user: agent-bot
project_name: my-project
service_prefix: my-project
project_dir: /opt/my-project
repo_url: https://github.com/me/my-project.git
repo_ref: main
target_repo_path: D:\Development\me\my-project
git_provider: github
repo_slug: me/my-project
relay_hook_port: 9999
telegram_enabled: true
telegram_bot_token_ref: /etc/my-project/secrets.env:TELEGRAM_BOT_TOKEN
telegram_chat_id_ref: /etc/my-project/secrets.env:TELEGRAM_CHAT_ID
```

Allowed `runtime_kind` values in v1:
- `hex-relay`
- `openclaw-gateway`
- `hermes-gateway`

## Uniqueness

The registry validator rejects:
- duplicate `environment_id`
- duplicate `(vps_host, service_prefix)`
- duplicate `(vps_host, relay_hook_port)`
- duplicate `(vps_host, project_name)`
- duplicate `(vps_host, project_dir)`

## Secrets

Store references only. Do not store token/key/secret values.

Allowed examples:
- `/etc/my-project/secrets.env:TELEGRAM_BOT_TOKEN`
- `env:OPENAI_API_KEY`
- `op://Private/project/token`
- `file:/run/secrets/project-token`

SOPS-encrypted values are deferred to v2.

## Validation

```bash
node skills-catalog/ln-030-vps-bootstrap/scripts/fleet-registry.mjs validate /etc/agent-fleet/environments
```

The validator is intentionally conservative. If it cannot prove a registry is safe, it fails before any SSH mutation.

## Management Rules

- Create, update, and validate real registry files on the VPS, not in the skills repo.
- Use hash-verified reads/writes or an audited SSH upload flow when changing registry files remotely.
- Keep registry files flat and secret-free.
- Record registry path plus file digest or mtime evidence in every fleet plan artifact.
- Revalidate `/etc/agent-fleet/environments` immediately before `fleet_apply`.
- Abort apply if any selected registry file changed since the approved plan.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05
