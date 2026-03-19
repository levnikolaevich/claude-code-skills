#!/usr/bin/env node
/**
 * Secret Scanner Hook (PreToolUse on Bash)
 *
 * Intercepts git commit/add commands and scans staged files for secrets.
 * Exit code 2 = hard block (secrets found)
 * Exit code 0 = allow (clean)
 * Exit code 1 = error (graceful continue)
 *
 * Patterns from ln-761-secret-scanner skill.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Secret patterns to detect
const SECRET_PATTERNS = [
  // AWS Access Key ID
  [/AKIA[0-9A-Z]{16}/, 'AWS Access Key ID'],
  // AWS Secret Access Key (generic 40-char base64)
  [/aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i, 'AWS Secret Access Key'],
  // Generic secrets in assignments
  [/(password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/i, 'Hardcoded password'],
  [/(secret|api_key|apikey|auth_token)\s*[:=]\s*['"][^'"]{8,}['"]/i, 'Hardcoded secret/API key'],
  // JWT tokens
  [/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/, 'JWT token'],
  // Private keys
  [/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, 'Private key'],
  // GitHub tokens
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub personal access token'],
  [/gho_[A-Za-z0-9]{36}/, 'GitHub OAuth token'],
  [/ghu_[A-Za-z0-9]{36}/, 'GitHub user token'],
  // Generic bearer tokens
  [/bearer\s+[A-Za-z0-9\-_]{20,}/i, 'Bearer token'],
  // Connection strings with passwords
  [/(mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/i, 'Database connection string with password'],
];

// Files to skip (binary, lock files, etc.)
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.tar', '.gz',
  '.lock', '.sum',
  '.min.js', '.min.css',
]);


function getStagedFiles() {
  try {
    const result = execSync(
      'git diff --cached --name-only --diff-filter=ACMR',
      { encoding: 'utf8', timeout: 10000 }
    );
    return result.trim().split('\n').filter(f => f.trim());
  } catch {
    return [];
  }
}


function shouldSkipFile(filepath) {
  const lowerPath = filepath.toLowerCase();
  for (const ext of SKIP_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) return true;
  }
  return false;
}


function getStagedContent(filepath) {
  try {
    return execSync(
      `git show :${filepath}`,
      { encoding: 'utf8', timeout: 10000 }
    );
  } catch {
    return null;
  }
}


function scanContent(content, filepath) {
  const findings = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    for (const [pattern, secretType] of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        // Mask the actual secret in output
        const maskedLine = line.length > 50 ? line.slice(0, 50) + '...' : line;
        findings.push({
          file: filepath,
          line: lineNum + 1,
          type: secretType,
          preview: maskedLine.trim(),
        });
      }
    }
  }

  return findings;
}


function main() {
  // Read hook input from stdin
  let inputData;
  try {
    inputData = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // No input, allow
  }

  // Get the command being executed
  const toolInput = inputData.tool_input || {};
  const command = toolInput.command || '';

  // Only intercept git commit and git add commands
  if (!command) {
    process.exit(0);
  }

  // Check if this is a git commit or git add
  const isGitCommit = command.includes('git commit') || command.includes('git add');
  if (!isGitCommit) {
    process.exit(0);
  }

  // Get staged files
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  // Scan each file
  const allFindings = [];
  for (const filepath of stagedFiles) {
    if (shouldSkipFile(filepath)) continue;

    const content = getStagedContent(filepath);
    if (content) {
      const findings = scanContent(content, filepath);
      allFindings.push(...findings);
    }
  }

  // If secrets found, block the operation
  if (allFindings.length > 0) {
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write('SECRETS DETECTED - COMMIT BLOCKED\n');
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write(`\nFound ${allFindings.length} potential secret(s):\n\n`);

    const limited = allFindings.slice(0, 10);
    for (const finding of limited) {
      process.stderr.write(`  [${finding.type}]\n`);
      process.stderr.write(`  File: ${finding.file}:${finding.line}\n`);
      process.stderr.write(`  Preview: ${finding.preview}\n`);
      process.stderr.write('\n');
    }

    if (allFindings.length > 10) {
      process.stderr.write(`  ... and ${allFindings.length - 10} more\n\n`);
    }

    process.stderr.write('Remove secrets before committing.\n');
    process.stderr.write('Use environment variables or .env files (gitignored).\n');
    process.stderr.write('='.repeat(60) + '\n');

    process.exit(2); // Hard block
  }

  process.exit(0); // Clean, allow
}

main();
