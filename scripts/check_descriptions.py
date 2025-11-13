#!/usr/bin/env python3
"""Check SKILL.md frontmatter descriptions are < 200 chars"""

import re
from pathlib import Path

def extract_description(skill_md_path):
    """Extract description from SKILL.md frontmatter"""
    with open(skill_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match YAML frontmatter description
    match = re.search(r'^description:\s*(.+?)(?=\n\w+:|^---)', content, re.MULTILINE | re.DOTALL)
    if match:
        desc = match.group(1).strip()
        # Remove quotes if present
        desc = desc.strip('"').strip("'")
        return desc
    return None

def main():
    skills_dir = Path(__file__).parent.parent
    skill_files = sorted(skills_dir.glob('x-*/SKILL.md'))

    print(f"Checking {len(skill_files)} SKILL.md files...\n")

    violations = []
    ok = []

    for skill_file in skill_files:
        skill_name = skill_file.parent.name
        desc = extract_description(skill_file)

        if desc:
            length = len(desc)
            if length > 200:
                violations.append((skill_name, length, desc))
            else:
                ok.append((skill_name, length, desc))
        else:
            print(f"WARNING: No description found in {skill_name}/SKILL.md")

    # Print OK files
    print("=" * 80)
    print(f"OK ({len(ok)} files, < 200 chars):")
    print("=" * 80)
    for name, length, desc in ok:
        print(f"{name:30s} {length:3d} chars")

    # Print violations
    if violations:
        print("\n" + "=" * 80)
        print(f"VIOLATIONS ({len(violations)} files, > 200 chars):")
        print("=" * 80)
        for name, length, desc in violations:
            over = length - 200
            print(f"\n{name:30s} {length:3d} chars (+{over} OVER LIMIT)")
            print(f"  {desc[:100]}...")
    else:
        print(f"\nAll {len(ok)} files have descriptions < 200 chars!")

    print(f"\nSummary: {len(ok)} OK, {len(violations)} violations")
    return len(violations)

if __name__ == '__main__':
    exit(main())
