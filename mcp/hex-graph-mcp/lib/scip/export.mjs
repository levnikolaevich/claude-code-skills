import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { create, toBinary } from "@bufbuild/protobuf";
import ts from "typescript";

import { resolveStore } from "../store.mjs";
import { exportExternalScip, exportToolInfo } from "./external.mjs";
import { defaultPositionEncodingForLanguage, normalizeScipLanguage } from "./languages.mjs";
import {
    isDeclarationName,
    isTypePosition,
    isTypeScriptFile,
    loadProgram,
    mapDeclarationToNode,
    pickDeclaration,
    relativeProjectPath,
    resolveSymbol,
    sourceFileInsideProject,
} from "./project.mjs";
import { enclosingRangeForDefinition, enclosingRangeForReference, rangeFromNode } from "./range.mjs";
import { buildScipSymbolForNode, buildScipSymbolString, inferPackageIdentity, languageIdForFile, symbolKindForNode } from "./symbols.mjs";
import {
    DocumentSchema,
    Descriptor_Suffix,
    IndexSchema,
    MetadataSchema,
    OccurrenceSchema,
    ProtocolVersion,
    RelationshipSchema,
    SymbolInformationSchema,
    SymbolRole,
    SyntaxKind,
    TextEncoding,
    ToolInfoSchema,
} from "./vendor/scip_pb.js";

function syntaxKindForOccurrence(node, targetNode, isDefinition) {
    if (isDefinition) {
        if (targetNode.kind === "function" || targetNode.kind === "method") return SyntaxKind.IdentifierFunctionDefinition;
        if (targetNode.kind === "class" || targetNode.kind === "interface") return SyntaxKind.IdentifierType;
        return SyntaxKind.Identifier;
    }
    if (targetNode.kind === "class" || targetNode.kind === "interface") return SyntaxKind.IdentifierType;
    return SyntaxKind.Identifier;
}

function isWriteReference(node) {
    const subject = ts.isPropertyAccessExpression(node) ? node.name : node;
    const parent = subject?.parent;
    if (!parent) return false;
    if (ts.isBinaryExpression(parent) && parent.left === subject) {
        return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    }
    return ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent);
}

function occurrenceRoles(node, isDefinition) {
    if (isDefinition) return SymbolRole.Definition;
    if (isTypePosition(node)) return 0;
    if (isWriteReference(node)) return SymbolRole.WriteAccess;
    return SymbolRole.ReadAccess;
}

function makeRelationship(kind, symbol) {
    if (!symbol) return null;
    if (kind === "overrides") {
        return create(RelationshipSchema, {
            symbol,
            isImplementation: true,
            isReference: true,
        });
    }
    if (kind === "implements" || kind === "extends") {
        return create(RelationshipSchema, {
            symbol,
            isImplementation: true,
        });
    }
    return null;
}

function collectRelationships(store, node, symbolByNodeId) {
    const outgoing = store.edgesFrom(node.id)
        .filter(edge => edge.layer === "type" && (edge.kind === "implements" || edge.kind === "extends" || edge.kind === "overrides"));
    const relationships = [];
    for (const edge of outgoing) {
        const relationship = makeRelationship(edge.kind, symbolByNodeId.get(edge.target_id)?.symbol || null);
        if (relationship) relationships.push(relationship);
    }
    return relationships;
}

function addOccurrence(documentState, occurrence) {
    const key = JSON.stringify([occurrence.symbol, occurrence.symbolRoles, occurrence.range, occurrence.enclosingRange]);
    if (documentState.occurrenceKeys.has(key)) return;
    documentState.occurrenceKeys.add(key);
    documentState.occurrences.push(occurrence);
}

function addSymbolInfo(documentState, symbol, info) {
    if (documentState.symbolInfos.has(symbol)) return;
    documentState.symbolInfos.set(symbol, info);
}

function listIndexedTsFiles(store) {
    return store.allFilePaths().filter(isTypeScriptFile);
}

