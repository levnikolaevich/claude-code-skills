import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const FRAMEWORK_PROCESS_KIND = "framework_process";
const FRAMEWORK_NODE_KINDS = [
    "framework_route",
    "framework_middleware",
    "framework_registration",
    "api_response_shape",
    "api_consumer",
    FRAMEWORK_PROCESS_KIND,
    // Clear legacy synthetic process nodes created before the kind was namespaced.
    "process",
];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const ASPNET_HTTP_ATTRS = new Map([
    ["HttpGet", "GET"],
    ["HttpPost", "POST"],
    ["HttpPut", "PUT"],
    ["HttpPatch", "PATCH"],
    ["HttpDelete", "DELETE"],
    ["HttpHead", "HEAD"],
    ["AcceptVerbs", "GET"],
]);

export function runFrameworkOverlay({ projectPath, store, sourceFiles }) {
    store.clearEdgesByLayer("framework");
    store.clearEdgesByLayer("api");
    store.clearEdgesByLayer("process");
    store.clearNodesByKinds(FRAMEWORK_NODE_KINDS);

    const contexts = buildContexts(projectPath, store, sourceFiles || []);
    const routeRecords = [];
    const deferredMiddleware = [];
    let edge_count = 0;
    let node_count = 0;

    for (const context of contexts.values()) {
        edge_count += scanReact(context);

        const nextResult = scanNext(context, routeRecords, deferredMiddleware);
        edge_count += nextResult.edge_count;
        node_count += nextResult.node_count;

        const expressResult = scanExpress(context, routeRecords);
        edge_count += expressResult.edge_count;
        node_count += expressResult.node_count;

        const nestResult = scanNest(context, routeRecords, deferredMiddleware);
        edge_count += nestResult.edge_count;
        node_count += nestResult.node_count;

        const djangoResult = scanDjango(context, contexts, routeRecords, deferredMiddleware);
        edge_count += djangoResult.edge_count;
        node_count += djangoResult.node_count;

        const fastapiResult = scanFastApi(context, routeRecords);
        edge_count += fastapiResult.edge_count;
        node_count += fastapiResult.node_count;

        const flaskResult = scanFlask(context, routeRecords);
        edge_count += flaskResult.edge_count;
        node_count += flaskResult.node_count;

        const laravelResult = scanLaravel(context, routeRecords);
        edge_count += laravelResult.edge_count;
        node_count += laravelResult.node_count;

        const aspnetResult = scanAspNet(context, routeRecords, deferredMiddleware);
        edge_count += aspnetResult.edge_count;
        node_count += aspnetResult.node_count;
    }

    for (const item of deferredMiddleware) {
        const targets = routeRecords.filter(record => item.scope(record));
        for (const target of targets) {
            if (item.exclude && item.exclude(target)) continue;
            edge_count += insertFrameworkEdge(contexts.get(item.file).store, item.node.id, target.node.id, "middleware_for", item.origin, item.file, item.line, {
                framework: item.framework,
                route_path: target.path,
                http_method: target.method,
                middleware: item.node.name,
            });
        }
    }

    const derived = buildDerivedApiAndProcessFacts(contexts, routeRecords);
    edge_count += derived.edge_count;
    node_count += derived.node_count;

    return {
        status: "available",
        edge_count,
        node_count,
        detail: {
            route_count: routeRecords.length,
            api_shape_count: derived.api_shape_count,
            api_consumer_count: derived.api_consumer_count,
            process_count: derived.process_count,
        },
    };
}

function buildContexts(projectPath, store, sourceFiles) {
    const contexts = new Map();
    const symbolIndex = new Map();
    const pythonModuleToFile = new Map();

    for (const relPath of sourceFiles) {
        const fullPath = resolve(projectPath, relPath);
        let source = "";
        try {
            source = readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");
        } catch {
            continue;
        }
        const nodes = store.nodesByFile(relPath);
        const defs = nodes.filter(node => !["import", "module", "reexport", "external_module", "external_symbol", ...FRAMEWORK_NODE_KINDS].includes(node.kind));
        const moduleNode = nodes.find(node => node.kind === "module") || null;
        const defaultExport = nodes.find(node => node.is_default_export && !["import", "module"].includes(node.kind)) || null;
        const ownership = store.describeFileOwnership(relPath);
        const context = {
            projectPath,
            store,
            file: relPath,
            fullPath,
            source,
            lines: source.split("\n"),
            language: guessLanguage(relPath, defs),
            nodes,
            defs,
            defsByName: buildNameIndex(defs),
            moduleNode,
            defaultExport,
            ownership,
            globalSymbol(name, kind = null, parent = null) {
                return resolveGlobalSymbol(symbolIndex, name, kind, parent);
            },
        };
        contexts.set(relPath, context);
        if (context.language === "python") {
            pythonModuleToFile.set(toPythonModule(relPath), relPath);
        }
        for (const node of defs) {
            const list = symbolIndex.get(node.name) || [];
            list.push(node);
            symbolIndex.set(node.name, list);
        }
    }

    for (const context of contexts.values()) {
        context.pythonModuleToFile = pythonModuleToFile;
    }
    return contexts;
}

function buildNameIndex(defs) {
    const index = new Map();
    for (const node of defs) {
        const list = index.get(node.name) || [];
        list.push(node);
        index.set(node.name, list);
    }
    return index;
}

function guessLanguage(filePath, defs) {
    const ext = extname(filePath).toLowerCase();
    if (ext === ".py") return "python";
    if (ext === ".php") return "php";
    if (ext === ".cs") return "c_sharp";
    if (ext === ".tsx" || ext === ".ts" || ext === ".jsx" || ext === ".js" || ext === ".mjs" || ext === ".cjs") {
        return defs.find(node => node.language)?.language || "typescript";
    }
    return defs.find(node => node.language)?.language || "unknown";
}

function resolveGlobalSymbol(symbolIndex, name, kind = null, parent = null) {
    const clean = sanitizeName(name);
    if (!clean) return null;
    let candidates = symbolIndex.get(clean) || [];
    if (kind) candidates = candidates.filter(node => node.kind === kind);
    if (parent) candidates = candidates.filter(node => node.qualified_name?.includes(`:${parent}.${clean}`));
    return candidates.length === 1 ? candidates[0] : null;
}

function sanitizeName(value) {
    return String(value || "")
        .replace(/^this\./, "")
        .replace(/^self\./, "")
        .replace(/^\$this->/, "")
        .replace(/^\$/, "")
        .replace(/^global::/, "")
        .replace(/::class$/, "")
        .replace(/[?!.].*$/, "")
        .trim();
}

