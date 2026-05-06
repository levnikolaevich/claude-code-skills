/**
 * Architecture snapshots — optional codegraph access via direct import.
 * Graceful fallback: if hex-graph-mcp or better-sqlite3 unavailable, returns null.
 */

let _graphAvailable = null;
let _getArchReport = null;
let _findCycles = null;

async function ensureGraph() {
    if (_graphAvailable !== null) return _graphAvailable;
    try {
        const storeUrl = new URL("../../../../mcp/hex-graph-mcp/lib/store.mjs", import.meta.url).href;
        const cyclesUrl = new URL("../../../../mcp/hex-graph-mcp/lib/cycles.mjs", import.meta.url).href;
        const store = await import(storeUrl);
        const cycles = await import(cyclesUrl);
        _getArchReport = store.getArchitectureReport;
        _findCycles = cycles.findCycles;
        _graphAvailable = true;
    } catch {
        _graphAvailable = false;
    }
    return _graphAvailable;
}

/**
 * Capture architecture baseline snapshot.
 * @param {string} projectPath - Project root
 * @returns {Promise<string|null>} JSON string of snapshot, or null
 */
export async function captureBaseline(projectPath) {
    if (!await ensureGraph()) return null;
    try {
        const arch = _getArchReport({ path: projectPath });
        if (arch?.error) return null;
        const cycles = _findCycles ? _findCycles({ path: projectPath }) : { result: [] };
        const snapshot = {
            timestamp: new Date().toISOString(),
            modules: arch.result?.modules || [],
            hotspots: arch.result?.hotspots || [],
            cross_module_edges: arch.result?.cross_module_edges || [],
            stats: arch.result?.stats || {},
            cycles: cycles?.result || [],
        };
        return JSON.stringify(snapshot);
    } catch {
        return null;
    }
}

/**
 * Compute delta between baseline and current architecture.
 * @param {string|null} baselineJSON - Baseline from captureBaseline()
 * @param {string} projectPath - Project root for current snapshot
 * @returns {Promise<object|null>} Delta object or null
 */
export async function computeDelta(baselineJSON, projectPath) {
    if (!baselineJSON) return null;
    const currentJSON = await captureBaseline(projectPath);
    if (!currentJSON) return null;

    try {
        const baseline = JSON.parse(baselineJSON);
        const current = JSON.parse(currentJSON);

        const baseModules = new Set(baseline.modules.map(m => m.module));
        const currModules = new Set(current.modules.map(m => m.module));

        const newModules = [...currModules].filter(m => !baseModules.has(m));
        const removedModules = [...baseModules].filter(m => !currModules.has(m));

        const baseHotspots = new Set(baseline.hotspots.map(h => h.name));
        const newHotspots = current.hotspots.filter(h => !baseHotspots.has(h.name));

        const baseCycleKeys = new Set((baseline.cycles || []).map(c => JSON.stringify(c)));
        const newCycles = (current.cycles || []).filter(c => !baseCycleKeys.has(JSON.stringify(c)));

        return {
            new_modules: newModules,
            removed_modules: removedModules,
            new_hotspots: newHotspots,
            new_cycles: newCycles,
            stats_before: baseline.stats,
            stats_after: current.stats,
        };
    } catch {
        return null;
    }
}
