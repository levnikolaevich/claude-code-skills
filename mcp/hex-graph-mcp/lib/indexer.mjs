/**
 * 4-pass indexing pipeline for code knowledge graph.
 *
 * Pass 0: RESET — full index_project rebuilds graph DB content from scratch
 * Pass 1: SCAN — discover source files through Git-aware project inventory
 * Pass 2: PARSE — tree-sitter AST -> definitions + imports + calls
 * Pass 3: RESOLVE — link imports to target files, build call edges
 *
 * Idempotent: re-running produces graph state for the current source inventory.
 * Incremental: watcher-driven reindexFile reparses a single edited file.
 */

import { readFileSync, statSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname, relative, join, basename } from "node:path";
import { createHash } from "node:crypto";
import { getStore, hasOpenStore, CODEGRAPH_DIR } from "./store.mjs";
import { runFrameworkOverlay } from "./framework.mjs";
import { parseFile, languageFor, supportedExtensions } from "./parser.mjs";
import { discoverWorkspace, persistWorkspace } from "./workspace.mjs";
import { runPreciseOverlay } from "./precise/index.mjs";
import { extractParamNames, normalizeAnchor } from "./flow.mjs";
import { listProjectFiles } from "./file-discovery.mjs";
import { createPhaseRecorder } from "./phase-runner.mjs";

const MAX_FILE_SIZE = 500_000; // 500KB

function importEdgeEvidence(imp, spec) {
    return JSON.stringify({
        source: imp.source,
        imported: spec.imported || null,
        local: spec.local || null,
        specifier_type: spec.type || "named",
    });
}

function callEdgeEvidence(call) {
    return JSON.stringify({
        token: call.name,
        request_kind: "call",
    });
}

function referenceEdgeEvidence(ref) {
    return JSON.stringify({
        token: ref.name,
        request_kind: ref.refKind === "type_ref" ? "type_ref" : "read",
    });
}

/**
 * Index a project.
 * @param {string} projectPath
 * @param {object} [options]
 * @param {string[]} [options.languages] - filter by language names
 * @returns {Promise<{message: string, status: object}>} summary and structured index status
 */