function uniqueNodeByName(context, name, kind = null, parent = null) {
    const clean = sanitizeName(name);
    if (!clean) return null;
    let local = context.defsByName.get(clean) || [];
    if (kind) local = local.filter(node => node.kind === kind);
    if (parent) local = local.filter(node => node.qualified_name?.includes(`:${parent}.${clean}`));
    if (local.length === 1) return local[0];
    if (local.length > 1) return null;
    return context.globalSymbol(clean, kind, parent);
}

function createFrameworkNode(context, kind, name, stableKey, line, extra = {}) {
    const qualified_name = `${context.file}:${kind}:${stableKey}`;
    const existing = context.store.findByQualified(qualified_name)[0];
    if (existing) return { node: existing, created: false };
    const id = context.store.insertNode({
        name,
        qualified_name,
        workspace_qualified_name: `${context.ownership?.module_key || "framework"}:${kind}:${stableKey}`,
        kind,
        language: context.language,
        file: context.file,
        line_start: line || 1,
        line_end: line || 1,
        parent_id: null,
        signature: extra.signature || null,
    });
    return { node: context.store.getNodeById(id), created: true };
}

function insertFrameworkEdge(store, sourceId, targetId, kind, origin, file, line, evidence, options = {}) {
    if (!sourceId || !targetId || sourceId === targetId) return 0;
    store.insertEdge({
        source_id: sourceId,
        target_id: targetId,
        layer: options.layer || "framework",
        kind,
        confidence: options.confidence || "exact",
        origin,
        file,
        line,
        evidence_json: JSON.stringify(evidence),
    });
    return 1;
}

function buildDerivedApiAndProcessFacts(contexts, routeRecords) {
    let edge_count = 0;
    let node_count = 0;
    let api_shape_count = 0;
    let api_consumer_count = 0;
    let process_count = 0;
    const shapeNodesByRouteKey = new Map();
    const shapeCountByRoute = new Map();

    for (const record of routeRecords) {
        const handlerContext = contexts.get(record.handler?.file) || contexts.get(record.node?.file);
        if (!handlerContext) continue;

        const handlerSource = extractSymbolSource(handlerContext, record.handler);
        const responseKeys = extractResponseKeys(handlerSource.source, handlerContext.language, handlerSource.startLine);
        for (const item of responseKeys) {
            const stableKey = `shape:${record.framework}:${record.method}:${record.path}:${item.key}`;
            const shapeNode = createFrameworkNode(
                handlerContext,
                "api_response_shape",
                item.key,
                stableKey,
                item.line || record.handler?.line_start || 1,
                { signature: `${record.method} ${record.path}.${item.key}` },
            );
            node_count += shapeNode.created ? 1 : 0;
            api_shape_count += shapeNode.created ? 1 : 0;
            edge_count += insertFrameworkEdge(handlerContext.store, record.node.id, shapeNode.node.id, "route_returns_key", "api:response-shape", handlerContext.file, item.line || record.handler?.line_start || 1, {
                framework: record.framework,
                method: record.method,
                route_path: record.path,
                key: item.key,
            }, { layer: "api", confidence: "inferred" });
            shapeNodesByRouteKey.set(`${record.node.id}:${item.key}`, shapeNode.node);
            shapeCountByRoute.set(record.node.id, (shapeCountByRoute.get(record.node.id) || 0) + 1);
        }

        const processNode = createFrameworkNode(
            handlerContext,
            FRAMEWORK_PROCESS_KIND,
            `${record.method} ${record.path}`,
            `process:${record.framework}:${record.method}:${record.path}:${record.handler?.id || record.node.id}`,
            record.handler?.line_start || record.node?.line_start || 1,
            { signature: `${record.framework} ${record.method} ${record.path}` },
        );
        node_count += processNode.created ? 1 : 0;
        process_count += processNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(handlerContext.store, processNode.node.id, record.node.id, "process_entry", "process:framework-route", handlerContext.file, record.handler?.line_start || record.node?.line_start || 1, {
            framework: record.framework,
            method: record.method,
            route_path: record.path,
        }, { layer: "process", confidence: "inferred" });
        if (record.handler?.id) {
            edge_count += insertFrameworkEdge(handlerContext.store, processNode.node.id, record.handler.id, "process_step", "process:handler", handlerContext.file, record.handler.line_start || 1, {
                framework: record.framework,
                method: record.method,
                route_path: record.path,
                step: "handler",
            }, { layer: "process", confidence: "inferred" });
            const calls = handlerContext.store.edgesFrom(record.handler.id)
                .filter(edge => edge.kind === "calls")
                .slice(0, 8);
            for (const call of calls) {
                edge_count += insertFrameworkEdge(handlerContext.store, processNode.node.id, call.target_id, "process_step", "process:handler-call", call.file || handlerContext.file, call.line || record.handler.line_start || 1, {
                    framework: record.framework,
                    method: record.method,
                    route_path: record.path,
                    step: "call",
                    callee: call.target_name,
                }, { layer: "process", confidence: call.confidence === "precise" ? "precise" : "inferred" });
            }
        }
    }

    for (const context of contexts.values()) {
        const consumers = extractApiConsumers(context, routeRecords);
        for (const consumer of consumers) {
            const consumerNode = createFrameworkNode(
                context,
                "api_consumer",
                `${consumer.route.method} ${consumer.route.path}.${consumer.key}`,
                `consumer:${context.file}:${consumer.route.node.id}:${consumer.key}:${consumer.line}`,
                consumer.line,
                { signature: `${consumer.route.path}.${consumer.key}` },
            );
            node_count += consumerNode.created ? 1 : 0;
            api_consumer_count += consumerNode.created ? 1 : 0;
            edge_count += insertFrameworkEdge(context.store, consumerNode.node.id, consumer.route.node.id, "consumes_route", "api:client-route-use", context.file, consumer.line, {
                framework: consumer.route.framework,
                method: consumer.route.method,
                route_path: consumer.route.path,
                key: consumer.key,
            }, { layer: "api", confidence: "inferred" });
            const shapeNode = shapeNodesByRouteKey.get(`${consumer.route.node.id}:${consumer.key}`);
            if (shapeNode) {
                edge_count += insertFrameworkEdge(context.store, consumerNode.node.id, shapeNode.id, "consumer_uses_key", "api:client-shape-use", context.file, consumer.line, {
                    route_path: consumer.route.path,
                    key: consumer.key,
                }, { layer: "api", confidence: "inferred" });
            } else if ((shapeCountByRoute.get(consumer.route.node.id) || 0) > 0) {
                edge_count += insertFrameworkEdge(context.store, consumerNode.node.id, consumer.route.node.id, "consumer_uses_unknown_key", "api:client-shape-mismatch", context.file, consumer.line, {
                    route_path: consumer.route.path,
                    key: consumer.key,
                }, { layer: "api", confidence: "low" });
            }
        }
    }

    return { edge_count, node_count, api_shape_count, api_consumer_count, process_count };
}

