import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { listProjectFiles } from "./file-discovery.mjs";

const META_FILE_NAMES = new Set([
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "pyproject.toml",
    "setup.cfg",
    "setup.py",
    "composer.json",
]);

const SOURCE_ROOT_HINTS = ["src"];
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".py", ".cs", ".php"];

export function discoverWorkspace(projectPath, sourceEntries) {
    const absPath = resolve(projectPath);
    const fileSet = new Set(sourceEntries.map(entry => entry.relPath));
    const metadataFiles = collectMetadataFiles(absPath);
    const metadataByPath = new Map(
        metadataFiles.map(relPath => [relPath, join(absPath, relPath)]),
    );

    const packages = new Map();
    const modules = new Map();
    const ownershipByFile = new Map();

    const jsConfigsByPackage = new Map();
    const jsPackagesByName = new Map();
    const pythonModuleByFile = new Map();
    const pythonFileByModule = new Map();
    const csharpNamespaceOwners = new Map();
    const phpNamespaceToFile = new Map();
    const phpPrefixes = [];

    discoverJavaScript(sourceEntries, metadataByPath, packages, modules, ownershipByFile, jsConfigsByPackage, jsPackagesByName);
    discoverPython(sourceEntries, packages, modules, ownershipByFile, pythonModuleByFile, pythonFileByModule, fileSet);
    discoverCSharp(sourceEntries, metadataByPath, packages, modules, ownershipByFile, csharpNamespaceOwners);
    discoverPhp(sourceEntries, metadataByPath, packages, modules, ownershipByFile, phpNamespaceToFile, phpPrefixes);
    assignFallbackOwnership(sourceEntries, packages, modules, ownershipByFile);

    return {
        packages,
        modules,
        ownershipByFile,
        resolveImport(filePath, imp, language) {
            if (!imp?.source) {
                return { resolution: "unresolved", reason: "missing_import_source", targetFile: null };
            }
            if (language === "javascript" || language === "typescript" || language === "tsx") {
                return resolveJavaScriptImport(filePath, imp, ownershipByFile, jsConfigsByPackage, jsPackagesByName, fileSet);
            }
            if (language === "python") {
                return resolvePythonImport(filePath, imp, ownershipByFile, pythonModuleByFile, pythonFileByModule);
            }
            if (language === "c_sharp") {
                return resolveCSharpImport(imp, ownershipByFile, csharpNamespaceOwners);
            }
            if (language === "php") {
                return resolvePhpImport(imp, ownershipByFile, phpNamespaceToFile, phpPrefixes);
            }
            return { resolution: "unresolved", reason: "unsupported_language_resolver", targetFile: null };
        },
    };
}

export function persistWorkspace(store, workspace) {
    const packageIds = new Map();
    const moduleIds = new Map();

    for (const pkg of workspace.packages.values()) {
        const row = store.ensurePackage(pkg);
        packageIds.set(pkg.package_key, row.id);
    }
    for (const mod of workspace.modules.values()) {
        const row = store.ensureWorkspaceModule({
            ...mod,
            package_id: packageIds.get(mod.package_key),
        });
        moduleIds.set(mod.module_key, row.id);
    }

    const ownershipIds = new Map();
    for (const [filePath, ownership] of workspace.ownershipByFile.entries()) {
        ownershipIds.set(filePath, {
            ...ownership,
            package_id: packageIds.get(ownership.package_key) ?? null,
            workspace_module_id: moduleIds.get(ownership.module_key) ?? null,
        });
    }

    return {
        ...workspace,
        packageIds,
        moduleIds,
        ownershipIds,
    };
}

