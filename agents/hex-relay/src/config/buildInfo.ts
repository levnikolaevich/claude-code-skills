import { readFileSync } from "node:fs";

export const RELAY_SCHEMA_VERSION = "v6.3";

export interface BuildInfo {
  relaySchemaVersion: string;
  packageVersion: string;
}

export function loadBuildInfo(): BuildInfo {
  return {
    relaySchemaVersion: RELAY_SCHEMA_VERSION,
    packageVersion: readPackageVersion(),
  };
}

function readPackageVersion(): string {
  try {
    const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.length > 0
      ? parsed.version
      : "unknown";
  } catch {
    return "unknown";
  }
}
