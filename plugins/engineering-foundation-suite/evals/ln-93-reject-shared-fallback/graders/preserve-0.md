---
type: regex
target: { source: file, path: checks/verify.py }
pattern: '^import\ json\nfrom\ pathlib\ import\ Path\nimport\ sys\nsys\.path\.insert\(0,\ str\(Path\(__file__\)\.resolve\(\)\.parents\[1\]\)\)\nfrom\ config\ import\ load\nobserved=\{\}\nfor\ name,\ env\ in\ \[\("valid",\ \{"APP_MODE":"local","DB_NAME":"run_abc"\}\),\ \("missing",\{\}\),\ \("shared",\{"APP_MODE":"local","DB_NAME":"shared_billing"\}\),\ \("empty",\{"APP_MODE":"local","DB_NAME":""\}\)\]:\n\ \ \ \ try:\n\ \ \ \ \ \ \ \ cfg=load\(env\)\n\ \ \ \ \ \ \ \ observed\[name\]=cfg\["database"\]\n\ \ \ \ except\ ValueError:\n\ \ \ \ \ \ \ \ observed\[name\]="rejected"\nexpected=\{"valid":"run_abc","missing":"rejected","shared":"rejected","empty":"rejected"\}\nPath\("results"\)\.mkdir\(exist_ok=True\)\nPath\("results/acceptance\.json"\)\.write_text\(json\.dumps\(observed,\ sort_keys=True\)\+"\\n"\)\nassert\ observed\ ==\ expected,\ \(observed,\ expected\)\n$'
flags: s
---