function discoverJavaScript(sourceEntries, metadataByPath, packages, modules, ownershipByFile, jsConfigsByPackage, jsPackagesByName) {
    const packageFiles = [...metadataByPath.keys()].filter(path => path.endsWith("/package.json") || path === "package.json");
    const packageRoots = packageFiles
        .map(path => dirname(path).replace(/\\/g, "/"))
        .sort((a, b) => b.length - a.length);

    for (const packageFile of packageFiles) {
        const fullPath = metadataByPath.get(packageFile);
        const pkgJson = readJsonFile(fullPath);
        if (!pkgJson) continue;
        const rootPath = normalizeDir(dirname(packageFile));
        const packageName = pkgJson.name || (rootPath === "." ? basename(dirname(fullPath)) : basename(rootPath));
        const packageKey = `js:${rootPath}`;
        ensurePackageAndModule(packages, modules, {
            package_key: packageKey,
            name: packageName,
            language: "javascript",
            root_path: rootPath,
            module_key: `js-module:${rootPath}`,
            module_name: packageName,
        });
        jsPackagesByName.set(packageName, {
            package_key: packageKey,
            module_key: `js-module:${rootPath}`,
            root_path: rootPath,
        });

        const configPath = ["tsconfig.json", "jsconfig.json"]
            .map(name => normalizeFile(join(rootPath === "." ? "" : rootPath, name)))
            .find(candidate => metadataByPath.has(candidate));
        if (configPath) {
            const config = readJsonFile(metadataByPath.get(configPath));
            const compilerOptions = config?.compilerOptions || {};
            const baseUrl = normalizeDir(join(dirname(configPath), compilerOptions.baseUrl || "."));
            const pathMappings = [];
            for (const [pattern, targets] of Object.entries(compilerOptions.paths || {})) {
                const normalizedTargets = Array.isArray(targets) ? targets : [targets];
                for (const target of normalizedTargets) {
                    pathMappings.push({
                        pattern,
                        target,
                        base_url: baseUrl,
                    });
                }
            }
            jsConfigsByPackage.set(packageKey, { base_url: baseUrl, path_mappings: pathMappings });
        }
    }

    for (const entry of sourceEntries) {
        if (!["javascript", "typescript", "tsx"].includes(entry.language)) continue;
        const rootPath = packageRoots.find(root => root === "." || entry.relPath.startsWith(`${root}/`)) || ".";
        const packageKey = `js:${rootPath}`;
        if (!packages.has(packageKey)) {
            const fallbackName = rootPath === "." ? "project" : basename(rootPath);
            ensurePackageAndModule(packages, modules, {
                package_key: packageKey,
                name: fallbackName,
                language: entry.language,
                root_path: rootPath,
                module_key: `js-module:${rootPath}`,
                module_name: fallbackName,
            });
        }
        ownershipByFile.set(entry.relPath, {
            package_key: packageKey,
            module_key: `js-module:${rootPath}`,
            language: entry.language,
        });
    }
}

function discoverPython(sourceEntries, packages, modules, ownershipByFile, pythonModuleByFile, pythonFileByModule, fileSet) {
    const packageDirs = new Set();
    for (const filePath of fileSet) {
        if (!filePath.endsWith("/__init__.py") && filePath !== "__init__.py") continue;
        packageDirs.add(normalizeDir(dirname(filePath)));
    }

    for (const entry of sourceEntries) {
        if (entry.language !== "python") continue;
        const sourceRoot = SOURCE_ROOT_HINTS.find(root => entry.relPath.startsWith(`${root}/`)) || "";
        const relToSource = sourceRoot ? entry.relPath.slice(sourceRoot.length + 1) : entry.relPath;
        const segments = relToSource.split("/");
        const topLevel = segments[0];
        const packageDir = packageDirs.has(topLevel) ? topLevel : normalizeDir(dirname(entry.relPath));
        const packageName = packageDir === "." ? basename(entry.relPath, ".py") : packageDir.split("/")[0];
        const packageKey = `py:${packageName}`;
        ensurePackageAndModule(packages, modules, {
            package_key: packageKey,
            name: packageName,
            language: "python",
            root_path: packageDir === "." ? packageName : packageDir,
            module_key: `py-module:${packageName}`,
            module_name: packageName,
        });
        ownershipByFile.set(entry.relPath, {
            package_key: packageKey,
            module_key: `py-module:${packageName}`,
            language: "python",
        });

        const modulePath = pythonModulePath(entry.relPath, sourceRoot);
        pythonModuleByFile.set(entry.relPath, modulePath);
        pythonFileByModule.set(modulePath, entry.relPath);
    }
}

