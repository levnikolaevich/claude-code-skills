import { test } from "node:test";
import assert from "node:assert/strict";
import { splitForTelegramMarkdown, utf16Len } from "../src/lib/telegramSplit.js";

const SHORT_LIMIT = 200;

test("short text returns single chunk", () => {
  const text = "hello world";
  const chunks = splitForTelegramMarkdown(text, SHORT_LIMIT);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("long prose splits on paragraph break", () => {
  const para1 = "alpha ".repeat(20).trim();
  const para2 = "beta ".repeat(20).trim();
  const para3 = "gamma ".repeat(20).trim();
  const text = [para1, para2, para3].join("\n\n");
  const limit = utf16Len(para1) + 5;
  const chunks = splitForTelegramMarkdown(text, limit);
  assert.ok(chunks.length >= 2, `expected multiple chunks, got ${chunks.length}`);
  for (const c of chunks) {
    assert.ok(utf16Len(c) <= limit, `chunk exceeds limit: ${utf16Len(c)} > ${limit}`);
  }
  assert.ok(chunks.some((c) => c.includes("alpha")));
  assert.ok(chunks.some((c) => c.includes("gamma")));
});

test("long fenced code block splits with fence reopen and same language", () => {
  const codeLines: string[] = [];
  for (let i = 0; i < 40; i++) codeLines.push(`print(${i})`);
  const text = "```python\n" + codeLines.join("\n") + "\n```";
  const limit = 120;
  const chunks = splitForTelegramMarkdown(text, limit);
  assert.ok(chunks.length >= 2, `expected multiple chunks, got ${chunks.length}`);
  for (const [i, chunk] of chunks.entries()) {
    assert.ok(
      chunk.startsWith("```python"),
      `chunk ${i} should start with opening fence: ${chunk}`
    );
    assert.ok(chunk.endsWith("```"), `chunk ${i} should end with closing fence: ${chunk}`);
  }
});

test("mixed prose plus fence plus prose with cut inside the fence", () => {
  const intro = "Intro paragraph about something.";
  const codeLines: string[] = [];
  for (let i = 0; i < 30; i++) codeLines.push(`line${i}();`);
  const outro = "Outro paragraph after the code.";
  const text = `${intro}\n\n\`\`\`js\n${codeLines.join("\n")}\n\`\`\`\n\n${outro}`;
  const limit = 100;
  const chunks = splitForTelegramMarkdown(text, limit);
  assert.ok(chunks.length >= 3, `expected at least 3 chunks, got ${chunks.length}`);
  let openFences = 0;
  let closeFences = 0;
  for (const c of chunks) {
    const matches = c.match(/```/g) ?? [];
    assert.equal(matches.length % 2, 0, `unbalanced fences in chunk: ${c}`);
    for (const m of c.split("\n")) {
      if (m.startsWith("```")) {
        if (m === "```") closeFences++;
        else openFences++;
      }
    }
  }
  assert.ok(openFences >= 1);
  assert.ok(closeFences >= 1);
});

test("two consecutive fences correctly tracked", () => {
  const a = "```ts\nconst a = 1;\n```";
  const b = "```py\nprint('b')\n```";
  const text = `${a}\n\n${b}`;
  const chunks = splitForTelegramMarkdown(text, 4096);
  assert.equal(chunks.length, 1);
  const only = chunks[0] ?? "";
  assert.ok(only.includes("```ts"));
  assert.ok(only.includes("```py"));
  const fenceCount = (only.match(/```/g) ?? []).length;
  assert.equal(fenceCount, 4);
});

test("returns at least one chunk for empty input", () => {
  const chunks = splitForTelegramMarkdown("", SHORT_LIMIT);
  assert.equal(chunks.length, 1);
});
