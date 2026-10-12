---
type: regex
target: { source: file, path: checks/verify.py }
pattern: '^import\ json,\ subprocess\nfrom\ pathlib\ import\ Path\nprocess\ =\ subprocess\.run\(\["node",\ "checks/probe\.mjs"\],\ text=True,\ capture_output=True,\ check=True\)\nobserved=json\.loads\(process\.stdout\)\nexpected=\{"status":500,"body":\{"code":"internal_error","message":"Please\ try\ again\ later\."\},"events":1,"secret_exposed":False\}\nPath\("results"\)\.mkdir\(exist_ok=True\)\nPath\("results/acceptance\.json"\)\.write_text\(json\.dumps\(observed,sort_keys=True\)\+"\\n"\)\nassert\ observed\ ==\ expected,\ \(observed,expected\)\n$'
flags: s
---
