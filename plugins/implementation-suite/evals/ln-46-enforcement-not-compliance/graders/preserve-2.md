---
type: regex
target: { source: file, path: tools/lint.py }
pattern: '^import\ argparse\nimport\ json\nfrom\ pathlib\ import\ Path\n\nparser\ =\ argparse\.ArgumentParser\(\)\nparser\.add_argument\(''\-\-config'',\ required=True\)\nparser\.add_argument\(''\-\-root'',\ default=''\.''\)\nargs\ =\ parser\.parse_args\(\)\ncfg\ =\ json\.loads\(Path\(args\.config\)\.read_text\(\)\)\nbase\ =\ Path\(args\.root\)\nfiles\ =\ sorted\(\{p\ for\ pattern\ in\ cfg\[''include''\]\ for\ p\ in\ base\.glob\(pattern\)\ if\ p\.is_file\(\)\}\)\nfailed\ =\ False\nfor\ path\ in\ files:\n\ \ \ \ token\ =\ \{''\.py'':\ ''print\('',\ ''\.css'':\ ''!important''\}\.get\(path\.suffix\)\n\ \ \ \ if\ token\ and\ token\ in\ path\.read_text\(\):\n\ \ \ \ \ \ \ \ print\(''warning:\ forbidden\ pattern\ in\ ''\ \+\ str\(path\.relative_to\(base\)\)\)\n\ \ \ \ \ \ \ \ failed\ =\ True\nprint\(''checked=''\ \+\ str\(len\(files\)\)\)\nraise\ SystemExit\(1\ if\ failed\ and\ cfg\.get\(''warnings_as_errors'',\ False\)\ else\ 0\)\n$'
flags: s
---
