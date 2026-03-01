#!/usr/bin/env python3
"""
Story Validator Hook (UserPromptSubmit)

Validates Story structure before execution (ln-401, ln-404).
Exit code 2 = hard block (invalid Story)
Exit code 0 = allow (valid or not a Story execution request)
"""

import json
import os
import re
import sys
from pathlib import Path

# Patterns that trigger Story validation
TRIGGER_PATTERNS = [
    r'\bln-401\b',
    r'\bln-404\b',
    r'(?i)execute\s+story',
    r'(?i)run\s+story',
    r'(?i)start\s+story',
]

# Required Story sections
REQUIRED_SECTIONS = [
    'Overview',
    'Context',
    'Requirements',
    'Technical Notes',
    'Acceptance Criteria',
    'Dependencies',
    'Risks',
    'Metadata',
]

# Subsections to check
REQUIRED_SUBSECTIONS = {
    'Technical Notes': ['Standards Research'],
    'Acceptance Criteria': ['Verification'],
}


def should_validate(prompt):
    """Check if prompt triggers Story validation."""
    for pattern in TRIGGER_PATTERNS:
        if re.search(pattern, prompt):
            return True
    return False


def find_kanban_board():
    """Find kanban_board.md in the project."""
    cwd = Path.cwd()

    # Try common locations
    candidates = [
        cwd / 'docs' / 'tasks' / 'kanban_board.md',
        cwd / 'kanban_board.md',
        cwd / '.claude' / 'kanban_board.md',
    ]

    for path in candidates:
        if path.exists():
            return path

    return None


def extract_current_story(kanban_content):
    """Extract current Story identifier from kanban board."""
    # Look for "Current Story:" or "In Progress:" patterns
    patterns = [
        r'(?i)current\s+story[:\s]+(\S+-\d+)',
        r'(?i)in\s+progress[:\s]+(\S+-\d+)',
        r'(?i)executing[:\s]+(\S+-\d+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, kanban_content)
        if match:
            return match.group(1)

    return None


def find_story_document(story_id):
    """Find Story document file."""
    cwd = Path.cwd()

    # Try common patterns
    patterns = [
        f'docs/stories/{story_id}.md',
        f'docs/stories/*{story_id}*.md',
        f'.claude/stories/{story_id}.md',
    ]

    for pattern in patterns:
        matches = list(cwd.glob(pattern))
        if matches:
            return matches[0]

    return None


def validate_story_structure(content):
    """Validate Story document structure. Returns (valid, violations)."""
    violations = []
    content_lower = content.lower()

    # Check required sections
    for section in REQUIRED_SECTIONS:
        # Look for markdown headers
        pattern = rf'^#{1,3}\s*{re.escape(section)}'
        if not re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            violations.append(f"Missing section: {section}")

    # Check required subsections
    for parent, subsections in REQUIRED_SUBSECTIONS.items():
        for subsection in subsections:
            pattern = rf'^#{2,4}\s*{re.escape(subsection)}'
            if not re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
                violations.append(f"Missing subsection: {subsection} (in {parent})")

    # Check for empty sections (header followed by another header or EOF)
    empty_section_pattern = r'^(#{1,3}\s+[^\n]+)\n\s*(?=#{1,3}\s|\Z)'
    empty_matches = re.findall(empty_section_pattern, content, re.MULTILINE)
    for match in empty_matches:
        section_name = match.strip('#').strip()
        if section_name in REQUIRED_SECTIONS:
            violations.append(f"Empty section: {section_name}")

    # Check Acceptance Criteria has at least one criterion
    ac_pattern = r'(?i)#{1,3}\s*Acceptance\s+Criteria\s*\n(.*?)(?=\n#{1,3}\s|\Z)'
    ac_match = re.search(ac_pattern, content, re.DOTALL)
    if ac_match:
        ac_content = ac_match.group(1)
        # Should have bullet points or numbered items
        if not re.search(r'[-*\d]\s+', ac_content):
            violations.append("Acceptance Criteria has no criteria items")

    return len(violations) == 0, violations


def calculate_penalty_points(violations):
    """Calculate penalty points based on violations."""
    # Each violation = 1 penalty point
    return len(violations)


def main():
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # No input, allow

    # Get the user's prompt
    prompt = input_data.get('prompt', '')

    # Check if this triggers Story validation
    if not should_validate(prompt):
        sys.exit(0)  # Not a Story execution, allow

    # Find kanban board
    kanban_path = find_kanban_board()
    if not kanban_path:
        # No kanban board, provide context but allow
        print("Story validation: No kanban_board.md found. Proceeding without validation.")
        sys.exit(0)

    # Read kanban content
    try:
        kanban_content = kanban_path.read_text(encoding='utf-8')
    except Exception:
        sys.exit(0)  # Can't read, allow

    # Extract current Story
    story_id = extract_current_story(kanban_content)
    if not story_id:
        print("Story validation: No current Story found in kanban_board.md.")
        sys.exit(0)

    # Find Story document
    story_path = find_story_document(story_id)
    if not story_path:
        print(f"Story validation: Story document not found for {story_id}.")
        sys.exit(0)

    # Read and validate Story
    try:
        story_content = story_path.read_text(encoding='utf-8')
    except Exception:
        sys.exit(0)

    valid, violations = validate_story_structure(story_content)
    penalty_points = calculate_penalty_points(violations)

    if not valid:
        print("=" * 60, file=sys.stderr)
        print("STORY VALIDATION FAILED - EXECUTION BLOCKED", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(f"\nStory: {story_id}", file=sys.stderr)
        print(f"Penalty Points: {penalty_points}", file=sys.stderr)
        print(f"\nViolations ({len(violations)}):\n", file=sys.stderr)

        for i, violation in enumerate(violations, 1):
            print(f"  {i}. {violation}", file=sys.stderr)

        print("\n" + "-" * 60, file=sys.stderr)
        print("Fix these Story structure issues before proceeding.", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        sys.exit(2)  # Hard block

    # Valid Story
    print(f"Story validated: {story_id} (0 penalty points)")
    sys.exit(0)


if __name__ == '__main__':
    main()