export async function indexProject(projectPath, { languages } = {}) {
    const absPath = resolve(projectPath);
    const t0 = Date.now();
    const phases = createPhaseRecorder();
    let store;
    const shouldCloseStore = !hasOpenStore(absPath, { mode: "write" });

    if (!existsSync(absPath)) {
        const error = new Error(`PATH_NOT_FOUND: project path does not exist: ${absPath}`);
        error.code = "PATH_NOT_FOUND";
        throw error;
    }
    const rootStat = statSync(absPath);
    if (!rootStat.isDirectory()) {
        const error = new Error(`PATH_NOT_FOUND: project path is not a directory: ${absPath}`);
        error.code = "PATH_NOT_FOUND";
        throw error;
    }

    // Ensure .hex-skills/codegraph dir exists
    const dbDir = join(absPath, CODEGRAPH_DIR);
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

    try {
        store = getStore(absPath);

    const scanPhase = phases.start("scan");
    const allowedExts = languages
        ? supportedExtensions().filter(ext => languages.includes(languageFor(ext)))
        : supportedExtensions();
    const allowedSet = new Set(allowedExts);

    const discoverableSourceFiles = discoverSourceFiles(absPath, new Set(supportedExtensions()));
    const allSourceFiles = languages
        ? discoverableSourceFiles.filter(file => allowedSet.has(extname(file.relPath).toLowerCase()))
        : discoverableSourceFiles;
    scanPhase.end({
        discovered_files: discoverableSourceFiles.length,
        selected_files: allSourceFiles.length,
        language_filter_count: languages?.length || 0,
    });

    // Pass 0: RESET. Full indexing is a deterministic rebuild, not an
    // accumulation pass, so old ignored packages/modules cannot leak forward.
    const resetPhase = phases.start("reset");
    store.resetProjectGraph();
    resetPhase.end();

    // Pass 1: SCAN
    const workspacePhase = phases.start("workspace");
    const filesToIndex = allSourceFiles;
    const workspace = persistWorkspace(store, discoverWorkspace(absPath, allSourceFiles));
    const projectLanguages = [...new Set(allSourceFiles.map(file => file.language).filter(Boolean))];
    workspacePhase.end({
        files: filesToIndex.length,
        languages: projectLanguages.length,
    });

    // Pass 2: PARSE
    const parsePhase = phases.start("parse");
    let parsed = 0;
    const fileNodeMap = new Map(); // relPath -> { definitions, imports, calls, language }

    for (const { relPath, fullPath, mtime } of filesToIndex) {
        let source;
        try {
            source = readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");
        } catch {
            continue;
        }

        const hash = createHash("md5").update(source).digest("hex").slice(0, 12);
        const ext = extname(relPath).toLowerCase();
        const language = languageFor(ext);

        const result = await parseFile(fullPath, source, { cloneDetection: true });
        const { definitions, imports, calls, references } = result;

        // Bulk insert definitions + imports
        const nodeIds = store.bulkInsert(
            relPath,
            mtime,
            hash,
            language,
            definitions,
            imports,
            workspace.ownershipIds.get(relPath) || null,
        );

        // Insert clone detection data
        persistCloneData(store, definitions, nodeIds);

        fileNodeMap.set(relPath, {
            source,
            definitions,
            imports,
            calls,
            references,
            flow_ir: result.flow_ir || [],
            exports: result.exports,
            defaultExport: result.defaultExport,
            reexports: result.reexports,
            language,
            nodeIds,
        });
        parsed++;
    }
    parsePhase.end({
        parsed_files: parsed,
        skipped_files: filesToIndex.length - parsed,
        symbol_files: fileNodeMap.size,
    });

    // Pass 3: RESOLVE — build edges (import, call, reexport)
    const resolvePhase = phases.start("resolve");
    let edgeCount = 0;
    for (const [filePath, data] of fileNodeMap) {
        const {
            source, definitions, imports, calls, references, flow_ir,
            exports: fileExports, defaultExport, reexports, language, nodeIds,
        } = data;
        edgeCount += resolveFileEdges(store, workspace, filePath, {
            source, definitions, imports, calls, references, flow_ir,
            exports: fileExports, defaultExport, reexports, nodeIds, language,
        });
    }
    store.rebuildAllModuleLayerEdges();
    resolvePhase.end({ symbol_edges: edgeCount });

    const precisePhase = phases.start("precise_overlay");
    const precise = await runPreciseOverlay({
        projectPath: absPath,
        store,
        languages: projectLanguages,
        sourceFiles: allSourceFiles.map(file => file.relPath),
    });
    precisePhase.end({
        precise_edges: precise.precise_edges || 0,
        providers: precise.providers?.length || 0,
    });

    const frameworkPhase = phases.start("framework_overlay");
    const framework = runFrameworkOverlay({
        projectPath: absPath,
        store,
        sourceFiles: allSourceFiles.map(file => file.relPath),
    });
    frameworkPhase.end({
        framework_edges: framework.edge_count || 0,
        framework_nodes: framework.node_count || 0,
        route_count: framework.detail?.route_count || 0,
        api_shape_count: framework.detail?.api_shape_count || 0,
        process_count: framework.detail?.process_count || 0,
    });

    const elapsed = Date.now() - t0;
    const stats = store.stats();

        const message = [
            `Indexed ${stats.files} files, ${stats.nodes} symbols, ${stats.edges} edges in ${elapsed}ms`,
            "Rebuilt graph DB from current source inventory",
            `Parsed ${parsed} files (${filesToIndex.length - parsed} read/parse skipped)`,
            `Built ${edgeCount} new call edges`,
            precise.precise_edges > 0 ? `Added ${precise.precise_edges} precise overlay edges` : null,
            framework.edge_count > 0 ? `Added ${framework.edge_count} framework overlay edges` : null,
            ...(precise.providers || [])
                .filter(provider => provider.status && provider.status !== "available")
                .map(provider => provider.message)
                .filter(Boolean),
        ].filter(Boolean).join("\n");
        return {
            message,
            status: {
                revision: `idx-${t0}`,
                files: stats.files,
                symbols: stats.nodes,
                edges: stats.edges,
                parsed_files: parsed,
                skipped_files: filesToIndex.length - parsed,
                elapsed_ms: elapsed,
                phases: phases.results(),
                overlays: {
                    precise_edges: precise.precise_edges || 0,
                    framework_edges: framework.edge_count || 0,
                    framework_nodes: framework.node_count || 0,
                    route_count: framework.detail?.route_count || 0,
                    api_shape_count: framework.detail?.api_shape_count || 0,
                    api_consumer_count: framework.detail?.api_consumer_count || 0,
                    process_count: framework.detail?.process_count || 0,
                },
            },
        };
    } catch (error) {
        phases.fail(error);
        throw error;
    } finally {
        if (store && shouldCloseStore) {
            try { store.checkpoint(); } catch { /* best-effort WAL flush */ }
            store.close();
        }
    }
}

