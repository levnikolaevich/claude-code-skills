---
type: regex
target: { source: file, path: checks/verify.py }
pattern: '^import\ json\nfrom\ pathlib\ import\ Path\nimport\ sys\nsys\.path\.insert\(0,\ str\(Path\(__file__\)\.resolve\(\)\.parents\[1\]\)\)\nfrom\ operation\ import\ charge\nstate=\{"balance":100,"results":\{\}\}\nfirst=charge\(state,"op\-1",7\)\nsecond=charge\(state,"op\-1",7\)\ntry:\n\ \ \ \ charge\(state,"op\-1",9\)\n\ \ \ \ mismatch="accepted"\nexcept\ ValueError:\n\ \ \ \ mismatch="rejected"\nobserved=\{"balance":state\["balance"\],"first":first,"second":second,"mismatch":mismatch\}\nexpected=\{"balance":93,"first":93,"second":93,"mismatch":"rejected"\}\nPath\("results"\)\.mkdir\(exist_ok=True\)\nPath\("results/acceptance\.json"\)\.write_text\(json\.dumps\(observed,\ sort_keys=True\)\+"\\n"\)\nassert\ observed\ ==\ expected,\ \(observed,\ expected\)\n$'
flags: s
---
