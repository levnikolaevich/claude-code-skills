import { test } from "node:test";
import assert from "node:assert/strict";
import { toTelegramMarkdownV2 } from "../src/lib/telegramMarkdown.js";

test("converts headings to bold", () => {
  const out = toTelegramMarkdownV2("# Title\n\nbody");
  assert.notEqual(out, null);
  assert.ok(out!.includes("*Title*"), `expected bold heading, got: ${out}`);
});

test("escapes special chars in prose", () => {
  const out = toTelegramMarkdownV2("Hello (world)! 1+1=2.");
  assert.notEqual(out, null);
  // MarkdownV2 reserves ( ) ! + = . — must be escaped with \
  assert.ok(out!.includes(String.raw`\(`));
  assert.ok(out!.includes(String.raw`\)`));
  assert.ok(out!.includes(String.raw`\!`));
  assert.ok(out!.includes(String.raw`\.`));
});

test("preserves fenced code block", () => {
  const input = "```python\nprint('hi')\n```";
  const out = toTelegramMarkdownV2(input);
  assert.notEqual(out, null);
  // telegramify-markdown 1.x rewrites the opening fence without a language tag.
  assert.ok(out!.startsWith("```"), `expected opening fence, got: ${out}`);
  assert.ok(out!.includes("print"), `expected code body, got: ${out}`);
  assert.ok(out!.trim().endsWith("```"), `expected closing fence, got: ${out}`);
});

test("returns null when conversion throws on bad input", () => {
  // Numeric input causes an internal error inside the converter.
  const out = toTelegramMarkdownV2(42 as unknown as string);
  assert.equal(out, null);
});
