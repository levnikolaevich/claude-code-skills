#!/usr/bin/env node
/**
 * Story Validator Hook (UserPromptSubmit)
 *
 * Validates Story structure before execution (ln-400, ln-401).
 * Exit code 2 = hard block (invalid Story)
 * Exit code 0 = allow (valid or not a Story execution request)
 *
 * Validation criteria from ln-310-multi-agent-validator skill.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Patterns that trigger Story validation
const TRIGGER_PATTERNS = [
  /\bln-400\b/,
  /\bln-401\b/,
  /\bln-403\b/,
  /\bln-404\b/,
  /execute\s+story/i,
  /run\s+story/i,
  /start\s+story/i,
];

// Required Story sections (from ln-310)
const REQUIRED_SECTIONS = [
  'Overview',
  'Context',
  'Requirements',
  'Technical Notes',
  'Acceptance Criteria',
  'Dependencies',
  'Risks',
  'Metadata',
];

// Subsections to check
const REQUIRED_SUBSECTIONS = {
  'Technical Notes': ['Standards Research'],
  'Acceptance Criteria': ['Verification'],
};


function shouldValidate(prompt) {
  for (const pattern of TRIGGER_PATTERNS) {
    if (pattern.test(prompt)) return true;
  }
  return false;
}


function findKanbanBoard() {
  const cwd = process.cwd();

  const candidates = [
    join(cwd, 'docs', 'tasks', 'kanban_board.md'),
    join(cwd, 'kanban_board.md'),
    join(cwd, '.claude', 'kanban_board.md'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return null;
}


function extractCurrentStory(kanbanContent) {
  const patterns = [
    /current\s+story[:\s]+(\S+-\d+)/i,
    /in\s+progress[:\s]+(\S+-\d+)/i,
    /executing[:\s]+(\S+-\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = kanbanContent.match(pattern);
    if (match) return match[1];
  }

  return null;
}


function findStoryDocument(storyId) {
  const cwd = process.cwd();

  // Try exact paths first
  const exactPaths = [
    join(cwd, 'docs', 'stories', `${storyId}.md`),
    join(cwd, '.claude', 'stories', `${storyId}.md`),
  ];

  for (const p of exactPaths) {
    if (existsSync(p)) return p;
  }

  // Try directory scan for partial match
  const storiesDir = join(cwd, 'docs', 'stories');
  if (existsSync(storiesDir)) {
    try {
      const files = readdirSync(storiesDir);
      for (const file of files) {
        if (file.includes(storyId) && file.endsWith('.md')) {
          return join(storiesDir, file);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return null;
}


function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function validateStoryStructure(content) {
  const violations = [];

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^#{1,3}\\s*${escapeRegExp(section)}`, 'mi');
    if (!pattern.test(content)) {
      violations.push(`Missing section: ${section}`);
    }
  }

  // Check required subsections
  for (const [parent, subsections] of Object.entries(REQUIRED_SUBSECTIONS)) {
    for (const subsection of subsections) {
      const pattern = new RegExp(`^#{2,4}\\s*${escapeRegExp(subsection)}`, 'mi');
      if (!pattern.test(content)) {
        violations.push(`Missing subsection: ${subsection} (in ${parent})`);
      }
    }
  }

  // Check for empty sections (header followed by another header or EOF)
  const emptySectionPattern = /^(#{1,3}\s+[^\n]+)\n\s*(?=#{1,3}\s|$)/gm;
  for (const match of content.matchAll(emptySectionPattern)) {
    const sectionName = match[1].replace(/^#+\s*/, '').trim();
    if (REQUIRED_SECTIONS.includes(sectionName)) {
      violations.push(`Empty section: ${sectionName}`);
    }
  }

  // Check Acceptance Criteria has at least one criterion
  const acPattern = /#{1,3}\s*Acceptance\s+Criteria\s*\n(.*?)(?=\n#{1,3}\s|$)/si;
  const acMatch = content.match(acPattern);
  if (acMatch) {
    const acContent = acMatch[1];
    if (!(/[-*\d]\s+/).test(acContent)) {
      violations.push('Acceptance Criteria has no criteria items');
    }
  }

  return { valid: violations.length === 0, violations };
}


function calculatePenaltyPoints(violations) {
  return violations.length;
}


function main() {
  // Read hook input from stdin
  let inputData;
  try {
    inputData = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // No input, allow
  }

  // Get the user's prompt
  const prompt = inputData.prompt || '';

  // Check if this triggers Story validation
  if (!shouldValidate(prompt)) {
    process.exit(0); // Not a Story execution, allow
  }

  // Find kanban board
  const kanbanPath = findKanbanBoard();
  if (!kanbanPath) {
    process.stdout.write('Story validation: No kanban_board.md found. Proceeding without validation.\n');
    process.exit(0);
  }

  // Read kanban content
  let kanbanContent;
  try {
    kanbanContent = readFileSync(kanbanPath, 'utf8');
  } catch {
    process.exit(0); // Can't read, allow
  }

  // Extract current Story
  const storyId = extractCurrentStory(kanbanContent);
  if (!storyId) {
    process.stdout.write('Story validation: No current Story found in kanban_board.md.\n');
    process.exit(0);
  }

  // Find Story document
  const storyPath = findStoryDocument(storyId);
  if (!storyPath) {
    process.stdout.write(`Story validation: Story document not found for ${storyId}.\n`);
    process.exit(0);
  }

  // Read and validate Story
  let storyContent;
  try {
    storyContent = readFileSync(storyPath, 'utf8');
  } catch {
    process.exit(0);
  }

  const { valid, violations } = validateStoryStructure(storyContent);
  const penaltyPoints = calculatePenaltyPoints(violations);

  if (!valid) {
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write('STORY VALIDATION FAILED - EXECUTION BLOCKED\n');
    process.stderr.write('='.repeat(60) + '\n');
    process.stderr.write(`\nStory: ${storyId}\n`);
    process.stderr.write(`Penalty Points: ${penaltyPoints}\n`);
    process.stderr.write(`\nViolations (${violations.length}):\n\n`);

    for (let i = 0; i < violations.length; i++) {
      process.stderr.write(`  ${i + 1}. ${violations[i]}\n`);
    }

    process.stderr.write('\n' + '-'.repeat(60) + '\n');
    process.stderr.write('Run ln-310-multi-agent-validator to auto-fix these issues.\n');
    process.stderr.write('='.repeat(60) + '\n');

    process.exit(2); // Hard block
  }

  // Valid Story
  process.stdout.write(`Story validated: ${storyId} (0 penalty points)\n`);
  process.exit(0);
}

main();
