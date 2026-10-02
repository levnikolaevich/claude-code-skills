#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
printf '__pycache__/\n' > .gitignore
mkdir -p tally tests .github/workflows
: > tally/__init__.py
: > tests/__init__.py

write_cli() {
  # $1: format choices, $2: legacy-format help, $3: legacy branch body, $4: csv branch
  cat > tally/cli.py <<PY
import argparse
import csv
import json
import sys

from tally.core import count


def main(argv=None):
    parser = argparse.ArgumentParser(prog="tally")
    parser.add_argument("path")
    parser.add_argument("--format", choices=[$1], default="text")
    parser.add_argument("--legacy-format", action="store_true", help="$2")
    args = parser.parse_args(argv)
    with open(args.path, encoding="utf-8") as handle:
        result = count(handle.read())
    if args.legacy_format:
$3
        print(result["lines"], result["words"], result["chars"])
    elif args.format == "json":
        print(json.dumps(result))
$4
    else:
        print(f"lines={result['lines']} words={result['words']} chars={result['chars']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY
}

CSV_BRANCH='    elif args.format == "csv":
        writer = csv.DictWriter(sys.stdout, fieldnames=["lines", "words", "chars"])
        writer.writeheader()
        writer.writerow(result)'
DEPRECATION='        print("warning: --legacy-format is deprecated and will be removed in 2.0; use --format text", file=sys.stderr)'

cat > pyproject.toml <<'TOML'
[project]
name = "tally"
version = "1.1.0"
description = "Count lines, words and characters in text files."
requires-python = ">=3.9"

[project.scripts]
tally = "tally.cli:main"
TOML
cat > RELEASING.md <<'MD'
# Releasing tally

- Versioning: Semantic Versioning. `version` in `pyproject.toml` is the only version field.
- Tags: annotated `vX.Y.Z` on `main`, created only after the release commit passes CI.
- Release notes: published as a GitHub Release for the tag. Group changes for users
  (Added, Fixed, Deprecated) and include upgrade instructions when behavior changes.
- Install or upgrade: `pipx install tally` / `pipx upgrade tally`.
MD
cat > README.md <<'MD'
# tally

Count lines, words and characters in text files.

```
pipx install tally
tally README.md
```

Options: `--format text|json`. Defaults may be read from `tally.yaml`.
MD
cat > .github/workflows/ci.yml <<'YML'
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: python -m unittest
YML
cat > tally/core.py <<'PY'
def count(text):
    lines = text.count("\n")
    return {"lines": lines, "words": len(text.split()), "chars": len(text)}
PY
cat > tests/test_core.py <<'PY'
import unittest

from tally.core import count


class CountTest(unittest.TestCase):
    def test_counts_words(self):
        self.assertEqual(count("a b\nc\n")["words"], 3)


if __name__ == "__main__":
    unittest.main()
PY
write_cli '"text", "json"' 'one-line output' '        pass' ''
git add -A
git commit -q -m "feat: tally CLI with text and JSON output"

# Released in 1.2.0: YAML defaults.
cat > tally/config.py <<'PY'
def load_config(path="tally.yaml"):
    """Read simple `key: value` defaults from tally.yaml when it exists."""
    try:
        with open(path, encoding="utf-8") as handle:
            pairs = (line.split(":", 1) for line in handle if ":" in line)
            return {key.strip(): value.strip() for key, value in pairs}
    except FileNotFoundError:
        return {}
PY
sed -i 's/^version = "1.1.0"/version = "1.2.0"/' pyproject.toml
git add -A
git commit -q -m "feat: read default options from tally.yaml" -m "Users can keep their preferred --format in a tally.yaml file."
git tag -a v1.2.0 -m "tally 1.2.0"

# Unreleased work after v1.2.0.
write_cli '"text", "json", "csv"' 'one-line output' '        pass' "$CSV_BRANCH"
sed -i 's/^Options: `--format text|json`/Options: `--format text|json|csv`/' README.md
git add -A
git commit -q -m "feat: add --format csv output" -m "Writes a header row and one data row so results can be loaded into spreadsheets."

cat > tally/core.py <<'PY'
def count(text):
    lines = text.count("\n")
    if text and not text.endswith("\n"):
        lines += 1
    return {"lines": lines, "words": len(text.split()), "chars": len(text)}
PY
cat > tests/test_core.py <<'PY'
import unittest

from tally.core import count


class CountTest(unittest.TestCase):
    def test_counts_words(self):
        self.assertEqual(count("a b\nc\n")["words"], 3)

    def test_counts_last_line_without_trailing_newline(self):
        self.assertEqual(count("a\nb")["lines"], 2)


if __name__ == "__main__":
    unittest.main()
PY
git add -A
git commit -q -m "fix: count the last line when the file has no trailing newline"

write_cli '"text", "json", "csv"' 'deprecated; use --format text' "$DEPRECATION" "$CSV_BRANCH"
git add -A
git commit -q -m "chore: deprecate --legacy-format" -m "--legacy-format now prints a deprecation warning to stderr and will be removed in 2.0. Use --format text instead."

sed -i 's/^          cache: pip$/          cache: pip\n          cache-dependency-path: pyproject.toml/' .github/workflows/ci.yml
git add -A
git commit -q -m "ci: key the pip cache on pyproject.toml"

# Local bare remote inside the workspace, synchronized with main and tags.
mkdir -p .fixture
printf '.fixture/\n' >> .git/info/exclude
git init -q --bare -b main .fixture/remote.git
git remote add origin "$PWD/.fixture/remote.git"
git push -q -u origin main
git push -q origin --tags
