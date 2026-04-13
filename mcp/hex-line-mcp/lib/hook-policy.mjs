export const BINARY_EXT = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico",
    ".pdf", ".ipynb",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".exe", ".dll", ".so", ".dylib", ".wasm",
    ".mp3", ".mp4", ".wav", ".avi", ".mkv",
    ".ttf", ".otf", ".woff", ".woff2",
]);

export const OUTLINEABLE_EXT = new Set([
    ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx",
    ".py", ".cs", ".php",
    ".md", ".mdx",
]);

export const REVERSE_TOOL_HINTS = {
    "mcp__hex-line__read_file": "Read (file_path, offset, limit)",
    "mcp__hex-line__edit_file": "Edit (old_string, new_string, replace_all)",
    "mcp__hex-line__write_file": "Write (file_path, content)",
    "mcp__hex-line__grep_search": "Grep (pattern, path)",
    "mcp__hex-line__inspect_path": "Glob (pattern, path) / Path info / tree / Bash(ls,stat)",
    "mcp__hex-line__outline": "Read with offset/limit",
    "mcp__hex-line__verify": "Read (check checksum/revision freshness before follow-up edits)",
    "mcp__hex-line__changes": "Bash(git diff)",
    "mcp__hex-line__bulk_replace": "Edit (text rename/refactor across files inside an explicit root path)",
};

export const TOOL_HINTS = {
    Read: "mcp__hex-line__read_file (not Read). For structure-first: mcp__hex-line__outline then mcp__hex-line__read_file with ranges",
    Edit: "mcp__hex-line__edit_file (not Edit). If you need hash anchors: mcp__hex-line__grep_search(output='content', edit_ready=true) first",
    Write: "mcp__hex-line__write_file (not Write). No prior Read needed",
    Grep: "mcp__hex-line__grep_search (not Grep). Params: output, literal, context_before, context_after, multiline",
    Glob: "mcp__hex-line__inspect_path (not Glob). Use pattern=... with an explicit path for project file discovery and name/path globbing",
    cat: "mcp__hex-line__read_file (not cat/head/tail/less/more/type/Get-Content)",
    head: "mcp__hex-line__read_file with limit param (not head)",
    tail: "mcp__hex-line__read_file with offset param (not tail)",
    ls: "mcp__hex-line__inspect_path for tree or pattern search (not ls/dir/find/tree/Get-ChildItem). E.g. pattern='*-mcp' type='dir'",
    stat: "mcp__hex-line__inspect_path for compact file metadata (not stat/wc/Get-Item/file)",
    grep: "mcp__hex-line__grep_search (not grep/rg/findstr/Select-String). Params: output, literal, context_before, context_after, multiline",
    sed: "mcp__hex-line__edit_file for hash edits, or mcp__hex-line__bulk_replace with path=<project root> for text rename (not sed -i)",
    diff: "mcp__hex-line__changes (not diff). Git diff with change symbols",
    outline: "mcp__hex-line__outline (before reading large code files)",
    verify: "mcp__hex-line__verify (staleness / revision check without re-read; use before delayed same-file follow-ups)",
    changes: "mcp__hex-line__changes (git diff with change symbols)",
    bulk: "mcp__hex-line__bulk_replace with path=<project root> (multi-file search-replace)",
};

export const DEFERRED_HINT = "Run ToolSearch('+hex-line read edit') first if hex-line tools show InputValidationError.";

export const BASH_REDIRECTS = [
    { regex: /^(cat|type)\b/i, key: "cat", kind: "reader" },
    { regex: /^head\b/i, key: "head", kind: "reader" },
    { regex: /^tail\b(?!.*\s-[fF](\s|$))(?!.*\s--follow(\s|$))/i, key: "tail", kind: "reader" },
    { regex: /^(less|more)\b/i, key: "cat", kind: "reader" },
    { regex: /^(Get-Content|gc)\b/i, key: "cat", kind: "reader" },
    { regex: /^(ls|dir|tree|find)\b/i, key: "ls", kind: "list" },
    { regex: /^(Get-ChildItem|gci)\b/i, key: "ls", kind: "list" },
    { regex: /^(stat|wc)\b/i, key: "stat", kind: "meta" },
    { regex: /^(Get-Item|gi)\b/i, key: "stat", kind: "meta" },
    { regex: /^(grep|rg|findstr)\b/i, key: "grep", kind: "search" },
    { regex: /^Select-String\b/i, key: "grep", kind: "search" },
    { regex: /^sed\b.*\s-i(\s|$)/i, key: "sed", kind: "edit" },
];

export const TOOL_REDIRECT_MAP = {
    Read: "Read",
    Edit: "Edit",
    Write: "Write",
    Grep: "Grep",
    Glob: "Glob",
};

export const DANGEROUS_PATTERNS = [
    { regex: /rm\s+(-[rf]+\s+)*[/~]/, reason: "rm -rf on root/home directory" },
    { regex: /git\s+push\s+(-f|--force)/, reason: "force push can overwrite remote history" },
    { regex: /git\s+reset\s+--hard/, reason: "hard reset discards uncommitted changes" },
    { regex: /DROP\s+(TABLE|DATABASE)/i, reason: "DROP destroys data permanently" },
    { regex: /chmod\s+777/, reason: "chmod 777 removes all access restrictions" },
    { regex: /mkfs/, reason: "filesystem format destroys all data" },
    { regex: /dd\s+if=\/dev\/zero/, reason: "direct disk write destroys data" },
];

export const COMPOUND_OPERATORS = /[|]|>>?|&&|\|\||;/;

export const CMD_PATTERNS = [
    [/npm (install|ci|update|add)/i, "npm-install"],
    [/npm test|jest|vitest|mocha|pytest|cargo test/i, "test"],
    [/npm run build|tsc|webpack|vite build|cargo build/i, "build"],
    [/pip install/i, "pip-install"],
    [/git (log|diff|status)/i, "git"],
];

export const HOOK_OUTPUT_POLICY = {
    lineThreshold: 50,
    headLines: 15,
    tailLines: 15,
};

export function normalizePolicyPath(filePath) {
    if (!filePath) return "";
    let normalized = filePath.replace(/\\/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function isWithinDir(candidatePath, dirPath) {
    const candidate = normalizePolicyPath(candidatePath);
    const dir = normalizePolicyPath(dirPath);
    return !!candidate && !!dir && (candidate === dir || candidate.startsWith(`${dir}/`));
}
