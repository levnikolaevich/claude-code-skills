function parseEvidence(value) {
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function nodeFromRow(row, prefix) {
    if (!row) return null;
    return {
        symbol_id: row[`${prefix}_id`],
        name: row[`${prefix}_name`],
        display_name: row[`${prefix}_name`],
        kind: row[`${prefix}_kind`],
        file: row[`${prefix}_file`],
        line_start: row[`${prefix}_line`],
        qualified_name: row[`${prefix}_qualified_name`] || null,
    };
}

function placeholders(values) {
    return values.map(() => "?").join(",");
}

function normalizeFilePath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function routeMatches(row, route) {
    if (!route) return true;
    const evidence = row.evidence || parseEvidence(row.evidence_json);
    const method = evidence.method || row.route_name?.split(/\s+/, 1)[0] || "";
    const path = evidence.route_path || row.route_name?.replace(/^\S+\s+/, "") || "";
    const wanted = String(route).trim().toLowerCase();
    return `${method} ${path}`.toLowerCase().includes(wanted)
        || path.toLowerCase() === wanted
        || path.toLowerCase().includes(wanted);
}

function fileMatches(row, file) {
    if (!file) return true;
    const wanted = normalizeFilePath(file);
    const routeFile = normalizeFilePath(row.route_file);
    const handlerFile = normalizeFilePath(row.handler_file);
    return routeFile === wanted
        || handlerFile === wanted
        || routeFile.endsWith(`/${wanted}`)
        || handlerFile.endsWith(`/${wanted}`);
}

export function resolveSymbolIdForSelector(store, selector = {}) {
    if (selector.symbol_id != null) {
        const node = store.getNodeById(Number(selector.symbol_id));
        return node ? node.id : null;
    }
    if (selector.qualified_name) {
        return store.findByQualified(selector.qualified_name)[0]?.id || null;
    }
    if (selector.workspace_qualified_name) {
        return store.findByWorkspaceQualified(selector.workspace_qualified_name)[0]?.id || null;
    }
    if (selector.name && selector.file) {
        const selectorFile = normalizeFilePath(selector.file);
        return (store.findByName(selector.name) || [])
            .find((node) => {
                const nodeFile = normalizeFilePath(node.file);
                return nodeFile === selectorFile || nodeFile.endsWith(selectorFile) || nodeFile.endsWith(`/${selectorFile}`);
            })
            ?.id || null;
    }
    return null;
}

export function collectProcessesForSymbols(store, symbolIds, { limit = 10 } = {}) {
    const ids = [...new Set((symbolIds || []).filter(id => id != null).map(Number))];
    if (!ids.length) return [];
    const processRows = store.db.prepare(`
        SELECT DISTINCT
            p.id AS process_id,
            p.file AS process_file,
            p.line_start AS process_line
        FROM edges e
        JOIN nodes p ON p.id = e.source_id
        WHERE e.layer = 'process'
          AND e.target_id IN (${placeholders(ids)})
        ORDER BY p.file, p.line_start, p.id
        LIMIT ?
    `).all(...ids, limit);
    const processIds = processRows.map(row => row.process_id);
    if (!processIds.length) return [];
    const idSet = new Set(ids);
    const rows = store.db.prepare(`
        SELECT
            p.id AS process_id,
            p.name AS process_name,
            p.kind AS process_kind,
            p.file AS process_file,
            p.line_start AS process_line,
            p.qualified_name AS process_qualified_name,
            e.kind AS edge_kind,
            e.confidence,
            e.origin,
            e.file AS edge_file,
            e.line AS edge_line,
            e.evidence_json,
            t.id AS target_id,
            t.name AS target_name,
            t.kind AS target_kind,
            t.file AS target_file,
            t.line_start AS target_line,
            t.qualified_name AS target_qualified_name
        FROM edges e
        JOIN nodes p ON p.id = e.source_id
        JOIN nodes t ON t.id = e.target_id
        WHERE e.layer = 'process'
          AND e.source_id IN (${placeholders(processIds)})
        ORDER BY p.file, p.line_start, e.kind, e.line
    `).all(...processIds);

    const byProcess = new Map();
    for (const row of rows) {
        let process = byProcess.get(row.process_id);
        if (!process) {
            process = {
                process_id: row.process_id,
                name: row.process_name,
                kind: row.process_kind,
                file: row.process_file,
                line_start: row.process_line,
                qualified_name: row.process_qualified_name,
                steps: [],
                matched_steps: [],
            };
            byProcess.set(row.process_id, process);
        }
        const step = {
            kind: row.edge_kind,
            confidence: row.confidence,
            origin: row.origin,
            file: row.edge_file,
            line: row.edge_line,
            target: nodeFromRow(row, "target"),
            evidence: parseEvidence(row.evidence_json),
        };
        process.steps.push(step);
        if (idSet.has(row.target_id)) process.matched_steps.push(step);
    }

    return [...byProcess.values()]
        .map(process => ({
            ...process,
            step_count: process.steps.length,
            matched_step_count: process.matched_steps.length,
        }));
}

function queryRouteRows(store, { route = null, file = null, symbolId = null } = {}) {
    const where = [
        "e.layer = 'framework'",
        "e.kind = 'route_to_handler'",
    ];
    const params = [];
    if (route) {
        const wanted = `%${String(route).trim().toLowerCase()}%`;
        where.push("(LOWER(route.name) LIKE ? OR LOWER(e.evidence_json) LIKE ?)");
        params.push(wanted, wanted);
    }
    if (file) {
        const wantedFile = normalizeFilePath(file);
        where.push("(route.file = ? OR handler.file = ? OR route.file LIKE ? OR handler.file LIKE ?)");
        params.push(wantedFile, wantedFile, `%/${wantedFile}`, `%/${wantedFile}`);
    }
    if (symbolId) {
        where.push("(handler.id = ? OR route.id = ?)");
        params.push(Number(symbolId), Number(symbolId));
    }
    return store.db.prepare(`
        SELECT
            route.id AS route_id,
            route.name AS route_name,
            route.kind AS route_kind,
            route.file AS route_file,
            route.line_start AS route_line,
            route.qualified_name AS route_qualified_name,
            handler.id AS handler_id,
            handler.name AS handler_name,
            handler.kind AS handler_kind,
            handler.file AS handler_file,
            handler.line_start AS handler_line,
            handler.qualified_name AS handler_qualified_name,
            e.confidence,
            e.origin,
            e.evidence_json
        FROM edges e
        JOIN nodes route ON route.id = e.source_id
        JOIN nodes handler ON handler.id = e.target_id
        WHERE ${where.join("\n          AND ")}
        ORDER BY route.file, route.line_start, route.name
    `).all(...params).map(row => ({ ...row, evidence: parseEvidence(row.evidence_json) }));
}

function edgeCountByRoute(store, routeIds, { layer, kind, routeColumn = "e.target_id" }) {
    if (!routeIds.length) return new Map();
    const rows = store.db.prepare(`
        SELECT ${routeColumn} AS route_id, COUNT(*) AS count
        FROM edges e
        WHERE e.layer = ?
          AND e.kind = ?
          AND ${routeColumn} IN (${placeholders(routeIds)})
        GROUP BY ${routeColumn}
    `).all(layer, kind, ...routeIds);
    return new Map(rows.map(row => [row.route_id, row.count]));
}

function sumCounts(counts) {
    return [...counts.values()].reduce((sum, count) => sum + count, 0);
}

function sectionRows(rawRows, limit) {
    return {
        rows: rawRows.slice(0, limit),
        total: rawRows.length,
        truncated: rawRows.length > limit,
    };
}

export function collectApiImpact(store, {
    route = null,
    file = null,
    symbolId = null,
    limit = 10,
} = {}) {
    const allMatches = queryRouteRows(store, { route, file, symbolId })
        .filter(row => routeMatches(row, route))
        .filter(row => fileMatches(row, file))
        .filter(row => !symbolId || row.handler_id === Number(symbolId) || row.route_id === Number(symbolId));
    const routeRows = allMatches.slice(0, limit);
    const routeIds = routeRows.map(row => row.route_id);
    if (!routeIds.length) {
        return {
            total: 0,
            routes: [],
            response_shapes: [],
            consumers: [],
            mismatches: [],
            middleware: [],
            processes: [],
            detail_totals: {},
            truncated: {},
        };
    }

    const detailLimit = Math.max(1, Number(limit) || 10);
    const shapeResult = sectionRows(store.db.prepare(`
        SELECT
            e.source_id AS route_id,
            e.confidence,
            e.origin,
            e.file,
            e.line,
            e.evidence_json,
            shape.id AS shape_id,
            shape.name AS shape_name,
            shape.kind AS shape_kind,
            shape.file AS shape_file,
            shape.line_start AS shape_line,
            shape.qualified_name AS shape_qualified_name
        FROM edges e
        JOIN nodes shape ON shape.id = e.target_id
        WHERE e.layer = 'api'
          AND e.kind = 'route_returns_key'
          AND e.source_id IN (${placeholders(routeIds)})
        ORDER BY e.source_id, shape.name
        LIMIT ?
    `).all(...routeIds, detailLimit + 1), detailLimit);
    const shapeRows = shapeResult.rows;

    const consumerResult = sectionRows(store.db.prepare(`
        SELECT
            e.target_id AS route_id,
            e.confidence,
            e.origin,
            e.file,
            e.line,
            e.evidence_json,
            consumer.id AS consumer_id,
            consumer.name AS consumer_name,
            consumer.kind AS consumer_kind,
            consumer.file AS consumer_file,
            consumer.line_start AS consumer_line,
            consumer.qualified_name AS consumer_qualified_name
        FROM edges e
        JOIN nodes consumer ON consumer.id = e.source_id
        WHERE e.layer = 'api'
          AND e.kind = 'consumes_route'
          AND e.target_id IN (${placeholders(routeIds)})
        ORDER BY e.target_id, consumer.file, consumer.line_start
        LIMIT ?
    `).all(...routeIds, detailLimit + 1), detailLimit);
    const consumerRows = consumerResult.rows;

    const unknownResult = sectionRows(store.db.prepare(`
        SELECT
            e.target_id AS route_id,
            e.confidence,
            e.origin,
            e.file,
            e.line,
            e.evidence_json,
            consumer.id AS consumer_id,
            consumer.name AS consumer_name,
            consumer.kind AS consumer_kind,
            consumer.file AS consumer_file,
            consumer.line_start AS consumer_line,
            consumer.qualified_name AS consumer_qualified_name
        FROM edges e
        JOIN nodes consumer ON consumer.id = e.source_id
        WHERE e.layer = 'api'
          AND e.kind = 'consumer_uses_unknown_key'
          AND e.target_id IN (${placeholders(routeIds)})
        ORDER BY e.target_id, consumer.file, consumer.line_start
        LIMIT ?
    `).all(...routeIds, detailLimit + 1), detailLimit);
    const unknownRows = unknownResult.rows;

    const middlewareResult = sectionRows(store.db.prepare(`
        SELECT
            e.target_id AS route_id,
            e.confidence,
            e.origin,
            e.file,
            e.line,
            e.evidence_json,
            middleware.id AS middleware_id,
            middleware.name AS middleware_name,
            middleware.kind AS middleware_kind,
            middleware.file AS middleware_file,
            middleware.line_start AS middleware_line,
            middleware.qualified_name AS middleware_qualified_name
        FROM edges e
        JOIN nodes middleware ON middleware.id = e.source_id
        WHERE e.layer = 'framework'
          AND e.kind = 'middleware_for'
          AND e.target_id IN (${placeholders(routeIds)})
        ORDER BY e.target_id, middleware.file, middleware.line_start
        LIMIT ?
    `).all(...routeIds, detailLimit + 1), detailLimit);
    const middlewareRows = middlewareResult.rows;

    const processes = collectProcessesForSymbols(store, routeIds, { limit });
    const shapeCountByRoute = edgeCountByRoute(store, routeIds, { layer: "api", kind: "route_returns_key", routeColumn: "e.source_id" });
    const consumerCountByRoute = edgeCountByRoute(store, routeIds, { layer: "api", kind: "consumes_route" });
    const mismatchCountByRoute = edgeCountByRoute(store, routeIds, { layer: "api", kind: "consumer_uses_unknown_key" });
    const middlewareCountByRoute = edgeCountByRoute(store, routeIds, { layer: "framework", kind: "middleware_for" });
    const processCountByRoute = edgeCountByRoute(store, routeIds, { layer: "process", kind: "process_entry" });
    const shapeKeysByRoute = new Map();
    for (const row of shapeRows) {
        const evidence = parseEvidence(row.evidence_json);
        const list = shapeKeysByRoute.get(row.route_id) || [];
        list.push(evidence.key || row.shape_name);
        shapeKeysByRoute.set(row.route_id, list);
    }

    return {
        total: allMatches.length,
        routes: routeRows.map(row => ({
            route_id: row.route_id,
            method: row.evidence.method || row.route_name.split(/\s+/, 1)[0],
            path: row.evidence.route_path || row.route_name.replace(/^\S+\s+/, ""),
            framework: row.evidence.framework || null,
            route: nodeFromRow(row, "route"),
            handler: nodeFromRow(row, "handler"),
            shape_keys: [...new Set(shapeKeysByRoute.get(row.route_id) || [])],
            shape_count: shapeCountByRoute.get(row.route_id) || 0,
            consumer_count: consumerCountByRoute.get(row.route_id) || 0,
            mismatch_count: mismatchCountByRoute.get(row.route_id) || 0,
            middleware_count: middlewareCountByRoute.get(row.route_id) || 0,
            process_count: processCountByRoute.get(row.route_id) || 0,
        })),
        response_shapes: shapeRows.map(row => {
            const evidence = parseEvidence(row.evidence_json);
            return {
                route_id: row.route_id,
                key: evidence.key || row.shape_name,
                file: row.file,
                line: row.line,
                confidence: row.confidence,
                origin: row.origin,
                shape: nodeFromRow(row, "shape"),
            };
        }),
        consumers: consumerRows.map(row => {
            const evidence = parseEvidence(row.evidence_json);
            return {
                route_id: row.route_id,
                key: evidence.key || null,
                file: row.file,
                line: row.line,
                confidence: row.confidence,
                origin: row.origin,
                consumer: nodeFromRow(row, "consumer"),
            };
        }),
        mismatches: unknownRows.map(row => {
            const evidence = parseEvidence(row.evidence_json);
            return {
                route_id: row.route_id,
                key: evidence.key || null,
                file: row.file,
                line: row.line,
                confidence: row.confidence,
                origin: row.origin,
                consumer: nodeFromRow(row, "consumer"),
            };
        }),
        middleware: middlewareRows.map(row => ({
            route_id: row.route_id,
            file: row.file,
            line: row.line,
            confidence: row.confidence,
            origin: row.origin,
            middleware: nodeFromRow(row, "middleware"),
            evidence: parseEvidence(row.evidence_json),
        })),
        processes,
        detail_totals: {
            response_shapes: sumCounts(shapeCountByRoute),
            consumers: sumCounts(consumerCountByRoute),
            mismatches: sumCounts(mismatchCountByRoute),
            middleware: sumCounts(middlewareCountByRoute),
            processes: sumCounts(processCountByRoute),
        },
        truncated: {
            routes: allMatches.length > routeRows.length,
            response_shapes: shapeResult.truncated,
            consumers: consumerResult.truncated,
            mismatches: unknownResult.truncated,
            middleware: middlewareResult.truncated,
            processes: sumCounts(processCountByRoute) > processes.length,
        },
    };
}

function count(store, sql) {
    return store.db.prepare(sql).get().count;
}

export function diagnoseGraph(store) {
    const stats = store.stats();
    const languages = store.indexedLanguages();
    const counts = {
        routes: count(store, "SELECT COUNT(*) AS count FROM nodes WHERE kind = 'framework_route'"),
        api_shapes: count(store, "SELECT COUNT(*) AS count FROM nodes WHERE kind = 'api_response_shape'"),
        api_consumers: count(store, "SELECT COUNT(*) AS count FROM nodes WHERE kind = 'api_consumer'"),
        processes: count(store, "SELECT COUNT(*) AS count FROM nodes WHERE kind IN ('framework_process', 'process')"),
        framework_edges: count(store, "SELECT COUNT(*) AS count FROM edges WHERE layer = 'framework'"),
        api_edges: count(store, "SELECT COUNT(*) AS count FROM edges WHERE layer = 'api'"),
        process_edges: count(store, "SELECT COUNT(*) AS count FROM edges WHERE layer = 'process'"),
        precise_edges: count(store, "SELECT COUNT(*) AS count FROM edges WHERE origin LIKE 'precise_%'"),
    };
    const providers = languages.map(language => store.providerStatusForLanguage(language));
    const checks = [
        { name: "store", status: stats.files ? "ok" : "empty", count: stats.files },
        { name: "symbols", status: stats.nodes ? "ok" : "empty", count: stats.nodes },
        { name: "framework_overlay", status: counts.routes ? "ok" : "missing", count: counts.routes },
        { name: "api_shapes", status: counts.api_shapes ? "ok" : (counts.routes ? "partial" : "missing"), count: counts.api_shapes },
        { name: "processes", status: counts.processes ? "ok" : (counts.routes ? "partial" : "missing"), count: counts.processes },
    ];
    const warnings = [];
    if (!stats.files) warnings.push("No indexed files found. Run index_project on the project root.");
    if (stats.files && !counts.routes) warnings.push("No framework routes were detected; API/process impact will be limited to symbol and module facts.");
    if (counts.routes && !counts.api_shapes) warnings.push("Routes were detected but no response-shape facts were inferred.");
    if (counts.routes && !counts.processes) warnings.push("Routes were detected but no process facts were inferred.");

    return {
        stats,
        counts,
        languages,
        providers,
        checks,
        warnings,
    };
}
