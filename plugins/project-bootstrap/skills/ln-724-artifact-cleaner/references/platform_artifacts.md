# Platform Artifacts Reference

<!-- SCOPE: Platform-specific artifact catalogs for all supported platforms. Contains file lists, detection patterns, cleanup actions. -->
<!-- DO NOT add here: Cleanup workflow → ln-724-artifact-cleaner SKILL.md -->

Artifact catalogs for projects exported from online platforms. Used by ln-724-artifact-cleaner for detection and cleanup.

---

## 1. Configuration Files

| File | Description | Action |
|------|-------------|--------|
| `.replit` | Main Replit configuration (run command, ports, modules) | DELETE |
| `replit.nix` | Nix package configuration for Replit environment | DELETE |
| `.replit.nix` | Alternative Nix config location | DELETE |
| `replit.lock` | Lock file for Replit packages | DELETE |

### .replit Example

```toml
modules = ["nodejs-20", "web", "postgresql-16"]
run = "npm run dev"
hidden = [".config", ".git", "node_modules", "dist"]

[nix]
channel = "stable-24_05"

[[ports]]
localPort = 5000
externalPort = 80

[env]
PORT = "5000"

[deployment]
deploymentTarget = "static"
build = ["npm", "run", "build"]
publicDir = "dist/public"

[workflows]
runButton = "Project"

[agent]
mockupState = "MOCKUP"
```

---

## 2. Directories

| Directory | Description | Action |
|-----------|-------------|--------|
| `.local/` | Local state and cache | DELETE |
| `.local/state/replit/agent/` | Replit Agent state files | DELETE |
| `.cache/` | Replit cache directory | DELETE |
| `.upm/` | Universal Package Manager cache | DELETE |
| `.breakpoints` | Debugger breakpoints | DELETE |
| `.config/` | Replit config cache (if Replit-specific) | DELETE |

### .local/state/replit/agent/ Contents

```
.agent_state_*.bin     # Binary state files (~60-120KB each)
.agent_state_main.bin  # Main agent state
.latest.json           # Latest state pointer {"latest": "main"}
repl_state.bin         # Repl-level state
```

---

## 3. NPM Packages

| Package | Purpose | Action |
|---------|---------|--------|
| `@replit/vite-plugin-cartographer` | File navigation in Replit IDE | REMOVE |
| `@replit/vite-plugin-dev-banner` | Development banner in Replit | REMOVE |
| `@replit/vite-plugin-runtime-error-modal` | Error overlay in Replit | REMOVE |
| `@replit/agent` | Replit Agent SDK (if present) | REMOVE |
| `@replit/database` | Replit Database client | REMOVE |
| `@replit/object-storage` | Replit Object Storage client | REMOVE |

### Detection Pattern

```json
{
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^0.4.4",
    "@replit/vite-plugin-dev-banner": "^0.1.1",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.4"
  }
}
```

---

## 4. Vite Configuration

### Imports to Remove

```typescript
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";
```

### Plugins to Remove

```typescript
plugins: [
  runtimeErrorOverlay(),  // REMOVE
  metaImagesPlugin(),     // REMOVE (if Replit-specific)
]
```

### REPL_ID Conditional Block

```typescript
// REMOVE entire block
...(process.env.NODE_ENV !== "production" &&
process.env.REPL_ID !== undefined
  ? [
      await import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer(),
      ),
      await import("@replit/vite-plugin-dev-banner").then((m) =>
        m.devBanner(),
      ),
    ]
  : []),
```

---

## 5. Custom Replit Plugins

### vite-plugin-meta-images.ts

**Purpose:** Updates OpenGraph meta tags with Replit deployment domain.

**Why Remove:** Uses `REPLIT_INTERNAL_APP_DOMAIN` and `REPLIT_DEV_DOMAIN` environment variables that don't exist outside Replit.

```typescript
// Replit-specific environment checks
if (process.env.REPLIT_INTERNAL_APP_DOMAIN) {
  const url = `https://${process.env.REPLIT_INTERNAL_APP_DOMAIN}`;
}

