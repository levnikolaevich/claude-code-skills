---
type: regex
target: { source: file, path: checks/verify.py }
pattern: '^import\ json\nfrom\ pathlib\ import\ Path\nimport\ sys\nsys\.path\.insert\(0,\ str\(Path\(__file__\)\.resolve\(\)\.parents\[1\]\)\)\nfrom\ access\ import\ read_item,\ list_items\nrows=\[\{"id":1,"company":"a"\},\{"id":2,"company":"b"\}\]\nviewer=\{"company":"a","permissions":\["read"\]\}\nother=\{"company":"b","permissions":\[\]\}\nobserved=\{"own":read_item\(viewer,rows,1\),"foreign":read_item\(viewer,rows,2\),"missing":read_item\(viewer,rows,9\),"denied":read_item\(other,rows,2\),"list":list_items\(viewer,rows\)\}\nexpected=\{"own":rows\[0\],"foreign":None,"missing":None,"denied":None,"list":\[rows\[0\]\]\}\nPath\("results"\)\.mkdir\(exist_ok=True\)\nPath\("results/acceptance\.json"\)\.write_text\(json\.dumps\(observed,\ sort_keys=True\)\+"\\n"\)\nassert\ observed\ ==\ expected,\ \(observed,\ expected\)\n$'
flags: s
---