function discoverCSharp(sourceEntries, metadataByPath, packages, modules, ownershipByFile, csharpNamespaceOwners) {
    const projectFiles = [...metadataByPath.keys()].filter(path => path.endsWith(".csproj"));
    const projectRoots = projectFiles
        .map(path => dirname(path).replace(/\\/g, "/"))
        .sort((a, b) => b.length - a.length);

    const projectByRoot = new Map();
    for (const projectFile of projectFiles) {
        const fullPath = metadataByPath.get(projectFile);
        const source = readTextFile(fullPath);
        const rootPath = normalizeDir(dirname(projectFile));
        const assemblyName = matchTag(source, "AssemblyName") || matchTag(source, "RootNamespace") || basename(projectFile, ".csproj");
        const packageKey = `cs:${rootPath}`;
        ensurePackageAndModule(packages, modules, {
            package_key: packageKey,
            name: assemblyName,
            language: "c_sharp",
            root_path: rootPath,
            module_key: `cs-module:${rootPath}`,
            module_name: assemblyName,
        });
        projectByRoot.set(rootPath, { package_key: packageKey, module_key: `cs-module:${rootPath}`, root_namespace: assemblyName });
    }

    for (const entry of sourceEntries) {
        if (entry.language !== "c_sharp") continue;
        const rootPath = projectRoots.find(root => root === "." || entry.relPath.startsWith(`${root}/`)) || ".";
        const project = projectByRoot.get(rootPath) || {
            package_key: `cs:${rootPath}`,
            module_key: `cs-module:${rootPath}`,
            root_namespace: basename(rootPath === "." ? "project" : rootPath),
        };
        if (!packages.has(project.package_key)) {
            ensurePackageAndModule(packages, modules, {
                package_key: project.package_key,
                name: project.root_namespace,
                language: "c_sharp",
                root_path: rootPath,
                module_key: project.module_key,
                module_name: project.root_namespace,
            });
        }
        ownershipByFile.set(entry.relPath, {
            package_key: project.package_key,
            module_key: project.module_key,
            language: "c_sharp",
        });

        const source = readTextFile(entry.fullPath);
        const namespace = source.match(/^\s*namespace\s+([A-Za-z0-9_.]+)/m)?.[1] || project.root_namespace;
        setLongestPrefix(csharpNamespaceOwners, namespace, entry.relPath);
    }
}

function discoverPhp(sourceEntries, metadataByPath, packages, modules, ownershipByFile, phpNamespaceToFile, phpPrefixes) {
    const composerFiles = [...metadataByPath.keys()].filter(path => path.endsWith("/composer.json") || path === "composer.json");
    const composerRoots = composerFiles
        .map(path => dirname(path).replace(/\\/g, "/"))
        .sort((a, b) => b.length - a.length);

    const packageByRoot = new Map();
    for (const composerFile of composerFiles) {
        const fullPath = metadataByPath.get(composerFile);
        const composer = readJsonFile(fullPath);
        if (!composer) continue;
        const rootPath = normalizeDir(dirname(composerFile));
        const packageName = composer.name || basename(rootPath === "." ? "project" : rootPath);
        const packageKey = `php:${rootPath}`;
        ensurePackageAndModule(packages, modules, {
            package_key: packageKey,
            name: packageName,
            language: "php",
            root_path: rootPath,
            module_key: `php-module:${rootPath}`,
            module_name: packageName,
        });
        packageByRoot.set(rootPath, { package_key: packageKey, module_key: `php-module:${rootPath}` });
        const psr4 = composer.autoload?.["psr-4"] || {};
        for (const [prefix, dirs] of Object.entries(psr4)) {
            const normalizedDirs = Array.isArray(dirs) ? dirs : [dirs];
            for (const dirPath of normalizedDirs) {
                phpPrefixes.push({
                    prefix,
                    root_path: normalizeDir(join(rootPath === "." ? "" : rootPath, dirPath)),
                    package_key: packageKey,
                    module_key: `php-module:${rootPath}`,
                });
            }
        }
    }

    for (const entry of sourceEntries) {
        if (entry.language !== "php") continue;
        const rootPath = composerRoots.find(root => root === "." || entry.relPath.startsWith(`${root}/`)) || ".";
        const pkg = packageByRoot.get(rootPath) || {
            package_key: `php:${rootPath}`,
            module_key: `php-module:${rootPath}`,
        };
        if (!packages.has(pkg.package_key)) {
            const fallbackName = basename(rootPath === "." ? "project" : rootPath);
            ensurePackageAndModule(packages, modules, {
                package_key: pkg.package_key,
                name: fallbackName,
                language: "php",
                root_path: rootPath,
                module_key: pkg.module_key,
                module_name: fallbackName,
            });
        }
        ownershipByFile.set(entry.relPath, {
            package_key: pkg.package_key,
            module_key: pkg.module_key,
            language: "php",
        });

        for (const prefix of phpPrefixes) {
            if (!entry.relPath.startsWith(`${prefix.root_path}/`)) continue;
            const relNamespace = entry.relPath
                .slice(prefix.root_path.length + 1)
                .replace(/\.php$/i, "")
                .split("/")
                .join("\\");
            phpNamespaceToFile.set(`${prefix.prefix}${relNamespace}`, entry.relPath);
        }
    }
}

