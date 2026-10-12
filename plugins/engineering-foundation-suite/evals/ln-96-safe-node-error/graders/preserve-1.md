---
type: regex
target: { source: file, path: checks/probe.mjs }
pattern: '^import\ \{handle\}\ from\ "\.\./app\.mjs";\nlet\ events=0;\nconst\ response=await\ handle\(async\(\)=>\{throw\ new\ Error\("CANARY_PRIVATE_TOKEN"\)\},\(\)=>\{events\+\+\}\);\nconsole\.log\(JSON\.stringify\(\{\.\.\.response,events,secret_exposed:JSON\.stringify\(response\)\.includes\("CANARY_PRIVATE_TOKEN"\)\}\)\);\n$'
flags: s
---
