interface HttpKey {
  route: string;
  status: number;
}

const httpRequests = new Map<string, number>();
const workerTickFailures = new Map<string, number>();
const dbOperationBuckets = new Map<string, number[]>();
const DB_BUCKETS_MS = [1, 5, 10, 50, 100, 500, 1000, Number.POSITIVE_INFINITY] as const;
const BACKSLASH = String.fromCodePoint(92);
const NEWLINE = String.fromCodePoint(10);
const QUOTE = String.fromCodePoint(34);

let telegramSendFailures = 0;

function httpKey(key: HttpKey): string {
  return `${key.route}\t${key.status}`;
}

function inc(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function label(value: string): string {
  return value
    .replaceAll(BACKSLASH, `${BACKSLASH}${BACKSLASH}`)
    .replaceAll(NEWLINE, `${BACKSLASH}n`)
    .replaceAll(QUOTE, `${BACKSLASH}${QUOTE}`);
}

export function recordHttpRequest(route: string, status: number): void {
  inc(httpRequests, httpKey({ route, status }));
}

export function recordWorkerTickFailure(worker: string): void {
  inc(workerTickFailures, worker);
}

export function recordTelegramSendFailure(): void {
  telegramSendFailures += 1;
}

export function observeDbOperation(name: string, durationMs: number): void {
  const buckets =
    dbOperationBuckets.get(name) ?? Array.from({ length: DB_BUCKETS_MS.length }, () => 0);
  for (const [index, upper] of DB_BUCKETS_MS.entries()) {
    if (durationMs <= upper) buckets[index] = (buckets[index] ?? 0) + 1;
  }
  dbOperationBuckets.set(name, buckets);
}

export interface QueueMetricSnapshot {
  inboundQueued: number;
  outboxQueued: number;
  pendingReplies: number;
}

export function renderPrometheusMetrics(snapshot: QueueMetricSnapshot): string {
  const lines: string[] = [
    "# HELP hex_relay_http_requests_total HTTP requests by route and status.",
    "# TYPE hex_relay_http_requests_total counter",
  ];
  for (const [key, value] of httpRequests.entries()) {
    const [route, status] = key.split("\t");
    lines.push(
      `hex_relay_http_requests_total{route="${label(route ?? "unknown")}",status="${label(status ?? "0")}"} ${value}`
    );
  }

  lines.push(
    "# HELP hex_relay_worker_tick_failures_total Worker loop iteration failures.",
    "# TYPE hex_relay_worker_tick_failures_total counter"
  );
  for (const [worker, value] of workerTickFailures.entries()) {
    lines.push(`hex_relay_worker_tick_failures_total{worker="${label(worker)}"} ${value}`);
  }

  lines.push(
    "# HELP hex_relay_telegram_send_failures_total Telegram send failures.",
    "# TYPE hex_relay_telegram_send_failures_total counter",
    `hex_relay_telegram_send_failures_total ${telegramSendFailures}`,
    "# HELP hex_relay_queue_depth Current queue depths.",
    "# TYPE hex_relay_queue_depth gauge",
    `hex_relay_queue_depth{queue="inbound"} ${snapshot.inboundQueued}`,
    `hex_relay_queue_depth{queue="outbox"} ${snapshot.outboxQueued}`,
    `hex_relay_queue_depth{queue="pending_replies"} ${snapshot.pendingReplies}`,
    "# HELP hex_relay_db_operation_duration_ms_bucket DB operation duration buckets in milliseconds.",
    "# TYPE hex_relay_db_operation_duration_ms_bucket histogram"
  );
  for (const [name, buckets] of dbOperationBuckets.entries()) {
    for (const [index, upper] of DB_BUCKETS_MS.entries()) {
      const le = upper === Number.POSITIVE_INFINITY ? "+Inf" : String(upper);
      lines.push(
        `hex_relay_db_operation_duration_ms_bucket{operation="${label(name)}",le="${le}"} ${buckets[index] ?? 0}`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
