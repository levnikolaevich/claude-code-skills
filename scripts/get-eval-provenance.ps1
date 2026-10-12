[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string[]] $CaseDirectory,
    [ValidateSet('plugin', 'repository')] [string] $CatalogScope = 'plugin'
)

# Binds eval evidence to content: Git blob hashes of the graded skill (SKILL.md and references) and of the case files.
# A result stays current only while every listed hash still matches the repository file.

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Get-RepositoryPath {
    param([Parameter(Mandatory)] [string] $Path)
    return [IO.Path]::GetRelativePath($repositoryRoot, (Resolve-Path -LiteralPath $Path).Path).Replace('\', '/')
}

$provenance = [ordered]@{}
foreach ($directory in $CaseDirectory) {
    $case = Get-Item -LiteralPath $directory
    $pluginRoot = $case.Parent.Parent.FullName
    $skill = [regex]::Match([IO.File]::ReadAllText((Join-Path $case.FullName 'graders/skill-fired.md')), 'ln-\d{2}-[a-z0-9-]+').Value
    if (-not $skill) { throw "Eval case $($case.Name) does not name its skill in graders/skill-fired.md." }
    $promptText = [IO.File]::ReadAllText((Join-Path $case.FullName 'prompt.md'))
    $discovery = $promptText -match '(?m)^tags:\s*\[[^\]]*\bdiscovery\b'
    # Selection depends on every available description, not only the expected skill body.
    $skillRoot = if ($discovery) { Join-Path $pluginRoot 'skills' } else { Join-Path $pluginRoot "skills/$skill" }
    $skillFiles = if ($CatalogScope -eq 'repository') { @(Get-ChildItem -Path (Join-Path $repositoryRoot 'plugins/*/skills/*') -Directory | Get-ChildItem -Recurse -File) } else { @(Get-ChildItem -LiteralPath $skillRoot -Recurse -File) }
    $files = @($skillFiles) +
        @(Get-ChildItem -LiteralPath $case.FullName -Recurse -File | Where-Object { (Get-RepositoryPath $_.FullName) -notmatch '/evals/[^/]+/results/' })
    $paths = @($files | ForEach-Object { Get-RepositoryPath $_.FullName } | Sort-Object)
    $hashes = @($paths | git -C $repositoryRoot hash-object --stdin-paths)
    if ($LASTEXITCODE -ne 0 -or $hashes.Count -ne $paths.Count) { throw "git hash-object failed for eval case $($case.Name)." }
    $fileHashes = [ordered]@{}
    for ($index = 0; $index -lt $paths.Count; $index++) { $fileHashes[$paths[$index]] = $hashes[$index].Trim() }
    $provenance[$case.Name] = [ordered]@{ plugin = Split-Path -Leaf $pluginRoot; skill = $skill; files = $fileHashes }
}
$provenance | ConvertTo-Json -Depth 5
