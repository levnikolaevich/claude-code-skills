#!/usr/bin/env python3
"""
Update all diagram.html files to use shared CSS
Replaces <style>...</style> with <link rel="stylesheet" href="../../shared/css/diagram.css">
"""

import os
import re
from pathlib import Path

# Root directory
ROOT = Path(__file__).parent

# Find all diagram.html files
html_files = list(ROOT.glob("x-*/diagram.html"))

print(f"Found {len(html_files)} diagram.html files")

updated = 0
errors = 0

for html_file in html_files:
    try:
        # Read file
        content = html_file.read_text(encoding='utf-8')

        # Check if already updated with CORRECT path
        if '../shared/css/diagram.css' in content and '../../shared/css/diagram.css' not in content:
            print(f"SKIP (already updated): {html_file.relative_to(ROOT)}")
            continue

        # Fix wrong path if exists
        if '../../shared/css/diagram.css' in content:
            content = content.replace('../../shared/css/diagram.css', '../shared/css/diagram.css')
            html_file.write_text(content, encoding='utf-8')
            print(f"FIXED PATH: {html_file.relative_to(ROOT)}")
            updated += 1
            continue

        # Find and replace <style>...</style> section
        # Pattern matches from <style> to </style> including multiline content
        pattern = r'<style>.*?</style>'

        # Replacement
        replacement = '<link rel="stylesheet" href="../shared/css/diagram.css">'

        # Check if style section exists
        if not re.search(pattern, content, re.DOTALL):
            print(f"ERROR (no <style> found): {html_file.relative_to(ROOT)}")
            errors += 1
            continue

        # Replace
        new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

        # Write back
        html_file.write_text(new_content, encoding='utf-8')

        print(f"OK: {html_file.relative_to(ROOT)}")
        updated += 1

    except Exception as e:
        print(f"ERROR: {html_file.relative_to(ROOT)} - {e}")
        errors += 1

print(f"\nSummary: {updated} updated, {errors} errors, {len(html_files) - updated - errors} skipped")
