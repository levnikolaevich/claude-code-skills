import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [,, resultsDir, expectationsFile, date, outputFile, extraSessionId = "", extraSessionLabel = ""] = process.argv;
if (!resultsDir || !expectationsFile || !date) {
    process.stderr.write("Usage: node parse-results.mjs <results-dir> <expectations.json> <date> [output.md] [extra-session-id] [extra-session-label]\n");
    process.exit(1);
}

function safeRead(file) {
    return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function safeJson(file) {
    const text = safeRead(file);
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function parseChangedFiles(diffText) {
    const files = new Set();
    for (const match of diffText.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
        files.add(match[2]);
    }
    return [...files].sort();
}

function parseSession(jsonlFile, kind, preflight) {
    const raw = safeRead(jsonlFile).trim();
    const events = raw
        ? raw.split("\n").map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean)
        : [];

    const result = events.find((event) => event.type === "result");
    const init = events.find((event) => event.type === "system" && event.subtype === "init");
    const sessionStart = events.find((event) =>
        event.type === "system" &&
        event.subtype === "hook_response" &&
        event.hook_event === "SessionStart"
    );

    const toolCounts = {};
    const uses = [];
    const bashCommands = [];
    let assistantTurn = 0;
    for (const event of events) {
        if (event.type !== "assistant" || !event.message?.content) continue;
        assistantTurn++;
        for (const block of event.message.content) {
            if (block.type !== "tool_use") continue;
            toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
            uses.push({ name: block.name, assistantTurn });
            if (block.name === "Bash" && block.input?.command) bashCommands.push(block.input.command);
        }
    }

    const firstHexUse = uses.find((entry) => entry.name.startsWith("mcp__hex-line__"));
    const firstToolSearch = uses.find((entry) => entry.name === "ToolSearch");
    const invalidReasons = [];
    if (!result) invalidReasons.push("missing result event");
    if (!init) invalidReasons.push("missing init event");
    if (kind === "hexline") {
        const tools = init?.tools || [];
        const servers = init?.mcp_servers || [];
        const hexServer = servers.find((server) => server.name === "hex-line");
        if (!tools.some((tool) => tool.startsWith("mcp__hex-line__"))) invalidReasons.push("hex-line tools missing from init");
        if (!hexServer || hexServer.status !== "connected") invalidReasons.push("hex-line MCP not connected");
        if (!sessionStart) invalidReasons.push("missing SessionStart hook response");
        if (!firstHexUse) invalidReasons.push("no hex-line tool call observed");
        if (preflight?.sessionStartOk === false) invalidReasons.push("SessionStart preflight failed");
    }

    return {
        valid: invalidReasons.length === 0,
        invalidReasons,
        turns: result?.num_turns ?? 0,
        durationMs: result?.duration_ms ?? 0,
        durationApiMs: result?.duration_api_ms ?? 0,
        cost: result?.total_cost_usd ?? 0,
        outputTokens: result?.usage?.output_tokens ?? 0,
        cacheCreation: result?.usage?.cache_creation_input_tokens ?? 0,
        cacheRead: result?.usage?.cache_read_input_tokens ?? 0,
        toolCounts,
        totalTools: Object.values(toolCounts).reduce((sum, count) => sum + count, 0),
        sessionStartOk: Boolean(sessionStart),
        firstHexToolTurn: firstHexUse?.assistantTurn ?? null,
        firstToolSearchTurn: firstToolSearch?.assistantTurn ?? null,
        activationSuccess: kind === "hexline" ? invalidReasons.length === 0 && Boolean(firstHexUse) : true,
        toolMisuseDetected: kind === "hexline" && Boolean(firstToolSearch && (!firstHexUse || firstToolSearch.assistantTurn <= firstHexUse.assistantTurn)),
        taskCompleted: Boolean(result && !result.is_error),
        resultText: result?.result || "",
        bashCommands,
    };
}

function evaluateScenario(session, scenario, diffText) {
    const changedFiles = parseChangedFiles(diffText);
    const reasons = [];
    const expectedFiles = scenario.expectedChangedFiles || [];
    const forbiddenFiles = scenario.forbiddenChangedFiles || [];
    const requiredDiffPatterns = scenario.requiredDiffPatterns || [];
    const forbiddenDiffPatterns = scenario.forbiddenDiffPatterns || [];
    const requiredResultPatterns = scenario.requiredResultPatterns || [];
    const requiredCommands = scenario.requiredCommands || [];

    if (!session.valid) reasons.push(`invalid run: ${session.invalidReasons.join("; ")}`);
    if (!session.taskCompleted) reasons.push("session did not complete successfully");

    for (const file of expectedFiles) {
        if (!changedFiles.includes(file)) reasons.push(`missing changed file: ${file}`);
    }
    if (scenario.exactChangedFiles === true) {
        const extras = changedFiles.filter((file) => !expectedFiles.includes(file));
        if (extras.length > 0) reasons.push(`unexpected changed files: ${extras.join(", ")}`);
    }
    for (const file of forbiddenFiles) {
        if (changedFiles.includes(file)) reasons.push(`forbidden changed file: ${file}`);
    }

    for (const pattern of requiredDiffPatterns) {
        if (!new RegExp(pattern, "m").test(diffText)) reasons.push(`missing diff pattern: ${pattern}`);
    }
    for (const pattern of forbiddenDiffPatterns) {
        if (new RegExp(pattern, "m").test(diffText)) reasons.push(`forbidden diff pattern: ${pattern}`);
    }
    for (const pattern of requiredResultPatterns) {
        if (!new RegExp(pattern, "im").test(session.resultText)) reasons.push(`missing result pattern: ${pattern}`);
    }
    for (const pattern of requiredCommands) {
        if (!session.bashCommands.some((command) => new RegExp(pattern, "i").test(command))) {
            reasons.push(`missing command: ${pattern}`);
        }
    }

    return {
        pass: reasons.length === 0,
        reasons,
        changedFiles,
    };
}

function loadScenarioResults(scenarios, preflight, extraId) {
    return scenarios.map((scenario) => {
        const builtinBase = resolve(resultsDir, `${date}-${scenario.id}-builtin`);
        const hexlineBase = resolve(resultsDir, `${date}-${scenario.id}-hexline`);
        const builtinSession = parseSession(`${builtinBase}.jsonl`, "builtin", preflight);
        const hexlineSession = parseSession(`${hexlineBase}.jsonl`, "hexline", preflight);
        const builtinDiff = safeRead(`${builtinBase}.diff.txt`);
        const hexlineDiff = safeRead(`${hexlineBase}.diff.txt`);
        const result = {
            scenario,
            builtin: {
                ...builtinSession,
                diffText: builtinDiff,
                evaluation: evaluateScenario(builtinSession, scenario, builtinDiff),
            },
            hexline: {
                ...hexlineSession,
                diffText: hexlineDiff,
                evaluation: evaluateScenario(hexlineSession, scenario, hexlineDiff),
            },
        };
        if (extraId) {
            const extraBase = resolve(resultsDir, `${date}-${scenario.id}-${extraId}`);
            const extraSession = parseSession(`${extraBase}.jsonl`, "extra", preflight);
            const extraDiff = safeRead(`${extraBase}.diff.txt`);
            result.extra = {
                ...extraSession,
                diffText: extraDiff,
                evaluation: evaluateScenario(extraSession, scenario, extraDiff),
            };
        }
        return result;
    });
}

function boolLabel(value) {
    return value ? "PASS" : "FAIL";
}

function delta(base, candidate, digits = 0) {
    if (!Number.isFinite(base) || base === 0) return "N/A";
    return `${(((candidate - base) / base) * 100).toFixed(digits)}%`;
}

function sum(items, selector) {
    return items.reduce((total, item) => total + selector(item), 0);
}

const expectations = safeJson(expectationsFile);
if (!expectations?.scenarios?.length) {
    throw new Error("expectations.json must contain a non-empty scenarios array");
}

const preflight = safeJson(resolve(resultsDir, `${date}-hexline.preflight.json`));
const hasExtraSession = extraSessionId.length > 0;
const resolvedExtraLabel = extraSessionLabel || extraSessionId;
const scenarioResults = loadScenarioResults(expectations.scenarios, preflight, extraSessionId);

const builtinTotals = {
    turns: sum(scenarioResults, (item) => item.builtin.turns),
    durationMs: sum(scenarioResults, (item) => item.builtin.durationMs),
    durationApiMs: sum(scenarioResults, (item) => item.builtin.durationApiMs),
    cost: sum(scenarioResults, (item) => item.builtin.cost),
    outputTokens: sum(scenarioResults, (item) => item.builtin.outputTokens),
    cacheCreation: sum(scenarioResults, (item) => item.builtin.cacheCreation),
    cacheRead: sum(scenarioResults, (item) => item.builtin.cacheRead),
    totalTools: sum(scenarioResults, (item) => item.builtin.totalTools),
};

const hexlineTotals = {
    turns: sum(scenarioResults, (item) => item.hexline.turns),
    durationMs: sum(scenarioResults, (item) => item.hexline.durationMs),
    durationApiMs: sum(scenarioResults, (item) => item.hexline.durationApiMs),
    cost: sum(scenarioResults, (item) => item.hexline.cost),
    outputTokens: sum(scenarioResults, (item) => item.hexline.outputTokens),
    cacheCreation: sum(scenarioResults, (item) => item.hexline.cacheCreation),
    cacheRead: sum(scenarioResults, (item) => item.hexline.cacheRead),
    totalTools: sum(scenarioResults, (item) => item.hexline.totalTools),
};

const extraTotals = hasExtraSession
    ? {
        turns: sum(scenarioResults, (item) => item.extra.turns),
        durationMs: sum(scenarioResults, (item) => item.extra.durationMs),
        durationApiMs: sum(scenarioResults, (item) => item.extra.durationApiMs),
        cost: sum(scenarioResults, (item) => item.extra.cost),
        outputTokens: sum(scenarioResults, (item) => item.extra.outputTokens),
        cacheCreation: sum(scenarioResults, (item) => item.extra.cacheCreation),
        cacheRead: sum(scenarioResults, (item) => item.extra.cacheRead),
        totalTools: sum(scenarioResults, (item) => item.extra.totalTools),
    }
    : null;

const scenarioRows = scenarioResults.map((item) => {
    const builtinReasons = item.builtin.evaluation.reasons.join("; ") || "-";
    const hexlineReasons = item.hexline.evaluation.reasons.join("; ") || "-";
    const builtinFiles = item.builtin.evaluation.changedFiles.join(", ") || "-";
    const hexlineFiles = item.hexline.evaluation.changedFiles.join(", ") || "-";
    return `| ${item.scenario.title} | ${boolLabel(item.builtin.evaluation.pass)} | ${boolLabel(item.hexline.evaluation.pass)} | ${builtinFiles} | ${hexlineFiles} | ${builtinReasons} | ${hexlineReasons} |`;
}).join("\n");

const activationRows = scenarioResults.map((item) =>
    `| ${item.scenario.title} | ${boolLabel(item.builtin.activationSuccess)} | ${boolLabel(item.hexline.activationSuccess)} | ${item.hexline.firstHexToolTurn ?? "-"} | ${item.hexline.firstToolSearchTurn ?? "-"} |`
).join("\n");

const extraScenarioRows = hasExtraSession
    ? scenarioResults.map((item) => {
        const extraReasons = item.extra.evaluation.reasons.join("; ") || "-";
        const extraFiles = item.extra.evaluation.changedFiles.join(", ") || "-";
        return `| ${item.scenario.title} | ${boolLabel(item.extra.evaluation.pass)} | ${extraFiles} | ${extraReasons} |`;
    }).join("\n")
    : "";

const extraMetricsRows = hasExtraSession
    ? [
        `| Wall time | ${(extraTotals.durationMs / 1000).toFixed(1)}s | ${delta(builtinTotals.durationMs, extraTotals.durationMs)} |`,
        `| API time | ${(extraTotals.durationApiMs / 1000).toFixed(1)}s | ${delta(builtinTotals.durationApiMs, extraTotals.durationApiMs)} |`,
        `| Turns | ${extraTotals.turns} | ${delta(builtinTotals.turns, extraTotals.turns)} |`,
        `| Total cost | $${extraTotals.cost.toFixed(4)} | ${delta(builtinTotals.cost, extraTotals.cost)} |`,
        `| Output tokens | ${extraTotals.outputTokens} | ${delta(builtinTotals.outputTokens, extraTotals.outputTokens)} |`,
        `| Total tool calls | ${extraTotals.totalTools} | ${delta(builtinTotals.totalTools, extraTotals.totalTools)} |`,
    ].join("\n")
    : "";

const report = `# Benchmark: Built-in vs Hex-line - ${date}

## 0. Scope

This report covers the internal canonical A/B only: built-in Claude vs Claude plus \`hex-line\`.

It is not an external best-alternative comparison. Any future external baseline must reuse the same scenario suite and correctness contract unchanged.${hasExtraSession ? `\n\nThis run also includes an additional session profile: \`${resolvedExtraLabel}\` (\`${extraSessionId}\`). Treat it as an extra profile under the same contract, not as a universal leaderboard by itself.` : ""}