if (process.env.REPLIT_DEV_DOMAIN) {
  const url = `https://${process.env.REPLIT_DEV_DOMAIN}`;
}
```

---

## 6. Environment Variables

| Variable | Description | Action |
|----------|-------------|--------|
| `REPL_ID` | Unique Replit project ID | Remove from code checks |
| `REPL_SLUG` | Project slug | Remove from code checks |
| `REPL_OWNER` | Project owner username | Remove from code checks |
| `REPLIT_INTERNAL_APP_DOMAIN` | Internal deployment domain | Remove from code |
| `REPLIT_DEV_DOMAIN` | Development domain | Remove from code |
| `REPLIT_DB_URL` | Replit Database URL | Replace with standard DB URL |

### Detection Pattern

```typescript
// In code
process.env.REPL_ID
process.env.REPLIT_*
```

---

## 7. Code Comments

### @replit Annotations

Used by Replit to mark customized UI components:

```typescript
// @replit: no hover, and add primary border
// @replit Shows the background color
// @replit border, no hover, no shadow
// @replit no hover, transparent border
// @replit changed sizes
// @replit shadow-xs instead of shadow
```

**Action:** Remove comment lines, keep the code.

### Detection Pattern

```regex
// @replit.*$
```

### Common Locations

- `client/src/components/ui/button.tsx`
- `client/src/components/ui/badge.tsx`
- `client/src/components/ui/card.tsx`
- `client/src/components/ui/*.tsx`

---

## 8. .gitignore Entries

```gitignore
# Replit-specific entries
.replit
.cache
.local
.upm
.breakpoints
```

**Action:** Remove `.replit` line (others may be useful for general development).

---

## 9. Other Potential Artifacts

| Artifact | Description | Action |
|----------|-------------|--------|
| `generated-icon.png` | Auto-generated Replit icon | DELETE (optional) |
| `.replit-ghapi` | GitHub API integration cache | DELETE |
| `replit_zip_error_log.txt` | Export error log | DELETE |

---

## Detection Checklist

```yaml
Phase 1 Scan:
  - [ ] Glob: .replit, replit.nix, .replit.nix, replit.lock
  - [ ] Glob: .local/, .cache/, .upm/, .breakpoints
  - [ ] Grep: "@replit/" in package.json
  - [ ] Grep: "@replit/" in *.config.ts
  - [ ] Grep: "REPL_ID" or "REPLIT_" in **/*.ts
  - [ ] Grep: "// @replit" in **/*.tsx
  - [ ] Grep: "^\.replit$" in .gitignore
```

---

## Platform Detection Matrix

| Platform | Primary Indicator | Secondary Indicators | NPM Packages |
|----------|-------------------|---------------------|--------------|
| **Replit** | `.replit` file | `replit.nix`, `.local/state/replit/` | `@replit/*` |
| **StackBlitz** | `.stackblitzrc` | `turbo.json` (StackBlitz-specific) | -- |
| **CodeSandbox** | `sandbox.config.json` | `.codesandbox/` directory | -- |
| **Glitch** | `glitch.json` | `.glitch-assets`, `.data/` | -- |

---

## StackBlitz Artifacts

| Category | Artifact | Action |
|----------|----------|--------|
| **Config** | `.stackblitzrc` | DELETE |
| **Directories** | `.turbo/` (if not used in production) | DELETE |
| **Build Config** | StackBlitz-specific port overrides in vite.config.ts | MODIFY |

**Detection:**
```yaml
Files: .stackblitzrc
Dirs: .turbo/ (conditional - check if turbo used in prod)
Code: Grep for "stackblitz" in vite.config.ts, webpack.config.js
```

---

## CodeSandbox Artifacts

| Category | Artifact | Action |
|----------|----------|--------|
| **Config** | `sandbox.config.json` | DELETE |
| **Directories** | `.codesandbox/` | DELETE |
| **Package.json** | `"sandbox"` field | REMOVE field |

**Detection:**
```yaml
Files: sandbox.config.json
Dirs: .codesandbox/
Code: Grep for "CODESANDBOX_HOST" in **/*.ts, **/*.js
```

---

## Glitch Artifacts

| Category | Artifact | Action |
|----------|----------|--------|
| **Config** | `glitch.json`, `.glitch-assets` | DELETE |
| **Directories** | `.glitch/` | DELETE |
| **Directories** | `.data/` | ASK USER (may contain important data) |
| **Env Vars** | `PROJECT_DOMAIN`, `PROJECT_NAME`, `ASSETS_URL` | Remove checks from code |

**Detection:**
```yaml
Files: glitch.json, .glitch-assets
Dirs: .glitch/, .data/
Code: Grep for "PROJECT_DOMAIN", "ASSETS_URL" in server code
```

---

## Generic Prototype Artifacts

Common artifacts in early-stage projects regardless of platform:

| Artifact | Description | Action |
|----------|-------------|--------|
| `node_modules/` in git | Accidentally committed deps | Add to .gitignore, remove from tracking |
| Multiple lock files | Both package-lock.json and yarn.lock | Keep one, delete others |
| Hardcoded `localhost:*` | Dev-only URLs in source | Flag for replacement with env vars |
| `.env` in git | Exposed secrets | Remove from tracking, add to .gitignore |
| `TODO.md`, `NOTES.md` | Dev notes in root | Move to docs/ or delete |

---

**Version:** 2.0.0
**Last Updated:** 2026-02-07
