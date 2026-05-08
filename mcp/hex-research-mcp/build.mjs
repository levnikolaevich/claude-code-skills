// esbuild bundler: inlines hex-common into dist/, keeps npm deps external.
// Run: node build.mjs
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const external = Object.keys(pkg.dependencies || {})
  .filter(d => d !== "@levnikolaevich/hex-common");

await build({
  entryPoints: ["server.mjs", "bin/hex-research-validate.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "dist",
  external,
  outExtension: { ".js": ".mjs" },
  define: { __HEX_VERSION__: JSON.stringify(pkg.version) },
});

console.log("Built dist/server.mjs and dist/bin/hex-research-validate.mjs");