## 1. Scenario Outcomes

| Scenario | Built-in | Hex-line | Built-in changed files | Hex-line changed files | Built-in reasons | Hex-line reasons |
|----------|----------|----------|--------------------|--------------------|------------------|------------------|
${scenarioRows}

## 2. Activation

| Scenario | Built-in activation | Hex-line activation | First hex tool turn | First ToolSearch turn |
|----------|---------------------|---------------------|---------------------|-----------------------|
${activationRows}

## 3. Time

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Wall time | ${(builtinTotals.durationMs / 1000).toFixed(1)}s | ${(hexlineTotals.durationMs / 1000).toFixed(1)}s | ${delta(builtinTotals.durationMs, hexlineTotals.durationMs)} |
| API time | ${(builtinTotals.durationApiMs / 1000).toFixed(1)}s | ${(hexlineTotals.durationApiMs / 1000).toFixed(1)}s | ${delta(builtinTotals.durationApiMs, hexlineTotals.durationApiMs)} |
| Turns | ${builtinTotals.turns} | ${hexlineTotals.turns} | ${delta(builtinTotals.turns, hexlineTotals.turns)} |

## 4. Cost

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Total cost | $${builtinTotals.cost.toFixed(4)} | $${hexlineTotals.cost.toFixed(4)} | ${delta(builtinTotals.cost, hexlineTotals.cost)} |

