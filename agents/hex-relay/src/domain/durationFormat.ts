export function formatDurationSuffix(durationMs: number | undefined): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }
  if (durationMs < 1000) {
    return ` (${Math.round(durationMs)} ms)`;
  }
  const seconds = durationMs / 1000;
  const formatted = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
  return ` (${formatted}s)`;
}
