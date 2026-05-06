# Infrastructure: {{PROJECT_NAME}}

<!-- SCOPE: Server inventory, network/DNS configuration, port allocation, deployed services, artifact management, CI/CD pipeline, host requirements ONLY. -->
<!-- DO NOT add here: Operational procedures → runbook.md, Architecture patterns → architecture.md, Tech stack versions → tech_stack.md, API contracts → api_spec.md -->
<!-- DOC_KIND: explanation -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need deployment topology, infrastructure inventory, or host-level constraints. -->
<!-- SKIP_WHEN: Skip when you only need operational procedures or feature-level system design. -->
<!-- PRIMARY_SOURCES: docker-compose.yml, infra manifests, ci configs, docs/project/runbook.md -->

> **Status:** {{STATUS}}
> **Last Updated:** {{DATE}}

## Quick Navigation

- [Docs Hub](../README.md)
- [Architecture](architecture.md)
- [Tech Stack](tech_stack.md)
- [Runbook](runbook.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Explains deployed topology, hosts, networking, and environment inventory. |
| Read When | You need server, DNS, CI/CD, or service deployment facts. |
| Skip When | You only need operator steps or business architecture rationale. |
| Canonical | Yes |
| Next Docs | [Runbook](runbook.md), [Architecture](architecture.md), [Tech Stack](tech_stack.md) |
| Primary Sources | `docker-compose.yml`, infra manifests, CI configs, `docs/project/runbook.md` |

## 1. Server Inventory

| Property | {{SERVER_1_ROLE}} | {{SERVER_2_ROLE}} |
|----------|---|---|
| **IP** | {{SERVER_1_IP}} | {{SERVER_2_IP}} |
| **Hostname** | {{SERVER_1_HOSTNAME}} | {{SERVER_2_HOSTNAME}} |
| **SSH** | `ssh {{SERVER_1_SSH_ALIAS}}` | `ssh {{SERVER_2_SSH_ALIAS}}` |
| **OS** | {{SERVER_1_OS}} | {{SERVER_2_OS}} |
| **CPU** | {{SERVER_1_CPU}} | {{SERVER_2_CPU}} |
| **RAM** | {{SERVER_1_RAM}} | {{SERVER_2_RAM}} |
| **Disk** | {{SERVER_1_DISK}} | {{SERVER_2_DISK}} |
| **Docker** | {{SERVER_1_DOCKER}} | {{SERVER_2_DOCKER}} |
<!-- CONDITIONAL: HAS_GPU -->
| **GPU** | {{SERVER_1_GPU}} | {{SERVER_2_GPU}} |
<!-- END CONDITIONAL -->

> **Note:** Remove extra server columns if single-server setup. Add columns for additional servers.

## 2. Domain & DNS

| Domain | Target | Purpose |
|--------|--------|---------|
| {{DOMAIN_1}} | {{DOMAIN_1_TARGET}} | {{DOMAIN_1_PURPOSE}} |
| {{DOMAIN_2}} | {{DOMAIN_2_TARGET}} | {{DOMAIN_2_PURPOSE}} |

<!-- CONDITIONAL: HAS_REVERSE_PROXY -->
### Reverse Proxy

| Property | Value |
|----------|-------|
| **Type** | {{REVERSE_PROXY_TYPE}} |
| **SSL** | {{SSL_PROVIDER}} |
| **Config** | {{REVERSE_PROXY_CONFIG}} |
<!-- END CONDITIONAL -->

## 3. Port Allocation

### {{SERVER_1_ROLE}}

| Port | Service | Protocol | Notes |
|------|---------|----------|-------|
{{PORT_ALLOCATION_SERVER_1}}

<!-- CONDITIONAL: MULTI_SERVER -->
### {{SERVER_2_ROLE}}

| Port | Service | Protocol | Notes |
|------|---------|----------|-------|
{{PORT_ALLOCATION_SERVER_2}}
<!-- END CONDITIONAL -->

## 4. Deployed Services

### {{SERVER_1_ROLE}}

| Service | Image | Notes |
|---------|-------|-------|
{{DEPLOYED_SERVICES_SERVER_1}}

<!-- CONDITIONAL: MULTI_SERVER -->
### {{SERVER_2_ROLE}}

| Service | Image | Notes |
|---------|-------|-------|
{{DEPLOYED_SERVICES_SERVER_2}}
<!-- END CONDITIONAL -->

## 5. Artifact Repository

| Property | Value |
|----------|-------|
| **URL** | {{ARTIFACT_URL}} |
| **Repository** | {{ARTIFACT_REPO}} |
| **Username** | {{ARTIFACT_USER}} |
| **Password** | Managed via {{ARTIFACT_SECRET_MGMT}} |

> If no artifact repository configured: `[TBD: Configure artifact registry]`

## 6. CI/CD Pipeline

| Property | Value |
|----------|-------|
| **Platform** | {{CICD_PLATFORM}} |
| **Config** | {{CICD_CONFIG_FILE}} |
| **Runner** | {{CICD_RUNNER}} |
| **Trigger** | {{CICD_TRIGGER}} |
| **Deploy path** | {{CICD_DEPLOY_PATH}} |

> If no CI/CD configured: `[TBD: Configure CI/CD pipeline]`

## 7. Host Requirements

| Resource | Minimum | Notes |
|----------|---------|-------|
| **RAM** | {{MIN_RAM}} | {{RAM_NOTES}} |
| **Disk** | {{MIN_DISK}} | {{DISK_NOTES}} |
| **CPU** | {{MIN_CPU}} | {{CPU_NOTES}} |
<!-- CONDITIONAL: HAS_GPU -->
| **GPU** | {{MIN_GPU}} | {{GPU_NOTES}} |
<!-- END CONDITIONAL -->

## Maintenance

**Update Triggers:**
- Server hardware changes
- New service deployment
- Domain/DNS changes
- CI/CD pipeline modifications
- Port allocation changes

**Verification:**
```bash
# Check Docker services running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check disk usage
df -h

# Check active ports
ss -tlnp
```

---