/**
 * Reindex a single file (for watcher).
 * @param {string} projectPath
 * @param {string} filePath - relative to project
 */
export async function reindexFile(projectPath, filePath) {
    const absPath = resolve(projectPath);
    const fullPath = resolve(absPath, filePath);
    const relPath = relative(absPath, fullPath).replace(/\\/g, "/");
    let store;
    const shouldCloseStore = !hasOpenStore(absPath, { mode: "write" });

    try {
        if (!existsSync(fullPath)) {
            store = getStore(absPath);
            store.deleteFile(relPath);
            return;
        }

        const allSourceFiles = discoverSourceFiles(absPath, new Set(supportedExtensions()));
        if (!allSourceFiles.some(file => file.relPath === relPath)) {
            store = getStore(absPath);
            store.deleteFile(relPath);
            return;
        }

        const source = readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");
        const hash = createHash("md5").update(source).digest("hex").slice(0, 12);
        const stat = statSync(fullPath);
        const language = languageFor(extname(relPath).toLowerCase());
        if (!language) return;

        store = getStore(absPath);
        const workspace = persistWorkspace(store, discoverWorkspace(absPath, allSourceFiles));
        const projectLanguages = [...new Set(allSourceFiles.map(file => file.language).filter(Boolean))];
        const { definitions, imports, calls, references, flow_ir, exports: fileExports, defaultExport, reexports } = await parseFile(fullPath, source, { cloneDetection: true });
        const nodeIds = store.bulkInsert(
            relPath,
            stat.mtimeMs,
            hash,
            language,
            definitions,
            imports,
            workspace.ownershipIds.get(relPath) || null,
        );

        persistCloneData(store, definitions, nodeIds);
        resolveFileEdges(store, workspace, relPath, {
            source, definitions, imports, calls, references, flow_ir,
            exports: fileExports, defaultExport, reexports, nodeIds, language,
        });
        store.rebuildAllModuleLayerEdges();
        await runPreciseOverlay({
            projectPath: absPath,
            store,
            languages: projectLanguages,
            sourceFiles: allSourceFiles.map(file => file.relPath),
        });
        runFrameworkOverlay({
            projectPath: absPath,
            store,
            sourceFiles: allSourceFiles.map(file => file.relPath),
        });
    } finally {
        if (store && shouldCloseStore) {
            try { store.checkpoint(); } catch { /* best-effort WAL flush */ }
            store.close();
        }
    }
}

// --- Helpers ---

/**
 * Shared edge resolution for a single file.
 * Creates synthetic reexport nodes, builds import/call/reexport edges,
 * marks exported symbols, and persists module_edges.
 * @returns {number} count of call edges created
 */