function extractSymbolSource(context, node) {
    if (!node) return { source: "", startLine: 1 };
    const start = Math.max(0, (node.line_start || 1) - 1);
    const end = Math.max(start + 1, Math.min(context.lines.length, node.line_end || node.line_start || start + 40));
    return { source: context.lines.slice(start, end).join("\n"), startLine: start + 1 };
}

function extractResponseKeys(source, language, startLine = 1) {
    const blocks = [];
    const patterns = [
        /(?:Response\.)?json\s*\(\s*\{([\s\S]*?)\}\s*\)/g,
        /\b(?:res|response|reply)\.json\s*\(\s*\{([\s\S]*?)\}\s*\)/g,
        /\bjsonify\s*\(\s*\{([\s\S]*?)\}\s*\)/g,
        /\breturn\s+\{([\s\S]*?)\}/g,
        /\breturn\s+(?:Ok|Results\.Json)\s*\(\s*new\s*\{([\s\S]*?)\}\s*\)/g,
        /response\s*\(\s*\)\s*->\s*json\s*\(\s*\[([\s\S]*?)\]\s*\)/g,
    ];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            blocks.push({
                text: match[1],
                line: startLine + lineForIndex(source, match.index || 0) - 1,
            });
        }
    }
    const seen = new Set();
    const keys = [];
    for (const block of blocks) {
        for (const key of extractObjectKeys(block.text, language)) {
            if (seen.has(key)) continue;
            seen.add(key);
            keys.push({ key, line: block.line });
            if (keys.length >= 25) return keys;
        }
    }
    return keys;
}

