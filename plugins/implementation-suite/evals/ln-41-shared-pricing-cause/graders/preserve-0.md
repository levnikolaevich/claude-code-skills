---
type: regex
target: { source: file, path: checks/verify.py }
pattern: '^import\ json\nfrom\ pathlib\ import\ Path\nimport\ sys\nsys\.path\.insert\(0,\ str\(Path\(__file__\)\.resolve\(\)\.parents\[1\]\)\)\nfrom\ api\ import\ quote\nfrom\ batch\ import\ invoice\n\ncases\ =\ \[\(\[\(16,\ 1\)\],\ 10,\ 14\),\ \(\[\(25,\ 1\)\],\ 50,\ 13\),\ \(\[\(15,\ 3\)\],\ 10,\ 41\),\ \(\[\(9,\ 2\)\],\ 0,\ 18\),\ \(\[\(9,\ 2\)\],\ 100,\ 0\)\]\nobserved\ =\ \{name:\ \[fn\(lines,\ percent\)\ for\ lines,\ percent,\ _\ in\ cases\]\ for\ name,\ fn\ in\ \[\(''api'',\ quote\),\ \(''batch'',\ invoice\)\]\}\nexpected\ =\ \[expected\ for\ _,\ _,\ expected\ in\ cases\]\nPath\(''results''\)\.mkdir\(exist_ok=True\)\nPath\(''results/pricing\.json''\)\.write_text\(json\.dumps\(observed,\ sort_keys=True\)\ \+\ ''\\n''\)\nassert\ observed\ ==\ \{''api'':\ expected,\ ''batch'':\ expected\},\ observed\nprint\(json\.dumps\(observed,\ sort_keys=True\)\)\n$'
flags: s
---