function assignFallbackOwnership(sourceEntries, packages, modules, ownershipByFile) {
    for (const entry of sourceEntries) {
        if (ownershipByFile.has(entry.relPath)) continue;
        const packageKey = `generic:${entry.language}`;
        ensurePackageAndModule(packages, modules, {
            package_key: packageKey,
            name: entry.language,
            language: entry.language,
            root_path: ".",
            module_key: `generic-module:${entry.language}`,
            module_name: entry.language,
        });
        ownershipByFile.set(entry.relPath, {
            package_key: packageKey,
            module_key: `generic-module:${entry.language}`,
            language: entry.language,
        });
    }
}

function resolveJavaScriptImport(filePath, imp, ownershipByFile, jsConfigsByPackage, jsPackagesByName, fileSet) {
    const owner = ownershipByFile.get(filePath);
    const importSource = imp.source;
    if (importSource.startsWith(".") || importSource.startsWith("/")) {
        const targetFile = resolveRelativeFile(filePath, importSource, fileSet);
        return buildInternalResolution(targetFile, importSource, ownershipByFile, targetFile ? "workspace_resolved" : "unresolved");
    }

    if (owner) {
        const config = jsConfigsByPackage.get(owner.package_key);
        const aliasTarget = resolvePathAlias(importSource, config, fileSet);
        if (aliasTarget) {
            return buildInternalResolution(aliasTarget, importSource, ownershipByFile, "workspace_resolved");
        }
    }

    const workspacePackage = resolveWorkspacePackageImport(importSource, jsPackagesByName, fileSet);
    if (workspacePackage) {
        return buildInternalResolution(workspacePackage, importSource, ownershipByFile, "workspace_resolved");
    }

    return { resolution: "external", import_source: importSource, targetFile: null };
}

function resolvePythonImport(filePath, imp, ownershipByFile, pythonModuleByFile, pythonFileByModule) {
    const currentModule = pythonModuleByFile.get(filePath);
    if (!currentModule) {
        return { resolution: "unresolved", reason: "python_module_not_indexed", targetFile: null };
    }
    const importSource = normalizePythonModule(imp, currentModule);
    if (!importSource) {
        return { resolution: "unresolved", reason: "python_import_not_normalized", targetFile: null };
    }
    const targetFile = pythonFileByModule.get(importSource) || pythonFileByModule.get(`${importSource}.__init__`) || null;
    if (!targetFile) {
        return { resolution: "external", import_source: importSource, targetFile: null };
    }
    return buildInternalResolution(targetFile, importSource, ownershipByFile, "workspace_resolved");
}

function resolveCSharpImport(imp, ownershipByFile, csharpNamespaceOwners) {
    const namespace = imp.source;
    const targetFile = longestPrefixMatch(namespace, csharpNamespaceOwners);
    if (!targetFile) {
        return { resolution: "external", import_source: namespace, targetFile: null };
    }
    return buildInternalResolution(targetFile, namespace, ownershipByFile, "workspace_resolved");
}

function resolvePhpImport(imp, ownershipByFile, phpNamespaceToFile, phpPrefixes) {
    const namespace = imp.specifiers?.[0]?.imported || imp.source;
    const directFile = phpNamespaceToFile.get(namespace);
    if (directFile) {
        return buildInternalResolution(directFile, namespace, ownershipByFile, "workspace_resolved");
    }
    const prefix = phpPrefixes
        .filter(candidate => namespace.startsWith(candidate.prefix))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!prefix) {
        return { resolution: "external", import_source: namespace, targetFile: null };
    }
    const remainder = namespace.slice(prefix.prefix.length).replace(/\\/g, "/");
    const targetFile = normalizeFile(join(prefix.root_path, `${remainder}.php`));
    if (!ownershipByFile.has(targetFile)) {
        return { resolution: "external", import_source: namespace, targetFile: null };
    }
    return buildInternalResolution(targetFile, namespace, ownershipByFile, "workspace_resolved");
}

function resolveWorkspacePackageImport(importSource, jsPackagesByName, fileSet) {
    for (const [packageName, target] of jsPackagesByName.entries()) {
        if (importSource !== packageName && !importSource.startsWith(`${packageName}/`)) continue;
        const remainder = importSource === packageName ? "" : importSource.slice(packageName.length + 1);
        const root = target.root_path;
        const candidates = [];
        if (!remainder) {
            candidates.push(root, join(root, "src/index"), join(root, "index"), join(root, "src"));
        } else {
            candidates.push(join(root, remainder), join(root, "src", remainder));
        }
        for (const candidate of candidates) {
            const resolved = resolveFileCandidates(normalizeFile(candidate), fileSet);
            if (resolved) return resolved;
        }
    }
    return null;
}

