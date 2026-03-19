#!/usr/bin/env node
/**
 * Code Quality Hook (PostToolUse on Edit|Write)
 *
 * Checks code quality after file modifications.
 * Exit code 2 = feedback to Claude (violations found)
 * Exit code 0 = clean
 *
 * Checks from code-quality-checker skill:
 * - KISS: function complexity, too many parameters
 * - DRY: duplicate code patterns (basic detection)
 * - YAGNI: unused imports, commented code blocks
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

// File extensions to check
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.cs']);

// Files to skip
const SKIP_PATTERNS = [
  /\.min\./,
  /\.d\.ts$/,
  /node_modules/,
  /__pycache__/,
  /\.test\./,
  /\.spec\./,
];

// Thresholds
const MAX_FUNCTION_LINES = 50;
const MAX_FUNCTION_PARAMS = 5;
const MAX_FILE_LINES = 500;
const DUPLICATE_THRESHOLD = 8; // consecutive identical lines


function shouldCheckFile(filepath) {
  if (!filepath) return false;

  const ext = extname(filepath).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) return false;

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(filepath)) return false;
  }

  return true;
}


function readFile(filepath) {
  try {
    return readFileSync(filepath, 'utf8');
  } catch {
    return null;
  }
}


function checkFunctionComplexity(content, filepath) {
  const violations = [];

  if (filepath.endsWith('.py')) {
    // Match def function_name(params):
    const pattern = /^(\s*)def\s+(\w+)\s*\(([^)]*)\).*?(?=\n\1(?:def |class |\S)|\Z)/gms;
    for (const match of content.matchAll(pattern)) {
      const funcName = match[2];
      const params = match[3];
      const funcBody = match[0];

      // Count lines
      const lines = (funcBody.match(/\n/g) || []).length;
      if (lines > MAX_FUNCTION_LINES) {
        violations.push(
          `KISS: Function '${funcName}' has ${lines} lines (max ${MAX_FUNCTION_LINES})`
        );
      }

      // Count parameters
      const paramCount = params
        .split(',')
        .map(p => p.trim())
        .filter(p => p && p !== 'self').length;
      if (paramCount > MAX_FUNCTION_PARAMS) {
        violations.push(
          `KISS: Function '${funcName}' has ${paramCount} parameters (max ${MAX_FUNCTION_PARAMS})`
        );
      }
    }

  } else if (/\.(ts|tsx|js|jsx)$/.test(filepath)) {
    // Match function declarations and arrow functions
    const patterns = [
      /(?:function|const|let|var)\s+(\w+)\s*[=:]?\s*(?:async\s*)?\(?([^)]*)\)?.*?\{/g,
      /(\w+)\s*:\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|\{)/g,
    ];

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const funcName = match[1];
        const params = match[2] || '';

        const paramCount = params
          .split(',')
          .map(p => p.trim())
          .filter(p => p).length;
        if (paramCount > MAX_FUNCTION_PARAMS) {
          violations.push(
            `KISS: Function '${funcName}' has ${paramCount} parameters (max ${MAX_FUNCTION_PARAMS})`
          );
        }
      }
    }

  } else if (filepath.endsWith('.cs')) {
    const pattern = /(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)/g;
    for (const match of content.matchAll(pattern)) {
      const methodName = match[1];
      const params = match[2];

      const paramCount = params
        .split(',')
        .map(p => p.trim())
        .filter(p => p).length;
      if (paramCount > MAX_FUNCTION_PARAMS) {
        violations.push(
          `KISS: Method '${methodName}' has ${paramCount} parameters (max ${MAX_FUNCTION_PARAMS})`
        );
      }
    }
  }

  return violations;
}


function checkDuplicateCode(content) {
  const violations = [];
  const lines = content.split('\n');

  // Skip if file too small
  if (lines.length < DUPLICATE_THRESHOLD * 2) return violations;

  // Simple duplicate detection: look for repeated line sequences
  const seenBlocks = new Map();
  let i = 0;
  while (i < lines.length - DUPLICATE_THRESHOLD) {
    const block = lines.slice(i, i + DUPLICATE_THRESHOLD).join('\n');
    // Skip empty or whitespace-only blocks
    if (block.trim()) {
      const normalized = block.trim().replace(/\s+/g, ' ');
      if (seenBlocks.has(normalized)) {
        violations.push(
          `DRY: Duplicate code block (${DUPLICATE_THRESHOLD}+ lines) at lines ${seenBlocks.get(normalized)} and ${i + 1}`
        );
      } else {
        seenBlocks.set(normalized, i + 1);
      }
    }
    i += 1;
  }

  return violations.slice(0, 3); // Limit to 3 violations
}


function checkYagni(content, _filepath) {
  const violations = [];

  // Large commented code blocks
  const commentBlockPattern = /(?:^\s*(?:\/\/|#).*\n){10,}/gm;
  const matches = [...content.matchAll(commentBlockPattern)];
  if (matches.length > 0) {
    violations.push(
      `YAGNI: Large commented code block detected (${matches.length} blocks). Remove dead code.`
    );
  }

  // TODO/FIXME without action
  const todoMatches = [...content.matchAll(/\b(TODO|FIXME|HACK|XXX)\b/gi)];
  if (todoMatches.length > 5) {
    violations.push(
      `YAGNI: ${todoMatches.length} TODO/FIXME comments. Address or remove stale items.`
    );
  }

  return violations;
}


function checkFileSize(content) {
  const violations = [];
  const lines = (content.match(/\n/g) || []).length + 1;

  if (lines > MAX_FILE_LINES) {
    violations.push(
      `KISS: File has ${lines} lines (consider splitting, max recommended ${MAX_FILE_LINES})`
    );
  }

  return violations;
}


function main() {
  // Read hook input from stdin
  let inputData;
  try {
    inputData = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  // Get the file path from tool input
  const toolInput = inputData.tool_input || {};
  const filepath = toolInput.file_path || '';

  // Check if we should analyze this file
  if (!shouldCheckFile(filepath)) {
    process.exit(0);
  }

  // Read file content
  const content = readFile(filepath);
  if (!content) {
    process.exit(0);
  }

  // Run all checks
  const allViolations = [
    ...checkFunctionComplexity(content, filepath),
    ...checkDuplicateCode(content),
    ...checkYagni(content, filepath),
    ...checkFileSize(content),
  ];

  // Report violations
  if (allViolations.length > 0) {
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write('CODE QUALITY ISSUES DETECTED\n');
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write(`\nFile: ${filepath}\n`);
    process.stderr.write(`Issues: ${allViolations.length}\n\n`);

    const limited = allViolations.slice(0, 10);
    for (let i = 0; i < limited.length; i++) {
      process.stderr.write(`  ${i + 1}. ${limited[i]}\n`);
    }

    process.stderr.write('\n' + '-'.repeat(60) + '\n');
    process.stderr.write('Consider refactoring to improve code quality.\n');
    process.stderr.write('='.repeat(60) + '\n');

    process.exit(2); // Feedback to Claude
  }

  process.exit(0);
}

main();