function resolveFileEdges(store, workspace, filePath, { source: _source, definitions, imports, calls, references, flow_ir, exports: fileExports, defaultExport, reexports, nodeIds, language }) {
    let callEdgeCount = 0;

    // 1. Create synthetic reexport nodes
    if (reexports && reexports.length > 0) {
        for (const re of reexports) {
            for (const spec of re.specifiers) {
                if (spec.type === "namespace" && spec.local === "*") continue;

                const reexportNodeId = store.insertNode({
                    name: spec.local,
                    qualified_name: `${filePath}:reexport:${spec.local}`,
                    kind: "reexport",
                    language,
                    file: filePath,
                    line_start: re.line || 1,
                    line_end: re.line || 1,
                    parent_id: null,
                    signature: null,
                });
                store.markExported(reexportNodeId);
                nodeIds.set(`reexport:${spec.local}:${re.line}`, reexportNodeId);
            }
        }
    }

    // 1b. Create file-scope module node (fallback source for top-level calls/refs)
    const ext = extname(filePath);
    const moduleNodeId = store.insertNode({
        name: basename(filePath, ext),
        qualified_name: `${filePath}:module`,
        kind: "module",
        language,
        file: filePath,
        line_start: 1,
        line_end: 9999,
        parent_id: null,
        signature: null,
    });

    // 2. Build local symbol map (name -> nodeId, null = ambiguous)
    const localSymbols = new Map();
    const classMethods = new Map();

    for (const def of definitions) {
        if (!nodeIds.has(def.key)) continue;
        const nodeId = nodeIds.get(def.key);

        if (def.parent) {
            classMethods.set(`${def.parent}.${def.name}`, nodeId);
        }

        if (localSymbols.has(def.name)) {
            localSymbols.set(def.name, null);
        } else {
            localSymbols.set(def.name, nodeId);
        }
    }

    // 3. Build imported symbol map from workspace resolution.
    const importedSymbols = new Map();
    const fileOwnership = workspace.ownershipIds.get(filePath) || null;
    store.clearModuleEdges(filePath);
    store.clearPackageEdgesForFile(filePath);
    for (const imp of imports) {
        const resolution = workspace.resolveImport(filePath, imp, language);
        const dependencyTarget = materializeDependencyTarget(store, workspace, resolution, language);
        const targetNodes = resolution.targetFile ? store.nodesByFile(resolution.targetFile) : [];
        const importSpecs = imp.specifiers && imp.specifiers.length > 0
            ? imp.specifiers
            : imp.name.split(", ").map(name => ({ imported: name.trim(), local: name.trim(), type: "named" })).filter(spec => spec.imported);

        if (fileOwnership?.package_id && fileOwnership?.workspace_module_id) {
            store.insertPackageEdge({
                source_module_id: fileOwnership.workspace_module_id,
                target_module_id: dependencyTarget.target_module_id,
                source_package_id: fileOwnership.package_id,
                target_package_id: dependencyTarget.target_package_id,
                source_file: filePath,
                target_file: resolution.targetFile || null,
                import_source: resolution.import_source || imp.source,
                resolution: resolution.resolution || "unresolved",
                is_reexport: 0,
            });
        }

        const rawTargetFile = resolution.targetFile || store.externalModuleFile(imp.source);
        store.insertModuleEdge({
            source_file: filePath,
            target_file: rawTargetFile,
            line: imp.line,
            is_side_effect: !imp.name || imp.name === "*" || imp.name === "" ? 1 : 0,
            is_dynamic: 0,
            is_reexport: 0,
        });

        const importNodeId = nodeIds.get(`import:${imp.source}:${imp.line}`);
        const moduleNode = resolution.targetFile ? store.findByQualified(`${resolution.targetFile}:module`)[0] : null;

        for (const spec of importSpecs) {
            let target = null;

            if (!resolution.targetFile) {
                if (spec.type === "default") {
                    target = store.ensureExternalSymbolNode(imp.source, "default", language);
                } else if (spec.type === "named") {
                    target = store.ensureExternalSymbolNode(imp.source, spec.imported, language);
                } else if (spec.type === "namespace" || spec.type === "module") {
                    target = store.ensureExternalModuleNode(imp.source, language);
                }
            } else if (spec.type === "default") {
                target = targetNodes.find(node => node.is_default_export && node.kind !== "import") || null;
            } else if (spec.type === "namespace") {
                if (importNodeId) {
                    const namespaceTargets = targetNodes.filter(node =>
                        node.kind !== "import"
                        && node.kind !== "module"
                        && !node.is_default_export
                    );
                    for (const exported of namespaceTargets) {
                        store.insertEdge({
                            source_id: importNodeId,
                            target_id: exported.id,
                            layer: "symbol",
                            kind: "imports",
                            confidence: "namespace",
                            origin: resolution.resolution || "workspace_resolved",
                            file: filePath,
                            line: imp.line,
                            evidence_json: importEdgeEvidence(imp, spec),
                        });
                    }
                }
                continue;
            } else if (spec.type === "module") {
                target = moduleNode || null;
            } else {
                target = targetNodes.find(node => node.name === spec.imported && node.kind !== "import") || null;
            }

            if (target && spec.local) {
                importedSymbols.set(spec.local, target.id);
            }

            if (importNodeId && target) {
                store.insertEdge({
                    source_id: importNodeId,
                    target_id: target.id,
                    layer: "symbol",
                    kind: "imports",
                    confidence: resolution.targetFile ? "exact" : "low",
                    origin: resolution.resolution || "unresolved",
                    file: filePath,
                    line: imp.line,
                    evidence_json: importEdgeEvidence(imp, spec),
                });
            }
        }
    }

    // 4. Persist type-layer edges
    const resolvedTypeTargetsByOwner = new Map();
    for (const def of definitions) {
        if ((def.kind !== "class" && def.kind !== "interface") || !def.supertypes?.length) continue;
        const sourceId = nodeIds.get(def.key);
        if (!sourceId) continue;

        for (const supertype of def.supertypes) {
            const target = resolveTypeTarget(supertype.name, filePath, localSymbols, importedSymbols, store);
            if (!target) continue;

            store.insertEdge({
                source_id: sourceId,
                target_id: target.id,
                layer: "type",
                kind: supertype.relation,
                confidence: target.confidence,
                origin: "resolved",
                file: filePath,
                line: def.line_start,
            });

            const ownerTargets = resolvedTypeTargetsByOwner.get(def.name) || [];
            ownerTargets.push(target);
            resolvedTypeTargetsByOwner.set(def.name, ownerTargets);
        }
    }

    // 5. Persist override edges for methods in inherited types
    for (const def of definitions) {
        if (def.kind !== "method" || !def.parent) continue;
        const sourceId = nodeIds.get(def.key);
        if (!sourceId) continue;
        const superTargets = resolvedTypeTargetsByOwner.get(def.parent) || [];

        for (const targetType of superTargets) {
            const baseMethod = store.findByName(def.name).find(candidate =>
                candidate.kind === "method" &&
                candidate.qualified_name &&
                candidate.qualified_name.endsWith(`:${targetType.name}.${def.name}`)
            );
            if (!baseMethod) continue;

            store.insertEdge({
                source_id: sourceId,
                target_id: baseMethod.id,
                layer: "type",
                kind: "overrides",
                confidence: targetType.confidence,
                origin: "resolved",
                file: filePath,
                line: def.line_start,
            });
        }
    }

    // 4. Mark exported symbols
    if (fileExports && fileExports.size > 0) {
        for (const exportName of fileExports) {
            for (const def of definitions) {
                if (def.name === exportName && nodeIds.has(def.key)) {
                    if (exportName === defaultExport) {
                        store.markDefaultExport(nodeIds.get(def.key));
                    } else {
                        store.markExported(nodeIds.get(def.key));
                    }
                    break;
                }
            }
        }
    }
    if (defaultExport === "__default_export__") {
        for (const def of definitions) {
            if (def.name === "__default_export__" && nodeIds.has(def.key)) {
                store.markDefaultExport(nodeIds.get(def.key));
                break;
            }
        }
    }

    // 5. Wire reexport edges
    if (reexports && reexports.length > 0) {
        for (const re of reexports) {
            const resolution = workspace.resolveImport(filePath, { source: re.source, specifiers: re.specifiers }, language);
            const dependencyTarget = materializeDependencyTarget(store, workspace, resolution, language);
            const targetFile = resolution.targetFile || store.externalModuleFile(re.source);

            store.insertModuleEdge({
                source_file: filePath,
                target_file: targetFile,
                line: re.line || 0,
                is_side_effect: 0,
                is_dynamic: 0,
                is_reexport: 1,
            });

            if (fileOwnership?.package_id && fileOwnership?.workspace_module_id) {
                store.insertPackageEdge({
                    source_module_id: fileOwnership.workspace_module_id,
                    target_module_id: dependencyTarget.target_module_id,
                    source_package_id: fileOwnership.package_id,
                    target_package_id: dependencyTarget.target_package_id,
                    source_file: filePath,
                    target_file: resolution.targetFile || null,
                    import_source: resolution.import_source || re.source,
                    resolution: resolution.resolution || "unresolved",
                    is_reexport: 1,
                });
            }

            if (!resolution.targetFile) continue;

            const targetNodes = store.nodesByFile(resolution.targetFile);

            for (const spec of re.specifiers) {
                if (spec.type === "namespace" && spec.local === "*") continue;

                let target;
                if (spec.type === "default" || spec.imported === "default") {
                    target = targetNodes.find(n => n.is_default_export && n.kind !== "import");
                } else {
                    target = targetNodes.find(n => n.name === spec.imported && n.kind !== "import");
                }
                if (!target) continue;

                const reexportNodeId = nodeIds.get(`reexport:${spec.local}:${re.line}`);
                if (!reexportNodeId) continue;

                store.insertEdge({
                    source_id: reexportNodeId,
                    target_id: target.id,
                    layer: "symbol",
                    kind: "reexports",
                    confidence: "exact",
                    origin: "resolved",
                    file: filePath,
                    line: re.line || 0,
                });
            }
        }
    }

    const callEventsByLine = new Map();
    for (const event of flow_ir || []) {
        if (event.kind !== "call") continue;
        const rows = callEventsByLine.get(event.line) || [];
        rows.push(event);
        callEventsByLine.set(event.line, rows);
    }

    // 6. Resolve and persist call edges
    for (const call of calls) {
        const callerDef = findEnclosingDefinition(call.line, definitions);
        const callerId = callerDef ? nodeIds.get(callerDef.key) : moduleNodeId;

        let targetId = null;
        const confidence = "exact";
        const callEvents = callEventsByLine.get(call.line) || [];
        const matchingEvent = callEvents.find(event => event.owner_key === callerDef?.key && event.callee_name === call.name) || null;

        // 1. Same-class sibling method
        if (callerDef?.parent && classMethods.has(`${callerDef.parent}.${call.name}`)) {
            targetId = classMethods.get(`${callerDef.parent}.${call.name}`);
        }
        // 1b. Simple local receiver type inference (e.g. svc.run(), $helper->run())
        else if (matchingEvent?.receiver_type && classMethods.has(`${matchingEvent.receiver_type}.${call.name}`)) {
            targetId = classMethods.get(`${matchingEvent.receiver_type}.${call.name}`);
        }
        // 2. Local symbol (skip null = ambiguous)
        else if (localSymbols.has(call.name) && localSymbols.get(call.name) != null) {
            targetId = localSymbols.get(call.name);
        }
        // 3. Imported symbol
        else if (importedSymbols.has(call.name)) {
            targetId = importedSymbols.get(call.name);
        }
        if (targetId && targetId !== callerId) {
            store.insertEdge({
                source_id: callerId,
                target_id: targetId,
                layer: "symbol",
                kind: "calls",
                confidence,
                origin: "resolved",
                file: filePath,
                line: call.line,
                evidence_json: callEdgeEvidence(call),
            });
            callEdgeCount++;
        }
    }

    // 7. Resolve reference edges
    if (references && references.length > 0) {
        for (const ref of references) {
            const enclosingDef = findEnclosingDefinition(ref.line, definitions);

            let targetId = null;
            const confidence = "exact";

            // Same-class sibling
            if (enclosingDef?.parent && classMethods.has(`${enclosingDef.parent}.${ref.name}`)) {
                targetId = classMethods.get(`${enclosingDef.parent}.${ref.name}`);
            }
            // Local symbol
            else if (localSymbols.has(ref.name) && localSymbols.get(ref.name) != null) {
                targetId = localSymbols.get(ref.name);
            }
            // Imported symbol
            else if (importedSymbols.has(ref.name)) {
                targetId = importedSymbols.get(ref.name);
            }
            // Skip global resolution for refs (too noisy)

            if (!targetId) continue;

            // Skip self-references: if target is the enclosing definition
            const callerId = enclosingDef ? nodeIds.get(enclosingDef.key) : moduleNodeId;
            if (targetId === callerId) continue;

            const edgeKind = ref.refKind === "type_ref" ? "ref_type" : "ref_read";
            store.insertEdge({
                source_id: callerId,
                target_id: targetId,
                layer: "symbol",
                kind: edgeKind,
                confidence,
                origin: "resolved",
                file: filePath,
                line: ref.line,
                evidence_json: referenceEdgeEvidence(ref),
            });
        }
    }

    materializeFlowFacts(store, filePath, nodeIds, flow_ir || []);
    return callEdgeCount;
}

