#!/usr/bin/env node
// Cross-service log analysis with noise detection.
//
// Portable script for analyzing logs from Docker Compose services,
// local log files, or Loki HTTP API. Produces JSON output with
// service x level summary, noise detection, and actionable suggestions.
//
// Auto-detects log source (docker -> file -> loki) or accepts explicit --mode.
//
// Usage:
//     node analyze_test_logs.mjs                           # auto-detect
//     node analyze_test_logs.mjs --mode docker --since 5m  # Docker
//     node analyze_test_logs.mjs --mode file --path logs/  # files
//     node analyze_test_logs.mjs --mode loki --loki-url http://localhost:3100
//     node analyze_test_logs.mjs --mode loki --loki-url https://grafana.example.com/proxy/2 --token-env GRAFANA_SA_TOKEN
//     node analyze_test_logs.mjs --threshold 20 --top 10   # noise params

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Constants & patterns
// ---------------------------------------------------------------------------

const LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
const LEVELS_SET = new Set(LEVELS);
const DEFAULT_LOG_DIR = "tests/manual/results";
const DEFAULT_PERIOD = "5m";
const DEFAULT_THRESHOLD = 10;
const DEFAULT_TOP = 20;

// Pipe-delimited: ts | LEVEL | trace_id=xxx | module:line | func() | msg
const PIPE_LOG_RE =
  /^.+?\s\|\s(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+\|\s.+?\|\s.+?\|\s(.+)$/;
const PG_LOG_RE = /\b(ERROR|WARNING|LOG|FATAL|PANIC):\s+(.+)/;
const REDIS_WARN_RE = /^#\s*(WARNING)\s*(.*)$/i;
const REDIS_INFO_RE = /^[*\d]/;
// key=value format (e.g. level=ERROR in node_exporter, Go services)
const KEY_VALUE_LEVEL_RE =
  /\blevel=(DEBUG|INFO|WARNING|ERROR|CRITICAL|WARN|FATAL|PANIC)\b/i;
// Bare level keyword fallback
const PLAIN_LEVEL_RE = /\b(DEBUG|INFO|WARNING|ERROR|CRITICAL)\b/i;

// Template normalization (order matters: UUIDs before generic numbers)
const NORMALIZERS = [
  [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "<UUID>",
  ],
  [/trace_id=[0-9a-fA-F]+/g, "trace_id=<TRACE>"],
  [/\d{2}-\d{2}-\d{4}\s\d{2}:\d{2}:\d{2}/g, "<TS>"],
  [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?/g, "<TS>"],
  [/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g, "<IP>"],
  [/\/[0-9a-f]{8,}/g, "/<ID>"],
  [/\b\d{4,}\b/g, "<N>"],
];

const PERIOD_RE = /^(\d+)([smhd])$/;
const PERIOD_MULT = { s: 1, m: 60, h: 3600, d: 86400 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg) {
  process.stderr.write("ERROR: " + msg + "\n");
  process.exit(1);
}

function emptyResult(mode, period) {
  return {
    status: "OK",
    mode,
    period,
    total_entries: 0,
    summary: {},
    noise: [],
    errors: [],
    warnings: [],
  };
}

function parsePeriod(s) {
  const m = PERIOD_RE.exec(s);
  if (!m) {
    die("Invalid period: " + s + ". Use e.g. 5m, 1h, 24h.");
  }
  return parseInt(m[1], 10) * PERIOD_MULT[m[2]];
}

function normalizeMessage(msg) {
  let result = msg;
  for (const [pat, repl] of NORMALIZERS) {
    result = result.replace(pat, repl);
  }
  return result;
}

function svcType(service) {
  const name = service.toLowerCase();
  if (name.includes("postgres") || name.includes("pg") || name.includes("psql")) {
    return "postgres";
  }
  if (name.includes("redis")) {
    return "redis";
  }
  return "app";
}

// ---------------------------------------------------------------------------
// Parsers (multi-format auto-detect per line)
// ---------------------------------------------------------------------------

function parseLine(line, service) {
  const s = line.trim();
  if (!s) return null;
  const st = svcType(service);

  // JSON structured
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      const lvl = obj.level || obj.levelname || "";
      const msg = obj.message || obj.msg || "";
      if (lvl && msg) {
        return {
          level: lvl.toUpperCase(),
          service,
          message: msg,
          raw: s,
        };
      }
    } catch (_) {
      // not valid JSON
    }
    return null;
  }

  // Pipe-delimited
  let m = PIPE_LOG_RE.exec(s);
  if (m) {
    return { level: m[1], service, message: m[2], raw: s };
  }

  // PostgreSQL native
  if (st === "postgres") {
    m = PG_LOG_RE.exec(s);
    if (m) {
      const lvl = m[1] === "LOG" ? "INFO" : m[1];
      return { level: lvl, service, message: m[2], raw: s };
    }
    return null;
  }

  // Redis native
  if (st === "redis") {
    m = REDIS_WARN_RE.exec(s);
    if (m) {
      return { level: "WARNING", service, message: m[2].trim(), raw: s };
    }
    if (REDIS_INFO_RE.test(s)) {
      return { level: "INFO", service, message: s, raw: s };
    }
    return null;
  }

  // Key=value format (level=ERROR)
  m = KEY_VALUE_LEVEL_RE.exec(s);
  if (m) {
    let lvl = m[1].toUpperCase();
    if (lvl === "WARN") lvl = "WARNING";
    return { level: lvl, service, message: s, raw: s };
  }

  // Plain text with level keyword (fallback)
  m = PLAIN_LEVEL_RE.exec(s);
  if (m) {
    return { level: m[1].toUpperCase(), service, message: s, raw: s };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Collectors
// ---------------------------------------------------------------------------

function dockerAvailable() {
  try {
    execSync("docker info", {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return true;
  } catch (_) {
    return false;
  }
}

function dockerServices() {
  let stdout;
  try {
    stdout = execSync("docker compose ps --format json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
  } catch (_) {
    return [];
  }

  const output = (stdout || "").trim();
  if (!output) return [];

  const services = [];
  const chunks = output.startsWith("[") ? [output] : output.split("\n");
  for (let chunk of chunks) {
    chunk = chunk.trim();
    if (!chunk) continue;
    try {
      const parsed = JSON.parse(chunk);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const name = item.Name || item.name || "";
        if (name) services.push(name);
      }
    } catch (_) {
      continue;
    }
  }
  return services;
}

function collectDocker(since) {
  const services = dockerServices();
  if (!services.length) return [];
  const entries = [];
  for (const svc of services) {
    let stdout;
    try {
      stdout = execSync(
        "docker compose logs " + svc + " --since " + since,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 30000,
        }
      );
    } catch (err) {
      if (err.killed) {
        process.stderr.write(
          "Timeout collecting logs from " + svc + ", skipping\n"
        );
        continue;
      }
      // execSync throws on non-zero exit; try to use whatever output exists
      stdout = (err.stdout || "") + (err.stderr || "");
    }
    for (const rawLine of (stdout || "").split("\n")) {
      let content = rawLine;
      const idx = rawLine.indexOf(" | ");
      if (idx > 0 && idx < 40) {
        const prefix = rawLine.substring(0, idx).trim();
        if (prefix && !prefix.includes("{") && !prefix.includes("}") &&
            !prefix.includes("[") && !prefix.includes("]")) {
          content = rawLine.substring(idx + 3);
        }
      }
      const entry = parseLine(content, svc);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

function collectFile(logDir) {
  const dirPath = logDir || DEFAULT_LOG_DIR;
  let stat;
  try {
    stat = fs.statSync(dirPath);
  } catch (_) {
    return [];
  }
  if (!stat.isDirectory()) return [];

  const entries = [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".log")).sort();
  for (const fileName of files) {
    const filePath = path.join(dirPath, fileName);
    const svcName = path.basename(fileName, ".log");
    let text;
    try {
      text = fs.readFileSync(filePath, "utf-8");
    } catch (_) {
      process.stderr.write("Cannot read " + filePath + ", skipping\n");
      continue;
    }
    for (const rawLine of text.split("\n")) {
      const entry = parseLine(rawLine, svcName);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

async function collectLoki(periodSeconds, baseUrl, token, query) {
  const endNs = BigInt(Math.floor(Date.now() / 1000)) * 1000000000n;
  const startNs = endNs - BigInt(periodSeconds) * 1000000000n;
  const params = new URLSearchParams({
    query: query || '{job=~".+"}',
    start: startNs.toString(),
    end: endNs.toString(),
    limit: "5000",
  });
  const url = baseUrl + "/loki/api/v1/query_range?" + params.toString();
  const headers = {};
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  let data;
  try {
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    data = await resp.json();
  } catch (e) {
    die("Loki request failed: " + (e.message || e));
    return [];
  }
  if (data.status !== "success") {
    die("Loki returned non-success: " + (data.status || "unknown"));
  }

  const entries = [];
  const results = (data.data && data.data.result) || [];
  for (const stream of results) {
    const labels = stream.stream || {};
    const svc = String(
      labels.service_name ||
        labels.service ||
        labels.container_name ||
        labels.job ||
        "unknown"
    );
    const labelLvl = String(labels.level || "").toUpperCase();
    for (const [_ts, logLine] of stream.values || []) {
      const msg = String(logLine);
      if (LEVELS_SET.has(labelLvl)) {
        const m = PIPE_LOG_RE.exec(msg);
        entries.push({
          level: labelLvl,
          service: svc,
          message: m ? m[2] : msg,
          raw: msg,
        });
      } else {
        const parsed = parseLine(msg, svc);
        if (parsed) entries.push(parsed);
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

function autoDetectMode(filePath) {
  if (dockerAvailable() && dockerServices().length > 0) {
    return ["docker", null];
  }
  const checkDir = filePath || DEFAULT_LOG_DIR;
  let stat;
  try {
    stat = fs.statSync(checkDir);
  } catch (_) {
    stat = null;
  }
  if (stat && stat.isDirectory()) {
    const logs = fs.readdirSync(checkDir).filter((f) => f.endsWith(".log"));
    if (logs.length > 0) {
      return ["file", checkDir];
    }
  }
  if (process.env.LOKI_URL) {
    return ["loki", null];
  }
  return ["none", null];
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function buildSummary(entries) {
  const summary = {};
  for (const e of entries) {
    if (!summary[e.service]) summary[e.service] = {};
    summary[e.service][e.level] = (summary[e.service][e.level] || 0) + 1;
  }
  // Sort by service name
  const sorted = {};
  for (const svc of Object.keys(summary).sort()) {
    sorted[svc] = summary[svc];
  }
  return sorted;
}

function detectNoise(entries, threshold, topN) {
  // groups: key = "service\0level\0template" -> samples[]
  const groups = {};
  for (const e of entries) {
    const tpl = normalizeMessage(e.message);
    const key = e.service + "\0" + e.level + "\0" + tpl;
    if (!groups[key]) groups[key] = { service: e.service, level: e.level, tpl, samples: [] };
    groups[key].samples.push(e.raw || e.message);
  }

  // service totals
  const svcTotals = {};
  for (const e of entries) {
    svcTotals[e.service] = (svcTotals[e.service] || 0) + 1;
  }

  const noise = [];
  for (const g of Object.values(groups)) {
    const count = g.samples.length;
    if (count >= threshold) {
      noise.push({
        template: g.tpl,
        count,
        level: g.level,
        service: g.service,
        samples: g.samples.slice(0, 3),
        noise_ratio: Math.round((count / Math.max(svcTotals[g.service], 1)) * 10000) / 10000,
      });
    }
  }
  noise.sort((a, b) => b.count - a.count);
  return noise.slice(0, topN);
}

function collectErrorsWarnings(entries) {
  const errGrp = {};
  const warnGrp = {};
  for (const e of entries) {
    const tpl = normalizeMessage(e.message);
    const key = e.service + "\0" + tpl;
    if (e.level === "ERROR" || e.level === "CRITICAL" || e.level === "FATAL") {
      if (!errGrp[key]) errGrp[key] = { service: e.service, tpl, samples: [] };
      errGrp[key].samples.push(e.raw || e.message);
    } else if (e.level === "WARNING") {
      if (!warnGrp[key]) warnGrp[key] = { service: e.service, tpl, samples: [] };
      warnGrp[key].samples.push(e.raw || e.message);
    }
  }

  const errors = Object.values(errGrp)
    .sort((a, b) => b.samples.length - a.samples.length)
    .map((g) => ({
      level: "ERROR",
      service: g.service,
      message: g.tpl,
      count: g.samples.length,
      samples: g.samples.slice(0, 3),
    }));

  const warnings = Object.values(warnGrp)
    .sort((a, b) => b.samples.length - a.samples.length)
    .map((g) => ({
      level: "WARNING",
      service: g.service,
      message: g.tpl,
      count: g.samples.length,
    }));

  return [errors, warnings];
}

function suggestAction(ng) {
  const tpl = ng.template.toLowerCase();
  if (ng.level === "ERROR" || ng.level === "CRITICAL" || ng.level === "FATAL") {
    return "INVESTIGATE: repeated errors indicate a real bug";
  }
  if (
    ["health", "healthcheck", "/live", "/ready"].some((kw) => tpl.includes(kw))
  ) {
    return "Demote to DEBUG (health check noise)";
  }
  if (
    ["booting worker", "starting", "shutdown", "initialized", "ready"].some(
      (kw) => tpl.includes(kw)
    )
  ) {
    return "Acceptable startup noise (one-time per deploy)";
  }
  if (ng.level === "INFO" && ng.count > 100 && ng.noise_ratio > 0.3) {
    return "Demote to DEBUG (high-volume, >30% of service logs)";
  }
  if (ng.level === "INFO" && ng.count > 100) {
    return "Consider DEBUG (high-volume INFO)";
  }
  if (
    ng.level === "WARNING" &&
    ["rate_limit", "429", "validation", "deprecated"].some((kw) =>
      tpl.includes(kw)
    )
  ) {
    return "Consider DEBUG if expected traffic";
  }
  if (ng.level === "WARNING" && ng.noise_ratio > 0.3) {
    return "Review: WARNING dominates service logs (>30%)";
  }
  return "Review manually";
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function buildOutput(entries, mode, period, threshold, topN) {
  const summary = buildSummary(entries);
  const noiseGroups = detectNoise(entries, threshold, topN);
  const [errors, warnings] = collectErrorsWarnings(entries);
  return {
    status: "OK",
    mode,
    period,
    total_entries: entries.length,
    summary,
    noise: noiseGroups.map((ng) => ({
      template: ng.template,
      count: ng.count,
      level: ng.level,
      service: ng.service,
      noise_ratio: ng.noise_ratio,
      samples: ng.samples,
      suggestion: suggestAction(ng),
    })),
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  const prog = "analyze_test_logs.mjs";
  process.stderr.write(
    "Cross-service log analysis with noise detection.\n\n" +
      "Options:\n" +
      "  --mode <docker|file|loki>  Log source. Default: auto-detect (docker->file->loki)\n" +
      "  --since <period>           Time window (docker/loki). Default: " + DEFAULT_PERIOD + "\n" +
      "  --path <dir>               Log file directory (file mode). Default: " + DEFAULT_LOG_DIR + "\n" +
      "  --threshold <n>            Noise threshold (min occurrences). Default: " + DEFAULT_THRESHOLD + "\n" +
      "  --top <n>                  Top N noisiest templates. Default: " + DEFAULT_TOP + "\n" +
      "  --loki-url <url>           Loki base URL. Default: LOKI_URL env var\n" +
      '  --loki-query <logql>       LogQL selector. Default: \'{job=~".+"}\'\n' +
      "  --token-env <var>          Env var name with auth token (e.g. GRAFANA_SA_TOKEN)\n" +
      "  --help                     Show this help\n\n" +
      "Examples:\n" +
      "  node " + prog + "                                    # auto-detect\n" +
      "  node " + prog + " --mode docker --since 5m           # Docker\n" +
      "  node " + prog + " --mode file --path logs/           # files\n" +
      "  node " + prog + " --mode loki --loki-url http://localhost:3100\n" +
      "  node " + prog + " --threshold 20 --top 10            # noise params\n"
  );
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        mode: { type: "string" },
        since: { type: "string", default: DEFAULT_PERIOD },
        path: { type: "string" },
        threshold: { type: "string", default: String(DEFAULT_THRESHOLD) },
        top: { type: "string", default: String(DEFAULT_TOP) },
        "loki-url": { type: "string" },
        "loki-query": { type: "string", default: '{job=~".+"}' },
        "token-env": { type: "string" },
        help: { type: "boolean", default: false },
      },
      strict: true,
    });
  } catch (e) {
    die(e.message);
    return;
  }

  const opts = parsed.values;

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  // Validate --mode
  if (opts.mode && !["docker", "file", "loki"].includes(opts.mode)) {
    die("Invalid mode: " + opts.mode + ". Choose docker, file, or loki.");
  }

  const threshold = parseInt(opts.threshold, 10);
  const topN = parseInt(opts.top, 10);
  if (isNaN(threshold)) die("--threshold must be a number");
  if (isNaN(topN)) die("--top must be a number");

  // Resolve mode
  let mode = opts.mode || null;
  let fileDir = opts.path || null;
  if (!mode) {
    const [detected, extra] = autoDetectMode(opts.path || null);
    if (detected === "none") {
      process.stdout.write(
        JSON.stringify({ status: "NO_LOG_SOURCES" }, null, 2) + "\n"
      );
      return;
    }
    mode = detected;
    if (detected === "file" && extra) {
      fileDir = extra;
    }
  }

  // Collect
  const periodDisplay = mode !== "file" ? opts.since : "N/A";
  let entries = [];

  if (mode === "docker") {
    entries = collectDocker(opts.since);
  } else if (mode === "file") {
    entries = collectFile(fileDir || opts.path || DEFAULT_LOG_DIR);
  } else if (mode === "loki") {
    const lokiUrl = opts["loki-url"] || process.env.LOKI_URL || null;
    if (!lokiUrl) {
      die("Loki URL required: use --loki-url or set LOKI_URL env var");
    }
    let token = null;
    if (opts["token-env"]) {
      token = process.env[opts["token-env"]] || null;
      if (!token) {
        die("Token env var " + opts["token-env"] + " is not set");
      }
    }
    entries = await collectLoki(
      parsePeriod(opts.since),
      lokiUrl,
      token,
      opts["loki-query"]
    );
  }

  if (!entries.length) {
    process.stdout.write(
      JSON.stringify(emptyResult(mode, periodDisplay), null, 2) + "\n"
    );
    return;
  }

  // Analyze and output
  process.stdout.write(
    JSON.stringify(
      buildOutput(entries, mode, periodDisplay, threshold, topN),
      null,
      2
    ) + "\n"
  );
}

main();