function extractObjectKeys(source, language) {
    const keys = [];
    const push = (value) => {
        const key = String(value || "").trim();
        if (/^[A-Za-z_$][\w$]*$/.test(key) && !["return", "new", "await"].includes(key)) keys.push(key);
    };
    for (const match of source.matchAll(/['"]([A-Za-z_$][\w$]*)['"]\s*(?::|=>)/g)) push(match[1]);
    for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g)) push(match[1]);
    if (language === "c_sharp") {
        for (const match of source.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) push(match[1]);
    }
    return [...new Set(keys)];
}

function extractApiConsumers(context, routeRecords) {
    if (![ "javascript", "typescript", "tsx" ].includes(context.language)) return [];
    const consumers = [];
    const routeUses = extractRouteUses(context.source, routeRecords);
    const seen = new Set();
    for (let idx = 0; idx < routeUses.length; idx++) {
        const use = routeUses[idx];
        const nextUse = routeUses[idx + 1];
        const segmentEnd = nextUse ? nextUse.index : Math.min(context.source.length, use.index + 4000);
        const segment = context.source.slice(use.index, segmentEnd);
        const jsonVars = extractJsonVariablesForRoute(segment, use.responseVar, use.directJsonVar);
        for (const variable of jsonVars) {
            const pattern = new RegExp(`\\b${escapeRegex(variable)}\\.([A-Za-z_$][\\w$]*)`, "g");
            for (const match of segment.matchAll(pattern)) {
                const key = match[1];
                const absoluteIndex = use.index + (match.index || 0);
                for (const route of use.routes) {
                    const stable = `${route.node.id}:${context.file}:${variable}:${key}:${absoluteIndex}`;
                    if (seen.has(stable)) continue;
                    seen.add(stable);
                    consumers.push({
                        route,
                        key,
                        line: lineForIndex(context.source, absoluteIndex),
                    });
                    if (consumers.length >= 100) return consumers;
                }
            }
        }
    }
    return consumers;
}

function extractRouteUses(source, routeRecords) {
    const routesByPath = new Map();
    for (const route of routeRecords) {
        const list = routesByPath.get(route.path) || [];
        list.push(route);
        routesByPath.set(route.path, list);
    }
    const uses = [];
    const routeCall = /\b(?:fetch|(?:axios|client|api|http)\.(?:get|post|put|patch|delete|head|options))\s*\(\s*(['"`])([^'"`]+)\1/g;
    for (const match of source.matchAll(routeCall)) {
        const literalPath = String(match[2] || "").split(/[?#]/, 1)[0];
        const routes = routesByPath.get(literalPath);
        if (!routes?.length) continue;
        uses.push({
            index: match.index || 0,
            routes,
            responseVar: extractAssignedVariableBefore(source, match.index || 0),
            directJsonVar: extractDirectJsonVariable(source, match.index || 0),
        });
    }
    return uses.sort((a, b) => a.index - b.index);
}

function extractAssignedVariableBefore(source, index) {
    const lineStart = source.lastIndexOf("\n", index) + 1;
    const prefix = source.slice(lineStart, index);
    return /(?:^|[;\s])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/.exec(prefix)?.[1] || null;
}

function extractDirectJsonVariable(source, index) {
    const lineStart = source.lastIndexOf("\n", index) + 1;
    const lineEnd = source.indexOf("\n", index);
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
    if (!/\.json\s*\(|\.data\b/.test(line)) return null;
    return /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line)?.[1] || null;
}

function extractJsonVariablesForRoute(source, responseVar, directJsonVar) {
    const variables = new Set();
    if (directJsonVar) variables.add(directJsonVar);
    if (responseVar) {
        const escaped = escapeRegex(responseVar);
        const jsonPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*await\\s+${escaped}\\.json\\s*\\(\\s*\\)`, "g");
        for (const match of source.matchAll(jsonPattern)) variables.add(match[1]);
        const dataPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\.data\\b`, "g");
        for (const match of source.matchAll(dataPattern)) variables.add(match[1]);
        return variables;
    }
    const genericJson = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+[A-Za-z_$][\w$]*\.json\s*\(\s*\)/g;
    for (const match of source.matchAll(genericJson)) {
        variables.add(match[1]);
    }
    return variables;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineForIndex(source, index) {
    if (index <= 0) return 1;
    let count = 1;
    for (let i = 0; i < index; i++) {
        if (source.charCodeAt(i) === 10) count++;
    }
    return count;
}

function normalizeRoutePath(...parts) {
    const tokens = parts
        .flatMap(part => Array.isArray(part) ? part : [part])
        .filter(Boolean)
        .map(part => String(part).trim())
        .filter(Boolean)
        .map(part => part.replace(/^["'`]|["'`]$/g, ""))
        .map(part => part.replace(/^\//, "").replace(/\/$/, ""))
        .filter(part => part && part !== ".");
    return `/${tokens.join("/")}`.replace(/\/+/g, "/") || "/";
}

function stripLiteral(value) {
    return String(value || "")
        .trim()
        .replace(/^@?["'`]/, "")
        .replace(/["'`]$/, "");
}

function splitArgs(value) {
    const parts = [];
    let current = "";
    let depth = 0;
    let quote = null;
    for (const char of String(value || "")) {
        if (quote) {
            current += char;
            if (char === quote) quote = null;
            continue;
        }
        if (char === "'" || char === "\"" || char === "`") {
            quote = char;
            current += char;
            continue;
        }
        if (char === "(" || char === "[" || char === "{") depth++;
        if (char === ")" || char === "]" || char === "}") depth--;
        if (char === "," && depth === 0) {
            if (current.trim()) parts.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

function toPythonModule(filePath) {
    return filePath
        .replace(/^\.\//, "")
        .replace(/\/__init__\.py$/, "")
        .replace(/\.py$/, "")
        .replace(/\//g, ".");
}

function scanReact(context) {
    if (!["javascript", "typescript", "tsx"].includes(context.language)) return 0;
    if (!/\.(jsx|tsx)$/.test(context.file) && !context.source.includes("<")) return 0;
    let edge_count = 0;
    for (const node of context.defs.filter(item => ["function", "method", "class"].includes(item.kind) && /^[A-Z]/.test(item.name))) {
        const snippet = context.lines.slice(Math.max(0, node.line_start - 1), node.line_end).join("\n");
        for (const match of snippet.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
            const target = uniqueNodeByName(context, match[1], null, null);
            if (!target || target.id === node.id) continue;
            edge_count += insertFrameworkEdge(context.store, node.id, target.id, "renders", "framework:react:jsx-render", context.file, node.line_start, {
                framework: "react",
                tag: match[1],
                source_component: node.name,
            });
        }
    }
    return edge_count;
}

function scanNext(context, routeRecords, deferredMiddleware) {
    if (!["javascript", "typescript", "tsx"].includes(context.language)) return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    const routeMatch = context.file.match(/^app\/(.*)\/route\.[^.]+$/);
    if (routeMatch) {
        const routePath = toNextRoutePath(routeMatch[1]);
        for (const method of HTTP_METHODS) {
            const handler = uniqueNodeByName(context, method);
            if (!handler) continue;
            const routeNode = createFrameworkNode(context, "framework_route", `${method} ${routePath}`, `next:${method}:${routePath}`, handler.line_start);
            node_count += routeNode.created ? 1 : 0;
            edge_count += insertFrameworkEdge(context.store, routeNode.node.id, handler.id, "route_to_handler", "framework:next:route-handler", context.file, handler.line_start, {
                framework: "next",
                method,
                route_path: routePath,
                file_convention: "app-route-handler",
            });
            routeRecords.push({ framework: "next", method, path: routePath, node: routeNode.node, handler });
        }
    }
    const pageMatch = context.file.match(/^app\/(.*)\/page\.[^.]+$/);
    if (pageMatch && context.defaultExport) {
        const routePath = toNextRoutePath(pageMatch[1]);
        const routeNode = createFrameworkNode(context, "framework_route", `PAGE ${routePath}`, `next:page:${routePath}`, context.defaultExport.line_start);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, context.defaultExport.id, "route_to_handler", "framework:next:page", context.file, context.defaultExport.line_start, {
            framework: "next",
            method: "PAGE",
            route_path: routePath,
            file_convention: "app-page",
        });
        routeRecords.push({ framework: "next", method: "PAGE", path: routePath, node: routeNode.node, handler: context.defaultExport });
    }
    if (/^middleware\.[^.]+$/.test(basename(context.file))) {
        const middlewareTarget = uniqueNodeByName(context, "middleware") || context.defaultExport || context.moduleNode;
        if (middlewareTarget) {
            const middlewareNode = createFrameworkNode(context, "framework_middleware", "next middleware", "next:middleware:root", middlewareTarget.line_start);
            node_count += middlewareNode.created ? 1 : 0;
            deferredMiddleware.push({
                framework: "next",
                file: context.file,
                node: middlewareNode.node,
                line: middlewareTarget.line_start,
                origin: "framework:next:middleware",
                scope: record => record.framework === "next",
            });
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, middlewareTarget.id, "registers", "framework:next:middleware-export", context.file, middlewareTarget.line_start, {
                framework: "next",
                role: "middleware_entrypoint",
            });
        }
    }
    return { edge_count, node_count };
}

function scanExpress(context, routeRecords) {
    if (!["javascript", "typescript"].includes(context.language)) return { edge_count: 0, node_count: 0 };
    if (!/express|Router\(/.test(context.source)) return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    const routerPrefixes = new Map([["app", ""]]);
    for (const match of context.source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:express\.)?Router\s*\(/g)) {
        routerPrefixes.set(match[1], "");
    }
    for (const match of context.source.matchAll(/\bapp\.use\(\s*(['"`][^'"`]+['"`])\s*,\s*(\w+)\s*\)/g)) {
        if (routerPrefixes.has(match[2])) routerPrefixes.set(match[2], stripLiteral(match[1]));
    }
    for (const match of context.source.matchAll(/\b(app|\w+)\.(get|post|put|patch|delete|head|options)\(\s*(['"`][^'"`]+['"`])\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/gi)) {
        const receiver = match[1];
        const method = match[2].toUpperCase();
        const path = normalizeRoutePath(routerPrefixes.get(receiver) || "", stripLiteral(match[3]));
        const handler = uniqueNodeByName(context, match[4]) || context.globalSymbol(match[4]);
        if (!handler) continue;
        const line = lineForIndex(context.source, match.index);
        const routeNode = createFrameworkNode(context, "framework_route", `${method} ${path}`, `express:${method}:${path}`, line);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, handler.id, "route_to_handler", "framework:express:route", context.file, line, {
            framework: "express",
            method,
            route_path: path,
            receiver,
        });
        routeRecords.push({ framework: "express", method, path, node: routeNode.node, handler });
    }
    for (const match of context.source.matchAll(/\b(app|\w+)\.use\(\s*(?:(['"`][^'"`]+['"`])\s*,\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) {
        const receiver = match[1];
        const maybePath = match[2] ? stripLiteral(match[2]) : "";
        const middlewareTarget = uniqueNodeByName(context, match[3]) || context.globalSymbol(match[3]);
        if (!middlewareTarget || routerPrefixes.has(match[3])) continue;
        const line = lineForIndex(context.source, match.index);
        const middlewareNode = createFrameworkNode(context, "framework_middleware", match[3], `express:${receiver}:${match[3]}:${maybePath || "*"}`, line);
        node_count += middlewareNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, middlewareTarget.id, "registers", "framework:express:middleware-export", context.file, line, {
            framework: "express",
            middleware: match[3],
        });
        for (const route of routeRecords.filter(record => record.framework === "express")) {
            if (maybePath && !route.path.startsWith(normalizeRoutePath(maybePath))) continue;
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, route.node.id, "middleware_for", "framework:express:middleware", context.file, line, {
                framework: "express",
                middleware: match[3],
                route_path: route.path,
                receiver,
            });
        }
    }
    return { edge_count, node_count };
}

function toNextRoutePath(raw) {
    const parts = String(raw || "")
        .split("/")
        .filter(Boolean)
        .filter(part => !/^\((.+)\)$/.test(part))
        .filter(part => !part.startsWith("@"))
        .map(part => part.replace(/^\[\.\.\.(.+)\]$/, ":$1*").replace(/^\[(.+)\]$/, ":$1"));
    return normalizeRoutePath(parts);
}

function scanNest(context, routeRecords, deferredMiddleware) {
    if (!["javascript", "typescript"].includes(context.language)) return { edge_count: 0, node_count: 0 };
    if (!/@Controller|@Injectable|@Module/.test(context.source)) return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    const classBlocks = getClassBlocks(context);
    for (const block of classBlocks) {
        if (block.decorators.some(item => item.name === "Controller")) {
            const controllerNode = uniqueNodeByName(context, block.name, "class");
            if (!controllerNode) continue;
            const ctrlDecorator = block.decorators.find(item => item.name === "Controller");
            const controllerPath = ctrlDecorator?.args[0] ? stripLiteral(ctrlDecorator.args[0]) : "";
            for (const decorator of block.methodDecorators) {
                const method = nestDecoratorToMethod(decorator.name);
                if (!method) continue;
                const target = uniqueNodeByName(context, decorator.methodName, "method", block.name);
                if (!target) continue;
                const routePath = normalizeRoutePath(controllerPath, decorator.args[0] ? stripLiteral(decorator.args[0]) : "");
                const routeNode = createFrameworkNode(context, "framework_route", `${method} ${routePath}`, `nest:${block.name}:${decorator.methodName}:${method}:${routePath}`, decorator.line);
                node_count += routeNode.created ? 1 : 0;
                edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:nest:controller-route", context.file, decorator.line, {
                    framework: "nest",
                    controller: block.name,
                    method,
                    route_path: routePath,
                    decorator: decorator.name,
                });
                routeRecords.push({ framework: "nest", method, path: routePath, node: routeNode.node, handler: target, controller: block.name });
            }
        }

        const classNode = uniqueNodeByName(context, block.name, "class");
        if (classNode) {
            for (const dep of block.constructorDeps) {
                const target = uniqueNodeByName(context, dep.type, "class") || uniqueNodeByName(context, dep.type);
                if (!target) continue;
                edge_count += insertFrameworkEdge(context.store, classNode.id, target.id, "injects", "framework:nest:constructor-injection", context.file, dep.line, {
                    framework: "nest",
                    parameter: dep.name,
                    dependency: dep.type,
                });
            }
        }
    }

    for (const match of context.source.matchAll(/@Module\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
        const line = lineForIndex(context.source, match.index);
        const providers = extractArrayIdentifiers(match[1], "providers");
        const controllers = extractArrayIdentifiers(match[1], "controllers");
        for (const name of [...providers, ...controllers]) {
            const target = uniqueNodeByName(context, name, "class") || context.globalSymbol(name, "class");
            if (!target) continue;
            const registration = createFrameworkNode(context, "framework_registration", `${name} registration`, `nest:module:${name}:${line}`, line);
            node_count += registration.created ? 1 : 0;
            edge_count += insertFrameworkEdge(context.store, registration.node.id, target.id, "registers", "framework:nest:module-registration", context.file, line, {
                framework: "nest",
                registration: controllers.includes(name) ? "controller" : "provider",
                target: name,
            });
        }
    }

    for (const match of context.source.matchAll(/consumer\.apply\(([^)]+)\)\.forRoutes\(([^)]+)\)/g)) {
        const middlewareName = sanitizeName(match[1].split(",")[0]);
        const controllerName = sanitizeName(match[2].split(",")[0]);
        const middlewareTarget = uniqueNodeByName(context, middlewareName) || context.globalSymbol(middlewareName);
        if (!middlewareTarget) continue;
        const line = lineForIndex(context.source, match.index);
        const middlewareNode = createFrameworkNode(context, "framework_middleware", middlewareName, `nest:${middlewareName}:${controllerName}:${line}`, line);
        node_count += middlewareNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, middlewareTarget.id, "registers", "framework:nest:middleware-registration", context.file, line, {
            framework: "nest",
            middleware: middlewareName,
            controller: controllerName,
        });
        deferredMiddleware.push({
            framework: "nest",
            file: context.file,
            node: middlewareNode.node,
            line,
            origin: "framework:nest:middleware",
            scope: record => record.framework === "nest" && (!controllerName || record.controller === controllerName),
        });
    }
    return { edge_count, node_count };
}

function scanDjango(context, contexts, routeRecords, deferredMiddleware) {
    if (context.language !== "python") return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    if (/\burlpatterns\b/.test(context.source)) {
        const routes = expandDjangoRoutes(context, contexts, new Set(), "");
        for (const route of routes) {
            const target = resolveDjangoView(contexts, route);
            if (!target) continue;
            const ownerContext = contexts.get(route.file) || context;
            const routeNode = createFrameworkNode(ownerContext, "framework_route", `${route.method} ${route.path}`, `django:${route.file}:${route.path}:${route.viewName}`, route.line);
            node_count += routeNode.created ? 1 : 0;
            edge_count += insertFrameworkEdge(ownerContext.store, routeNode.node.id, target.id, "route_to_handler", "framework:django:urlpattern", route.file, route.line, {
                framework: "django",
                method: route.method,
                route_path: route.path,
                view: route.viewName,
            });
            routeRecords.push({ framework: "django", method: route.method, path: route.path, node: routeNode.node, handler: target });
        }
    }
    if (/\bMIDDLEWARE\s*=/.test(context.source)) {
        const middlewareItems = extractAssignedStringArray(context.source, "MIDDLEWARE");
        middlewareItems.forEach((entry, index) => {
            const line = 1 + index;
            const middlewareNode = createFrameworkNode(context, "framework_middleware", entry.split(".").pop(), `django:${entry}:${index}`, line);
            node_count += middlewareNode.created ? 1 : 0;
            deferredMiddleware.push({
                framework: "django",
                file: context.file,
                node: middlewareNode.node,
                line,
                origin: "framework:django:middleware",
                scope: record => record.framework === "django",
            });
        });
    }
    return { edge_count, node_count };
}

function scanFastApi(context, routeRecords) {
    if (context.language !== "python") return { edge_count: 0, node_count: 0 };
    if (!/FastAPI|APIRouter|Depends|add_middleware/.test(context.source)) return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    const routerPrefixes = new Map([["app", ""]]);
    for (const match of context.source.matchAll(/\b(\w+)\s*=\s*APIRouter\(([\s\S]*?)\)/g)) {
        const prefix = extractNamedStringArg(match[2], "prefix") || "";
        routerPrefixes.set(match[1], prefix);
    }
    for (const match of context.source.matchAll(/\bapp\.include_router\(\s*(\w+)([\s\S]*?)\)/g)) {
        const prefix = extractNamedStringArg(match[2], "prefix") || "";
        routerPrefixes.set(match[1], normalizeRoutePath(routerPrefixes.get(match[1]) || "", prefix));
    }
    for (const match of context.source.matchAll(/@(\w+)\.(get|post|put|patch|delete|head|options)\(\s*(['"`][^'"`]+['"`])([\s\S]*?)\)\s*[\r\n]+\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gi)) {
        const receiver = match[1];
        const method = match[2].toUpperCase();
        const path = normalizeRoutePath(routerPrefixes.get(receiver) || "", stripLiteral(match[3]));
        const line = lineForIndex(context.source, match.index);
        const target = uniqueNodeByName(context, match[5], "function") || context.globalSymbol(match[5], "function");
        if (!target) continue;
        const routeNode = createFrameworkNode(context, "framework_route", `${method} ${path}`, `fastapi:${receiver}:${method}:${path}`, line);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:fastapi:path-operation", context.file, line, {
            framework: "fastapi",
            method,
            route_path: path,
            receiver,
        });
        routeRecords.push({ framework: "fastapi", method, path, node: routeNode.node, handler: target });

        const depNames = [
            ...extractDependsNames(match[4]),
            ...extractDependsNames(match[6]),
        ];
        for (const depName of depNames) {
            const depTarget = uniqueNodeByName(context, depName) || context.globalSymbol(depName);
            if (!depTarget) continue;
            edge_count += insertFrameworkEdge(context.store, target.id, depTarget.id, "injects", "framework:fastapi:depends", context.file, line, {
                framework: "fastapi",
                dependency: depName,
                function: match[5],
            });
        }
    }
    for (const match of context.source.matchAll(/\bapp\.add_middleware\(\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const middlewareTarget = uniqueNodeByName(context, match[1]) || context.globalSymbol(match[1]);
        const line = lineForIndex(context.source, match.index);
        const middlewareNode = createFrameworkNode(context, "framework_middleware", match[1], `fastapi:${match[1]}:${line}`, line);
        node_count += middlewareNode.created ? 1 : 0;
        if (middlewareTarget) {
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, middlewareTarget.id, "registers", "framework:fastapi:middleware-registration", context.file, line, {
                framework: "fastapi",
                middleware: match[1],
            });
        }
        for (const route of routeRecords.filter(record => record.framework === "fastapi")) {
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, route.node.id, "middleware_for", "framework:fastapi:middleware", context.file, line, {
                framework: "fastapi",
                middleware: match[1],
                route_path: route.path,
            });
        }
    }
    return { edge_count, node_count };
}

function scanFlask(context, routeRecords) {
    if (context.language !== "python") return { edge_count: 0, node_count: 0 };
    if (!/Flask|Blueprint|before_request|route\(/.test(context.source)) return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    const blueprintPrefixes = new Map([["app", ""]]);
    for (const match of context.source.matchAll(/\b(\w+)\s*=\s*Blueprint\([\s\S]*?url_prefix\s*=\s*(['"`][^'"`]+['"`])/g)) {
        blueprintPrefixes.set(match[1], stripLiteral(match[2]));
    }
    for (const match of context.source.matchAll(/\bapp\.register_blueprint\(\s*(\w+)([\s\S]*?)\)/g)) {
        const prefix = extractNamedStringArg(match[2], "url_prefix");
        const existing = blueprintPrefixes.get(match[1]) || "";
        blueprintPrefixes.set(match[1], normalizeRoutePath(prefix || "", existing));
    }
    for (const match of context.source.matchAll(/@(\w+)\.route\(\s*(['"`][^'"`]+['"`])[\s\S]*?\)\s*[\r\n]+\s*def\s+(\w+)\s*\(/g)) {
        const owner = match[1];
        const path = normalizeRoutePath(blueprintPrefixes.get(owner) || "", stripLiteral(match[2]));
        const line = lineForIndex(context.source, match.index);
        const target = uniqueNodeByName(context, match[3], "function") || context.globalSymbol(match[3], "function");
        if (!target) continue;
        const routeNode = createFrameworkNode(context, "framework_route", `ANY ${path}`, `flask:${owner}:${path}:${match[3]}`, line);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:flask:route", context.file, line, {
            framework: "flask",
            route_path: path,
            owner,
        });
        routeRecords.push({ framework: "flask", method: "ANY", path, node: routeNode.node, handler: target, owner });
    }
    for (const match of context.source.matchAll(/@(\w+)\.(before_request|before_app_request)\s*[\r\n]+\s*def\s+(\w+)\s*\(/g)) {
        const owner = match[1];
        const line = lineForIndex(context.source, match.index);
        const middlewareTarget = uniqueNodeByName(context, match[3], "function") || context.globalSymbol(match[3], "function");
        const middlewareNode = createFrameworkNode(context, "framework_middleware", match[3], `flask:${owner}:${match[2]}:${match[3]}`, line);
        node_count += middlewareNode.created ? 1 : 0;
        if (middlewareTarget) {
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, middlewareTarget.id, "registers", "framework:flask:request-hook", context.file, line, {
                framework: "flask",
                hook: match[2],
                owner,
            });
        }
        for (const route of routeRecords.filter(record => record.framework === "flask" && (owner === "app" || owner === record.owner))) {
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, route.node.id, "middleware_for", "framework:flask:request-hook", context.file, line, {
                framework: "flask",
                hook: match[2],
                route_path: route.path,
            });
        }
    }
    return { edge_count, node_count };
}

function scanLaravel(context, routeRecords) {
    if (context.language !== "php") return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;
    for (const match of context.source.matchAll(/Route::(?:(middleware)\(\s*(['"`][^'"`]+['"`])\)\s*->\s*)?(get|post|put|patch|delete|options|match)\(\s*(['"`][^'"`]+['"`])\s*,\s*\[([A-Za-z_][A-Za-z0-9_\\\\]+)::class,\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\]/gi)) {
        const middleware = match[2] ? stripLiteral(match[2]) : null;
        const method = match[3].toUpperCase();
        const path = normalizeRoutePath(stripLiteral(match[4]));
        const controller = shortPhpName(match[5]);
        const action = match[6];
        const line = lineForIndex(context.source, match.index);
        const target = uniqueNodeByName(context, action, "method", controller) || context.globalSymbol(action, "method", controller);
        if (!target) continue;
        const routeNode = createFrameworkNode(context, "framework_route", `${method} ${path}`, `laravel:${controller}:${action}:${method}:${path}`, line);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:laravel:route", context.file, line, {
            framework: "laravel",
            method,
            route_path: path,
            controller,
            action,
        });
        routeRecords.push({ framework: "laravel", method, path, node: routeNode.node, handler: target });
        if (middleware) {
            const middlewareNode = createFrameworkNode(context, "framework_middleware", middleware, `laravel:${middleware}:${path}:${line}`, line);
            node_count += middlewareNode.created ? 1 : 0;
            edge_count += insertFrameworkEdge(context.store, middlewareNode.node.id, routeNode.node.id, "middleware_for", "framework:laravel:route-middleware", context.file, line, {
                framework: "laravel",
                middleware,
                route_path: path,
            });
        }
    }
    if (/extends\s+ServiceProvider/.test(context.source)) {
        for (const match of context.source.matchAll(/\$this->app->(?:bind|singleton)\(\s*([A-Za-z_\\\\][A-Za-z0-9_\\\\]*)::class/g)) {
            const targetName = shortPhpName(match[1]);
            const target = uniqueNodeByName(context, targetName, "class") || context.globalSymbol(targetName, "class");
            if (!target) continue;
            const line = lineForIndex(context.source, match.index);
            const registration = createFrameworkNode(context, "framework_registration", `${targetName} binding`, `laravel:binding:${targetName}:${line}`, line);
            node_count += registration.created ? 1 : 0;
            edge_count += insertFrameworkEdge(context.store, registration.node.id, target.id, "registers", "framework:laravel:container-binding", context.file, line, {
                framework: "laravel",
                binding: targetName,
            });
        }
    }
    return { edge_count, node_count };
}

function scanAspNet(context, routeRecords, deferredMiddleware) {
    if (context.language !== "c_sharp") return { edge_count: 0, node_count: 0 };
    let edge_count = 0;
    let node_count = 0;

    for (const block of getCSharpClassBlocks(context)) {
        const classNode = uniqueNodeByName(context, block.name, "class");
        const classRoute = block.classRoute || "";
        if (classNode) {
            for (const method of block.methods) {
                const verb = method.httpMethod;
                if (!verb) continue;
                const target = uniqueNodeByName(context, method.name, "method", block.name) || context.globalSymbol(method.name, "method", block.name);
                if (!target) continue;
                const path = normalizeRoutePath(classRoute, method.route || "");
                const routeNode = createFrameworkNode(context, "framework_route", `${verb} ${path}`, `aspnet:${block.name}:${method.name}:${verb}:${path}`, method.line);
                node_count += routeNode.created ? 1 : 0;
                edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:aspnet:controller-route", context.file, method.line, {
                    framework: "aspnet",
                    method: verb,
                    route_path: path,
                    controller: block.name,
                    action: method.name,
                });
                routeRecords.push({ framework: "aspnet", method: verb, path, node: routeNode.node, handler: target });
            }
            for (const dep of block.constructorDeps) {
                const target = uniqueNodeByName(context, dep.type, "class") || context.globalSymbol(dep.type, "class") || context.globalSymbol(dep.type);
                if (!target) continue;
                edge_count += insertFrameworkEdge(context.store, classNode.id, target.id, "injects", "framework:aspnet:constructor-injection", context.file, dep.line, {
                    framework: "aspnet",
                    dependency: dep.type,
                    parameter: dep.name,
                });
            }
        }
    }

    const source = context.source;
    const groupPrefixes = new Map([["app", ""]]);
    for (const match of source.matchAll(/\bvar\s+(\w+)\s*=\s*app\.MapGroup\(\s*(".*?"|'.*?')\s*\)/g)) {
        groupPrefixes.set(match[1], stripLiteral(match[2]));
    }
    for (const match of source.matchAll(/\b(app|\w+)\.Map(Get|Post|Put|Patch|Delete)\(\s*(".*?"|'.*?')\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const owner = match[1];
        const method = match[2].toUpperCase();
        const path = normalizeRoutePath(groupPrefixes.get(owner) || "", stripLiteral(match[3]));
        const target = uniqueNodeByName(context, match[4], null) || context.globalSymbol(match[4]);
        if (!target) continue;
        const line = lineForIndex(source, match.index);
        const routeNode = createFrameworkNode(context, "framework_route", `${method} ${path}`, `aspnet:minimal:${owner}:${method}:${path}`, line);
        node_count += routeNode.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, routeNode.node.id, target.id, "route_to_handler", "framework:aspnet:minimal-route", context.file, line, {
            framework: "aspnet",
            method,
            route_path: path,
            owner,
        });
        routeRecords.push({ framework: "aspnet", method, path, node: routeNode.node, handler: target });
    }

    for (const match of source.matchAll(/\bbuilder\.Services\.Add(?:Scoped|Singleton|Transient)(?:<([^,>]+),\s*([^>]+)>|<([^>]+)>)/g)) {
        const implementation = sanitizeName(match[2] || match[3]);
        const target = uniqueNodeByName(context, implementation, "class") || context.globalSymbol(implementation, "class");
        if (!target) continue;
        const line = lineForIndex(source, match.index);
        const registration = createFrameworkNode(context, "framework_registration", `${implementation} service`, `aspnet:service:${implementation}:${line}`, line);
        node_count += registration.created ? 1 : 0;
        edge_count += insertFrameworkEdge(context.store, registration.node.id, target.id, "registers", "framework:aspnet:service-registration", context.file, line, {
            framework: "aspnet",
            implementation,
        });
    }

    for (const match of source.matchAll(/\bapp\.Use([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
        const name = `Use${match[1]}`;
        const line = lineForIndex(source, match.index);
        const middlewareNode = createFrameworkNode(context, "framework_middleware", name, `aspnet:${name}:${line}`, line);
        node_count += middlewareNode.created ? 1 : 0;
        deferredMiddleware.push({
            framework: "aspnet",
            file: context.file,
            node: middlewareNode.node,
            line,
            origin: "framework:aspnet:middleware",
            scope: record => record.framework === "aspnet",
        });
    }
    return { edge_count, node_count };
}

function getClassBlocks(context) {
    const blocks = [];
    for (const node of context.defs.filter(item => item.kind === "class")) {
        let startLine = node.line_start;
        while (startLine > 1 && /^\s*@/.test(context.lines[startLine - 2] || "")) {
            startLine--;
        }
        const snippet = context.lines.slice(startLine - 1, node.line_end).join("\n");
        const decorators = [...snippet.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)/g)].map(match => ({
            name: match[1],
            args: splitArgs(match[2]),
            line: startLine + (snippet.slice(0, match.index).match(/\n/g)?.length || 0),
        }));
        const methodDecorators = [...snippet.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)[\s\r\n]*(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(match => ({
            name: match[1],
            args: splitArgs(match[2]),
            methodName: match[3],
            line: startLine + (snippet.slice(0, match.index).match(/\n/g)?.length || 0),
        }));
        const ctorMatch = snippet.match(/constructor\s*\(([\s\S]*?)\)/);
        const constructorDeps = ctorMatch
            ? splitArgs(ctorMatch[1]).map(arg => {
                const dep = arg.match(/(?:public|private|protected|readonly)?\s*(\w+)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/);
                return dep ? { name: dep[1], type: dep[2], line: startLine + (snippet.slice(0, ctorMatch.index).match(/\n/g)?.length || 0) } : null;
            }).filter(Boolean)
            : [];
        blocks.push({ name: node.name, decorators, methodDecorators, constructorDeps });
    }
    return blocks;
}

function getCSharpClassBlocks(context) {
    const blocks = [];
    for (const node of context.defs.filter(item => item.kind === "class")) {
        let startLine = node.line_start;
        while (startLine > 1 && /^\s*\[/.test(context.lines[startLine - 2] || "")) {
            startLine--;
        }
        const snippet = context.lines.slice(startLine - 1, node.line_end).join("\n");
        const classRoute = firstStringArgFromAttributes(snippet, "Route");
        const methods = [...snippet.matchAll(/((?:\[[^\]]+\]\s*)+)\s*public\s+[A-Za-z_<>,\?\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(match => {
            const attrs = match[1];
            const line = startLine + (snippet.slice(0, match.index).match(/\n/g)?.length || 0);
            return { name: match[2], line, httpMethod: resolveAspNetMethod(attrs), route: resolveAspNetRoute(attrs) };
        });
        const constructorDeps = [...snippet.matchAll(new RegExp(`public\\s+${node.name}\\s*\\(([^)]*)\\)`, "g"))]
            .flatMap(match => splitArgs(match[1]).map(arg => {
                const dep = arg.trim().match(/^([A-Za-z_][A-Za-z0-9_<>]*)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
                return dep ? { type: sanitizeGenericType(dep[1]), name: dep[2], line: startLine + (snippet.slice(0, match.index).match(/\n/g)?.length || 0) } : null;
            }))
            .filter(Boolean);
        blocks.push({ name: node.name, classRoute, methods, constructorDeps });
    }
    return blocks;
}

function expandDjangoRoutes(context, contexts, seen, prefix) {
    const key = `${context.file}:${prefix}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const routes = [];
    for (const match of context.source.matchAll(/\b(path|re_path)\(\s*(['"`][^'"`]*['"`])\s*,\s*([^)]+)\)/g)) {
        const routePrefix = normalizeRoutePath(prefix, stripLiteral(match[2]));
        const targetExpr = match[3].trim();
        const line = lineForIndex(context.source, match.index);
        const includeMatch = targetExpr.match(/^include\(\s*(['"`][A-Za-z0-9_\.]+['"`])\s*\)/);
        if (includeMatch) {
            const includeFile = contexts.get(context.pythonModuleToFile.get(stripLiteral(includeMatch[1])));
            if (includeFile) routes.push(...expandDjangoRoutes(includeFile, contexts, seen, routePrefix));
            continue;
        }
        routes.push({ framework: "django", file: context.file, path: routePrefix, viewName: targetExpr, method: "ANY", line });
    }
    return routes;
}

function resolveDjangoView(contexts, route) {
    const expr = route.viewName.replace(/\.as_view\(\)$/, "");
    if (!expr) return null;
    const owner = contexts.get(route.file);
    if (!expr.includes(".")) return uniqueNodeByName(owner, expr, null) || owner.globalSymbol(expr);
    const parts = expr.split(".");
    const short = parts[parts.length - 1];
    return uniqueNodeByName(owner, short) || owner.globalSymbol(short);
}

function nestDecoratorToMethod(name) {
    if (name === "All") return "ALL";
    return HTTP_METHODS.includes(name.toUpperCase()) ? name.toUpperCase() : null;
}

function extractArrayIdentifiers(source, fieldName) {
    const match = source.match(new RegExp(`${fieldName}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
    if (!match) return [];
    return splitArgs(match[1])
        .map(token => sanitizeName(token))
        .filter(Boolean);
}

function extractAssignedStringArray(source, name) {
    const match = source.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
    if (!match) return [];
    return [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map(item => item[1]);
}

function extractNamedStringArg(source, name) {
    const match = source.match(new RegExp(`${name}\\s*=\\s*(['"\`])([^'"\`]+)\\1`));
    return match ? match[2] : null;
}

function extractDependsNames(source) {
    return [...String(source || "").matchAll(/Depends\(\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map(match => match[1]);
}

function resolveAspNetMethod(attrs) {
    for (const [attr, method] of ASPNET_HTTP_ATTRS.entries()) {
        if (new RegExp(`\\[${attr}(?:\\(|\\])`).test(attrs)) return method;
    }
    return null;
}

function resolveAspNetRoute(attrs) {
    for (const attr of [...ASPNET_HTTP_ATTRS.keys(), "Route"]) {
        const value = firstStringArgFromAttributes(attrs, attr);
        if (value != null) return value;
    }
    return "";
}

function firstStringArgFromAttributes(source, attrName) {
    const match = source.match(new RegExp(`\\[${attrName}\\(\\s*(@?\"[^\"]*\"|\"[^\"]*\"|'[^']*')`, "m"));
    if (!match) return "";
    return stripLiteral(match[1]);
}

function sanitizeGenericType(type) {
    return sanitizeName(String(type || "").replace(/<.*>/g, ""));
}

function shortPhpName(value) {
    const clean = sanitizeName(value);
    return clean.split("\\").pop();
}
