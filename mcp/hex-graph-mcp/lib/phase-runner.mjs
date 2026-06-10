export function createPhaseRecorder(now = Date.now) {
    const results = [];
    let current = null;

    return {
        start(name) {
            const startedAt = now();
            let closed = false;
            const phase = {
                end(extra = {}) {
                    if (closed) return;
                    closed = true;
                    results.push({
                        name,
                        status: "ok",
                        elapsed_ms: Math.max(0, now() - startedAt),
                        ...extra,
                    });
                    if (current === phase) current = null;
                },
                fail(error) {
                    if (closed) return;
                    closed = true;
                    results.push({
                        name,
                        status: "error",
                        elapsed_ms: Math.max(0, now() - startedAt),
                        error: error?.code || error?.message || String(error),
                    });
                    if (current === phase) current = null;
                },
            };
            current = phase;
            return phase;
        },
        fail(error) {
            if (current) current.fail(error);
        },
        results() {
            return results.slice();
        },
    };
}