function materializeFlowFacts(store, filePath, nodeIds, flowIr) {
    const paramCache = new Map();

    for (const event of flowIr) {
        const ownerId = nodeIds.get(event.owner_key);
        if (!ownerId) continue;

        if (event.kind === "direct") {
            store.insertFlowFact({
                source_symbol_id: ownerId,
                source_anchor: normalizeAnchor(event.source),
                target_symbol_id: ownerId,
                target_anchor: normalizeAnchor(event.target),
                flow_kind: "value",
                file: filePath,
                line: event.line,
                confidence: "exact",
                origin: "parser_fact",
                evidence_json: JSON.stringify({ kind: "direct", owner_key: event.owner_key }),
            });
            continue;
        }

        if (event.kind !== "call") continue;
        const callEdges = store.edgesFrom(ownerId).filter(edge => edge.kind === "calls" && edge.line === event.line);
        for (const edge of callEdges) {
            const targetNode = store.getNodeById(edge.target_id);
            const calleeParams = targetNode ? getParamNames(targetNode.signature, paramCache) : [];
            for (let index = 0; index < event.args.length && index < calleeParams.length; index++) {
                const sourceAnchor = normalizeAnchor(event.args[index]);
                if (!sourceAnchor) continue;
                store.insertFlowFact({
                    source_symbol_id: ownerId,
                    source_anchor: sourceAnchor,
                    target_symbol_id: edge.target_id,
                    target_anchor: { kind: "param", name: calleeParams[index] },
                    flow_kind: "value",
                    file: filePath,
                    line: event.line,
                    confidence: edge.confidence,
                    origin: edge.origin || "resolved",
                    evidence_json: JSON.stringify({
                        kind: "arg_pass",
                        owner_key: event.owner_key,
                        callee_name: edge.target_name,
                        arg_index: index,
                    }),
                });
            }
            if (event.result_target) {
                store.insertFlowFact({
                    source_symbol_id: edge.target_id,
                    source_anchor: { kind: "return" },
                    target_symbol_id: ownerId,
                    target_anchor: normalizeAnchor(event.result_target),
                    flow_kind: "value",
                    file: filePath,
                    line: event.line,
                    confidence: edge.confidence,
                    origin: edge.origin || "resolved",
                    evidence_json: JSON.stringify({
                        kind: "return_to_call_result",
                        owner_key: event.owner_key,
                        callee_name: edge.target_name,
                    }),
                });
            }
        }
    }
}

