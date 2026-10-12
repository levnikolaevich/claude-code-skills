---
type: regex
target: { source: file, path: dotnet/Library.csproj }
pattern: '^<Project\ Sdk="Microsoft\.NET\.Sdk"><PropertyGroup><TargetFramework>net10\.0</TargetFramework></PropertyGroup></Project>\n$'
flags: s
---