function resolvePathAlias(importSource, config, fileSet) {
    if (!config) return null;
    for (const mapping of config.path_mappings) {
        const captured = matchPathPattern(importSource, mapping.pattern);
        if (captured == null) continue;
        const replaced = mapping.target.replace("*", captured);
        const baseCandidate = normalizeFile(join(config.base_url, replaced));
        const resolved = resolveFileCandidates(baseCandidate, fileSet);
        if (resolved) return resolved;
    }
    return null;
}

function resolveRelativeFile(filePath, importSource, fileSet) {
    const fromDir = dirname(filePath);
    return resolveFileCandidates(normalizeFile(join(fromDir, importSource)), fileSet);
}

function resolveFileCandidates(basePath, fileSet) {
    if (fileSet.has(basePath)) return basePath;
    for (const ext of RESOLVE_EXTENSIONS) {
        if (fileSet.has(`${basePath}${ext}`)) return `${basePath}${ext}`;
    }
    for (const ext of RESOLVE_EXTENSIONS) {
        const indexCandidate = normalizeFile(join(basePath, `index${ext}`));
        if (fileSet.has(indexCandidate)) return indexCandidate;
    }
    const initCandidate = normalizeFile(join(basePath, "__init__.py"));
    if (fileSet.has(initCandidate)) return initCandidate;
    return null;
}

function normalizePythonModule(imp, currentModule) {
    const source = imp.source || "";
    const level = imp.relative_level || 0;
    if (level === 0) return source;
    const parts = currentModule.split(".");
    const base = parts.slice(0, Math.max(0, parts.length - level));
    return [...base, source].filter(Boolean).join(".");
}

function pythonModulePath(filePath, sourceRoot) {
    const stripped = sourceRoot ? filePath.slice(sourceRoot.length + 1) : filePath;
    const withoutExt = stripped.replace(/\.py$/i, "");
    if (withoutExt.endsWith("/__init__")) {
        return withoutExt.slice(0, -"__init__".length - 1).split("/").join(".");
    }
    return withoutExt.split("/").join(".");
}

function buildInternalResolution(targetFile, importSource, ownershipByFile, resolution) {
    const ownership = targetFile ? ownershipByFile.get(targetFile) : null;
    return {
        resolution,
        import_source: importSource,
        targetFile,
        target_package_key: ownership?.package_key || null,
        target_module_key: ownership?.module_key || null,
    };
}

function ensurePackageAndModule(packages, modules, item) {
    if (!packages.has(item.package_key)) {
        packages.set(item.package_key, {
            package_key: item.package_key,
            name: item.name,
            language: item.language,
            root_path: item.root_path,
            is_external: 0,
        });
    }
    if (!modules.has(item.module_key)) {
        modules.set(item.module_key, {
            module_key: item.module_key,
            package_key: item.package_key,
            name: item.module_name,
            language: item.language,
            root_path: item.root_path,
            is_external: 0,
        });
    }
}

function collectMetadataFiles(projectPath) {
    return listProjectFiles(projectPath).filter(relPath => {
        const name = basename(relPath);
        return META_FILE_NAMES.has(name) || name.endsWith(".csproj") || name === "__init__.py";
    });
}

function readJsonFile(filePath) {
    const text = readTextFile(filePath);
    if (!text) return null;
    try {
        return JSON.parse(stripJsonNoise(text));
    } catch {
        return null;
    }
}

function readTextFile(filePath) {
    try {
        return readFileSync(filePath, "utf-8");
    } catch {
        return "";
    }
}

function stripJsonNoise(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1");
}

function matchTag(text, tagName) {
    return text.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`, "i"))?.[1]?.trim() || null;
}

function matchPathPattern(value, pattern) {
    if (pattern === value) return "";
    if (!pattern.includes("*")) return null;
    const [prefix, suffix] = pattern.split("*");
    if (!value.startsWith(prefix) || !value.endsWith(suffix)) return null;
    return value.slice(prefix.length, value.length - suffix.length);
}

function longestPrefixMatch(value, mapping) {
    let match = null;
    for (const [prefix, result] of mapping.entries()) {
        if (!value.startsWith(prefix)) continue;
        if (!match || prefix.length > match.prefix.length) {
            match = { prefix, result };
        }
    }
    return match?.result || null;
}

function setLongestPrefix(mapping, prefix, result) {
    const existing = mapping.get(prefix);
    if (!existing) {
        mapping.set(prefix, result);
    }
}

function normalizeFile(filePath) {
    return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizeDir(filePath) {
    const normalized = normalizeFile(filePath);
    return normalized === "" ? "." : normalized;
}
