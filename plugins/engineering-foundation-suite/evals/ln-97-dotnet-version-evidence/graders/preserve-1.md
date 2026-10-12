---
type: regex
target: { source: file, path: App.csproj }
pattern: '^<Project\ Sdk="Microsoft\.NET\.Sdk\.Web"><PropertyGroup><TargetFramework>net10\.0</TargetFramework></PropertyGroup></Project>\n$'
flags: s
---
