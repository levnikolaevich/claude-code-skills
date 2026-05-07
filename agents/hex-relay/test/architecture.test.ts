import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcRoot = join(root, "src");

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

function importsFrom(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const imports = [...source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g)];
  return imports.map((match) => match[1] ?? "");
}

test("services do not import concrete infrastructure", () => {
  const violations = tsFiles(join(srcRoot, "services")).flatMap((filePath) =>
    importsFrom(filePath)
      .filter((specifier) => specifier.startsWith("../infrastructure/"))
      .map((specifier) => `${relative(root, filePath)} -> ${specifier}`)
  );

  assert.deepEqual(violations, []);
});

test("domain modules do not import outward layers", () => {
  const violations = tsFiles(join(srcRoot, "domain")).flatMap((filePath) =>
    importsFrom(filePath)
      .filter(
        (specifier) =>
          specifier.startsWith("../services/") ||
          specifier.startsWith("../handlers/") ||
          specifier.startsWith("../workers/") ||
          specifier.startsWith("../infrastructure/")
      )
      .map((specifier) => `${relative(root, filePath)} -> ${specifier}`)
  );

  assert.deepEqual(violations, []);
});