## 5. Tokens

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Output tokens | ${builtinTotals.outputTokens} | ${hexlineTotals.outputTokens} | ${delta(builtinTotals.outputTokens, hexlineTotals.outputTokens)} |
| Cache creation | ${builtinTotals.cacheCreation} | ${hexlineTotals.cacheCreation} | ${delta(builtinTotals.cacheCreation, hexlineTotals.cacheCreation)} |
| Cache read | ${builtinTotals.cacheRead} | ${hexlineTotals.cacheRead} | ${delta(builtinTotals.cacheRead, hexlineTotals.cacheRead)} |

## 6. Tool Totals

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Total tool calls | ${builtinTotals.totalTools} | ${hexlineTotals.totalTools} | ${delta(builtinTotals.totalTools, hexlineTotals.totalTools)} |

## 7. Validity

Server syntax preflight: ${preflight?.serverSyntaxOk ? "PASS" : "FAIL"}

Hook syntax preflight: ${preflight?.hookSyntaxOk ? "PASS" : "FAIL"}

SessionStart preflight: ${preflight?.sessionStartOk ? "PASS" : "FAIL"}
${hasExtraSession ? `

## 8. Extra Session: ${resolvedExtraLabel}

| Scenario | ${resolvedExtraLabel} | Changed files | Reasons |
|----------|----------------|---------------|---------|
${extraScenarioRows}

| Metric | ${resolvedExtraLabel} | Delta vs Built-in |
|--------|----------------|-------------------|
${extraMetricsRows}
` : ""}`;

if (outputFile) {
    writeFileSync(outputFile, report, "utf8");
    process.stdout.write(`Report saved to ${outputFile}\n`);
} else {
    process.stdout.write(report);
}