async function exportTypeScriptScip({ path: projectPath, outputPath, includeExternalSymbols = true }) {
    const absoluteProjectPath = resolve(projectPath);
    const store = resolveStore(absoluteProjectPath);
    if (!store) {
        throw new Error("Project is not indexed. Run index_project before export_scip.");
    }
    const sourceFiles = listIndexedTsFiles(store);
    if (sourceFiles.length === 0) {
        throw new Error("No indexed TypeScript or JavaScript files found for SCIP export.");
    }

    const program = loadProgram(absoluteProjectPath, sourceFiles);
    const checker = program.getTypeChecker();
    const lookupCache = new Map();
    const packageCache = new Map();
    const symbolByNodeId = new Map();
    const documents = [];
    const externalSymbols = [];
    const externalSymbolKeys = new Set();

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile || !sourceFileInsideProject(sourceFile, absoluteProjectPath)) continue;
        if (!isTypeScriptFile(sourceFile.fileName)) continue;
        const relFile = relativeProjectPath(absoluteProjectPath, sourceFile.fileName);
        if (relFile.startsWith("..")) continue;

        const documentState = {
            occurrenceKeys: new Set(),
            occurrences: [],
            symbolInfos: new Map(),
            definitionNodes: new Map(),
        };

        const visit = (node) => {
            if (!ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name))) {
                ts.forEachChild(node, visit);
                return;
            }
            const symbolNode = ts.isPropertyAccessExpression(node) ? node.name : node;
            const targetSymbol = resolveSymbol(checker, symbolNode);
            const targetDeclaration = pickDeclaration(targetSymbol);
            const targetNode = mapDeclarationToNode(store, absoluteProjectPath, lookupCache, targetDeclaration);
            if (!targetNode) {
                if (includeExternalSymbols && targetSymbol && targetDeclaration?.getSourceFile()?.isDeclarationFile) {
                    const externalKey = `${targetSymbol.name}:${targetDeclaration.getSourceFile().fileName}`;
                    if (!externalSymbolKeys.has(externalKey)) {
                        externalSymbolKeys.add(externalKey);
                        const packageIdentity = inferPackageIdentity(absoluteProjectPath, targetDeclaration.getSourceFile().fileName, packageCache);
                        externalSymbols.push(create(SymbolInformationSchema, {
                            symbol: buildScipSymbolString({
                                packageIdentity,
                                descriptors: [{ name: targetSymbol.name, suffix: Descriptor_Suffix.Term, disambiguator: "" }],
                            }),
                            displayName: targetSymbol.name,
                            kind: symbolKindForNode({ kind: "function" }),
                        }));
                    }
                }
                ts.forEachChild(node, visit);
                return;
            }

            const symbolRecord = symbolByNodeId.get(targetNode.id) || buildScipSymbolForNode(store, targetNode, {
                projectPath: absoluteProjectPath,
                packageCache,
            });
            symbolByNodeId.set(targetNode.id, symbolRecord);
            const isDefinition = isDeclarationName(symbolNode);
            const occurrence = create(OccurrenceSchema, {
                range: rangeFromNode(sourceFile, symbolNode),
                symbol: symbolRecord.symbol,
                symbolRoles: occurrenceRoles(symbolNode, isDefinition),
                syntaxKind: syntaxKindForOccurrence(symbolNode, targetNode, isDefinition),
                enclosingRange: isDefinition
                    ? enclosingRangeForDefinition(sourceFile, targetDeclaration || symbolNode.parent)
                    : enclosingRangeForReference(sourceFile, node),
            });
            addOccurrence(documentState, occurrence);

            if (isDefinition) {
                addSymbolInfo(documentState, symbolRecord.symbol, create(SymbolInformationSchema, {
                    symbol: symbolRecord.symbol,
                    displayName: targetNode.name,
                    kind: symbolKindForNode(targetNode),
                    relationships: collectRelationships(store, targetNode, symbolByNodeId),
                }));
                documentState.definitionNodes.set(symbolRecord.symbol, targetNode);
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);

        for (const [symbol, info] of documentState.symbolInfos.entries()) {
            const nativeNode = documentState.definitionNodes.get(symbol);
            if (!nativeNode) continue;
            info.relationships = collectRelationships(store, nativeNode, symbolByNodeId);
        }

        documents.push(create(DocumentSchema, {
            language: languageIdForFile(relFile),
            relativePath: relFile,
            occurrences: documentState.occurrences.sort((left, right) => {
                const leftKey = left.range.join(":");
                const rightKey = right.range.join(":");
                return leftKey.localeCompare(rightKey) || left.symbol.localeCompare(right.symbol);
            }),
            symbols: [...documentState.symbolInfos.values()].sort((left, right) => left.symbol.localeCompare(right.symbol)),
            positionEncoding: defaultPositionEncodingForLanguage(documentState.occurrences.length > 0 ? languageIdForFile(relFile) : "typescript"),
        }));
    }

    const rootPackage = inferPackageIdentity(absoluteProjectPath, sourceFiles[0], packageCache);
    const toolInfo = exportToolInfo();
    const artifact = create(IndexSchema, {
        metadata: create(MetadataSchema, {
            version: ProtocolVersion.UnspecifiedProtocolVersion,
            toolInfo: create(ToolInfoSchema, {
                name: toolInfo.name,
                version: toolInfo.version,
                arguments: ["export_scip"],
            }),
            projectRoot: pathToFileURL(absoluteProjectPath).href,
            textDocumentEncoding: TextEncoding.UTF8,
        }),
        documents,
        externalSymbols,
    });

    const absoluteOutputPath = resolve(absoluteProjectPath, outputPath);
    mkdirSync(dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, toBinary(IndexSchema, artifact));

    return {
        artifact_path: absoluteOutputPath,
        document_count: documents.length,
        occurrence_count: documents.reduce((total, document) => total + document.occurrences.length, 0),
        symbol_count: documents.reduce((total, document) => total + document.symbols.length, 0),
        external_symbol_count: externalSymbols.length,
        package: rootPackage,
        artifact_languages: [...new Set(documents.map(document => normalizeScipLanguage(document.language)).filter(Boolean))],
    };
}

export async function exportScip({
    path: projectPath,
    outputPath,
    language = "typescript",
    includeExternalSymbols = true,
    projectName = null,
    projectNamespace = null,
    targetOnly = null,
    environmentPath = null,
    workingDirectory = null,
}) {
    const normalizedLanguage = normalizeScipLanguage(language);
    if (normalizedLanguage === "typescript" || normalizedLanguage === "javascript") {
        return exportTypeScriptScip({
            path: projectPath,
            outputPath,
            includeExternalSymbols,
        });
    }
    return exportExternalScip({
        language: normalizedLanguage,
        path: projectPath,
        outputPath,
        options: {
            projectName,
            projectNamespace,
            targetOnly,
            environmentPath,
            workingDirectory,
        },
    });
}
