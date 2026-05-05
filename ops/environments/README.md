# Fleet environments

This directory is template-only documentation for `ln-030-vps-bootstrap` fleet mode.

Do not store real fleet membership here. Live registry files belong on the VPS at:

```text
/etc/agent-fleet/environments/*.yaml
```

Add one VPS-local `*.yaml` file per managed project environment. Keep registry files declarative and secret-free. Store token values on the VPS or in a private secret provider; store only references such as `/etc/project/secrets.env:TELEGRAM_BOT_TOKEN`.

Validate before plan/apply:

```bash
node skills-catalog/ln-030-vps-bootstrap/scripts/fleet-registry.mjs validate /etc/agent-fleet/environments
```

See `skills-catalog/ln-030-vps-bootstrap/references/fleet_registry.md` for the field contract.