function getParamNames(signature, cache) {
    if (!signature) return [];
    if (!cache.has(signature)) cache.set(signature, extractParamNames(signature));
    return cache.get(signature);
}


function materializeDependencyTarget(store, workspace, resolution, language) {
    if (resolution.target_module_key || resolution.target_package_key) {
        return {
            target_module_id: resolution.target_module_key ? workspace.moduleIds.get(resolution.target_module_key) ?? null : null,
            target_package_id: resolution.target_package_key ? workspace.packageIds.get(resolution.target_package_key) ?? null : null,
        };
    }

    if (resolution.resolution !== "external" || !resolution.import_source) {
        return {
            target_module_id: null,
            target_package_id: null,
        };
    }

    const packageKey = `external:${language}:${resolution.import_source}`;
    const moduleKey = `external-module:${language}:${resolution.import_source}`;
    const pkg = store.ensurePackage({
        package_key: packageKey,
        name: resolution.import_source,
        language,
        root_path: resolution.import_source,
        is_external: 1,
    });
    const mod = store.ensureWorkspaceModule({
        module_key: moduleKey,
        package_id: pkg.id,
        name: resolution.import_source,
        language,
        root_path: resolution.import_source,
        is_external: 1,
    });
    workspace.packageIds.set(packageKey, pkg.id);
    workspace.moduleIds.set(moduleKey, mod.id);

    return {
        target_module_id: mod.id,
        target_package_id: pkg.id,
    };
}

function resolveTypeTarget(name, filePath, localSymbols, importedSymbols, store) {
    if (localSymbols.has(name) && localSymbols.get(name) != null) {
        const node = store.getNodeById(localSymbols.get(name));
        if (node && (node.kind === "class" || node.kind === "interface")) {
            return { ...node, confidence: "exact" };
        }
    }
    if (importedSymbols.has(name)) {
        const node = store.getNodeById(importedSymbols.get(name));
        if (node && (node.kind === "class" || node.kind === "interface")) {
            return { ...node, confidence: "exact" };
        }
    }
    return null;
}

function persistCloneData(store, definitions, nodeIds) {
    for (const def of definitions) {
        if (!def.clone_data) continue;
        const nodeId = nodeIds.get(def.key);
        if (!nodeId) continue;

        store.insertCloneBlock({
            node_id: nodeId,
            raw_hash: def.clone_data.raw_hash,
            norm_hash: def.clone_data.norm_hash,
            fingerprint: def.clone_data.fingerprint,
            stmt_count: def.clone_data.stmt_count,
            token_count: def.clone_data.token_count,
        });

        for (const band of def.clone_data.bands) {
            store.insertLshBand({
                band_id: band.bandId,
                bucket_hash: band.bucketHash,
                node_id: nodeId,
            });
        }
    }
}

function discoverSourceFiles(projectPath, allowedExts) {
    const results = [];
    for (const relPath of listProjectFiles(projectPath)) {
        const ext = extname(relPath).toLowerCase();
        if (!allowedExts.has(ext)) continue;

        const fullPath = resolve(projectPath, relPath);
        let stat;
        try {
            stat = statSync(fullPath);
        } catch {
            continue;
        }

        if (stat.size > MAX_FILE_SIZE || stat.size === 0) continue;
        results.push({ relPath, fullPath, mtime: stat.mtimeMs, language: languageFor(ext) });
    }
    return results;
}

function findEnclosingDefinition(line, definitions) {
    // Find the definition that contains this line
    let best = null;
    for (const def of definitions) {
        if (def.line_start <= line && def.line_end >= line) {
            // Prefer the most specific (innermost) definition
            if (!best || def.line_start > best.line_start) {
                best = def;
            }
        }
    }
    return best;
}
