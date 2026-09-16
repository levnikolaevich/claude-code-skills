[CmdletBinding()]
param(
    [string] $RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$agentPluginsSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"

function Assert-Condition {
    param(
        [Parameter(Mandatory)] [bool] $Condition,
        [Parameter(Mandatory)] [string] $Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-SequenceEqual {
    param(
        [Parameter(Mandatory)] [object[]] $Actual,
        [Parameter(Mandatory)] [object[]] $Expected,
        [Parameter(Mandatory)] [string] $Message
    )

    Assert-Condition (($Actual -join "|") -ceq ($Expected -join "|")) $Message
}

Push-Location $repositoryRoot
try {
    $claudeCatalog = Get-Content -LiteralPath ".claude-plugin/marketplace.json" -Raw | ConvertFrom-Json
    $codexCatalog = Get-Content -LiteralPath ".agents/plugins/marketplace.json" -Raw | ConvertFrom-Json
    $repositoryMetadata = Get-Content -LiteralPath '.github/repository-metadata.json' -Raw | ConvertFrom-Json
    $claudeNames = @($claudeCatalog.plugins.name)
    $codexNames = @($codexCatalog.plugins.name)
    Assert-SequenceEqual $codexNames $claudeNames "Claude and Codex plugin names or order differ."

    $pluginDirectories = @(Get-ChildItem -LiteralPath "plugins" -Directory | Sort-Object Name)
    Assert-SequenceEqual @($pluginDirectories.Name) @($claudeNames | Sort-Object) "Catalog and plugin directories differ."

    $codexEntries = @{}
    foreach ($entry in $codexCatalog.plugins) {
        $codexEntries[$entry.name] = $entry
    }

    $skillNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $canonicalSkillPaths = [Collections.Generic.List[string]]::new()
    $skillMetadata = @{}
    $templatePath = Join-Path $repositoryRoot 'SKILL_TEMPLATE.md'
    Assert-Condition (Test-Path -LiteralPath $templatePath -PathType Leaf) 'Missing canonical SKILL_TEMPLATE.md.'
    $templateText = [IO.File]::ReadAllText($templatePath).Replace("`r`n", "`n")
    $contractPattern = '(?s)\*\*Execution contract:\*\*.*?(?=\n## Tool Routing)'
    $selfCheckPattern = '(?s)## Self-Check\n.*?(?=\n## Output Contract)'
    $reportPattern = '(?s)## Output Contract\n.*?(?=\*\*Skill-specific evidence:\*\*)'
    $templateContract = [regex]::Match($templateText, $contractPattern)
    $templateSelfCheck = [regex]::Match($templateText, $selfCheckPattern)
    $templateReport = [regex]::Match($templateText, $reportPattern)
    Assert-Condition ($templateContract.Success -and $templateSelfCheck.Success -and $templateReport.Success) 'Skill template is missing a common contract block.'
    $sharedRulePattern = '(?m)^- \[ \] \*\*(?<key>[^*]+):\*\*[^\n]*'
    $sharedRules = @{}
    foreach ($rule in [regex]::Matches($templateText, $sharedRulePattern)) {
        $sharedRules[$rule.Groups['key'].Value] = $rule.Value
    }
    Assert-Condition ($sharedRules.ContainsKey('Test value and boundary')) 'Skill template is missing the product-test policy.'

    for ($pluginIndex = 0; $pluginIndex -lt $claudeCatalog.plugins.Count; $pluginIndex++) {
        $entry = $claudeCatalog.plugins[$pluginIndex]
        Assert-Condition ($entry.source -ceq "./plugins/$($entry.name)") "Non-canonical plugin source for $($entry.name)."
        $pluginRoot = Join-Path $repositoryRoot ($entry.source -replace "^\./", "")
        $portableManifestPath = Join-Path $pluginRoot "plugin.json"
        $hostManifestPath = Join-Path $pluginRoot ".codex-plugin/plugin.json"

        foreach ($manifestPath in @($portableManifestPath, $hostManifestPath)) {
            Assert-Condition (Test-Path -LiteralPath $manifestPath -PathType Leaf) "Missing manifest for $($entry.name): $manifestPath"
        }

        $portableManifest = Get-Content -LiteralPath $portableManifestPath -Raw | ConvertFrom-Json
        $portableFields = @($portableManifest.PSObject.Properties.Name)
        Assert-Condition ($portableFields.Count -eq 2 -and $portableFields -contains '$schema' -and $portableFields -contains 'name') "Portable manifest for $($entry.name) must contain exactly `$schema and name."
        Assert-Condition ($portableManifest.'$schema' -ceq $agentPluginsSchema) "Unsupported Agent Plugins schema for $($entry.name)."
        Assert-Condition ($portableManifest.name -ceq $entry.name -and $portableManifest.name -ceq (Split-Path $pluginRoot -Leaf)) "Portable manifest, catalog, and directory names differ for $($entry.name)."
        Assert-Condition ($portableManifest.name.Length -le 64 -and $portableManifest.name -cmatch '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$' -and $portableManifest.name -cnotmatch '(--|\.\.)') "Portable plugin name violates Agent Plugins v1 for $($entry.name)."

        $hostManifest = Get-Content -LiteralPath $hostManifestPath -Raw | ConvertFrom-Json
        Assert-Condition ($hostManifest.name -ceq $portableManifest.name) "Host and portable manifest names differ for $($entry.name)."
        Assert-Condition ($hostManifest.homepage -ceq $repositoryMetadata.homepage) "Plugin homepage differs from repository metadata for $($entry.name)."
        Assert-Condition ($hostManifest.description -ceq $entry.description) "Manifest description differs for $($entry.name)."
        Assert-Condition ($hostManifest.version -cmatch '^\d+\.\d+\.\d+$') "Manifest version is not SemVer for $($entry.name)."
        Assert-Condition ($hostManifest.skills -ceq './skills/') "Host skill path must be ./skills/ for $($entry.name)."
        foreach ($field in @("license", "homepage", "repository")) {
            Assert-Condition (-not [string]::IsNullOrWhiteSpace($hostManifest.$field)) "Missing $field for $($entry.name)."
        }

        $interface = $hostManifest.interface
        Assert-Condition ($interface.longDescription -ceq $hostManifest.description) "Host longDescription differs from canonical description for $($entry.name)."
        Assert-Condition (-not [string]::IsNullOrWhiteSpace($interface.displayName) -and $interface.displayName.Length -le 30) "displayName must contain at most 30 characters for $($entry.name)."
        Assert-Condition (-not [string]::IsNullOrWhiteSpace($interface.shortDescription) -and $interface.shortDescription.Length -le 30) "shortDescription must contain at most 30 characters for $($entry.name)."
        Assert-Condition (@($interface.defaultPrompt).Count -le 3) "defaultPrompt must contain at most three prompts for $($entry.name)."

        $codexEntry = $codexEntries[$entry.name]
        Assert-Condition ($null -ne $codexEntry) "Missing Codex catalog entry for $($entry.name)."
        Assert-Condition ($codexEntry.source.source -ceq 'local' -and $codexEntry.source.path -ceq $entry.source) "Codex and Claude source paths differ for $($entry.name)."

        $expectedLeadingIndex = [string]($pluginIndex + 1)
        $skillIds = [Collections.Generic.List[string]]::new()
        $skillsRoot = Join-Path $pluginRoot "skills"
        foreach ($skillDirectory in Get-ChildItem -LiteralPath $skillsRoot -Directory | Sort-Object Name) {
            $skillPath = Join-Path $skillDirectory.FullName "SKILL.md"
            Assert-Condition (Test-Path -LiteralPath $skillPath -PathType Leaf) "Missing SKILL.md in $($skillDirectory.Name)."

            $lines = [IO.File]::ReadAllLines($skillPath)
            Assert-Condition ($lines.Count -le 200) "$($skillDirectory.Name) has $($lines.Count) lines; maximum is 200."
            Assert-Condition ($lines.Count -gt 3 -and $lines[0] -ceq '---' -and $lines[3] -ceq '---') "$($skillDirectory.Name) frontmatter must contain only name and description."

            $name = ($lines[1] -replace '^name:\s*', '').Trim('"')
            $description = ($lines[2] -replace '^description:\s*', '').Trim('"')
            Assert-Condition ($name -ceq $skillDirectory.Name) "Folder and frontmatter names differ for $($skillDirectory.Name)."
            Assert-Condition ($description.Length -le 200) "$name description exceeds 200 characters."
            Assert-Condition ($skillNames.Add($name)) "Duplicate skill name: $name."
            $nameMatch = [regex]::Match($name, '^ln-(\d)([1-9])-[a-z0-9-]+$')
            Assert-Condition $nameMatch.Success "Invalid indexed skill name: $name."
            Assert-Condition ($nameMatch.Groups[1].Value -ceq $expectedLeadingIndex) "$name is assigned to the wrong plugin family."

            $skillText = [IO.File]::ReadAllText($skillPath).Replace("`r`n", "`n")
            $title = [regex]::Match($skillText, '(?m)^# (.+)$').Groups[1].Value
            Assert-Condition (-not [string]::IsNullOrWhiteSpace($title)) "Missing skill title: $name"
            $skillMetadata[$name] = @{ Title = $title; Description = $description; Plugin = $entry.name }
            $workflow = [regex]::Match($skillText, '(?s)## Checklist\n(.*?)(?=\n## (?:Verdict|Self-Check))')
            Assert-Condition ($workflow.Success -and $workflow.Groups[1].Value -cmatch '(?m)^- \[ \] ') "$name has no domain checklist."

            $goalPosition = $skillText.IndexOf('**Goal:**')
            $contractPosition = $skillText.IndexOf('**Execution contract:**')
            $routingPosition = $skillText.IndexOf('## Tool Routing')
            Assert-Condition ($goalPosition -ge 0 -and $contractPosition -gt $goalPosition -and $routingPosition -gt $contractPosition) "$name must define Goal and Execution contract before Tool Routing."
            $contractMatch = [regex]::Match($skillText, $contractPattern)
            $selfCheckMatch = [regex]::Match($skillText, $selfCheckPattern)
            $reportMatch = [regex]::Match($skillText, $reportPattern)
            Assert-Condition ($contractMatch.Success -and $selfCheckMatch.Success -and $reportMatch.Success) "$name is missing the item-level contract, final self-check, or common report with skill-specific evidence."
            Assert-Condition ($contractMatch.Value -ceq $templateContract.Value -and $selfCheckMatch.Value -ceq $templateSelfCheck.Value -and $reportMatch.Value -ceq $templateReport.Value) "$name common contract, self-check, or report differs from SKILL_TEMPLATE.md."
            $seenRules = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
            foreach ($rule in [regex]::Matches($skillText, $sharedRulePattern)) {
                $key = $rule.Groups['key'].Value
                if (-not $sharedRules.ContainsKey($key)) { continue }
                Assert-Condition ($seenRules.Add($key)) "$name duplicates shared rule: $key."
                Assert-Condition ($rule.Value -ceq $sharedRules[$key]) "$name shared rule differs from SKILL_TEMPLATE.md: $key."
                Assert-Condition ($rule.Index -ge $workflow.Index -and $rule.Index -lt ($workflow.Index + $workflow.Length)) "$name shared rule is outside its domain checklist: $key."
            }

            foreach ($link in [regex]::Matches($skillText, '\[[^\]]+\]\(([^)]+)\)')) {
                $target = $link.Groups[1].Value
                if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $target.StartsWith('#')) { continue }
                $localTarget = ($target -split '#')[0]
                $resolvedTarget = [IO.Path]::GetFullPath((Join-Path $skillDirectory.FullName $localTarget))
                Assert-Condition ($resolvedTarget.StartsWith($skillDirectory.FullName + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) "$name reference must stay inside its standalone skill: $target"
                Assert-Condition (Test-Path -LiteralPath $resolvedTarget -PathType Leaf) "$name has a missing local reference: $target"
            }

            $skillId = $nameMatch.Groups[1].Value + $nameMatch.Groups[2].Value
            Assert-Condition (-not $skillIds.Contains($skillId)) "Duplicate skill index: $skillId."
            $skillIds.Add($skillId)
            $relativeSkillPath = [IO.Path]::GetRelativePath($repositoryRoot, $skillPath).Replace('\', '/')
            $canonicalSkillPaths.Add($relativeSkillPath)
        }
        Assert-Condition ($skillIds.Count -ge 1 -and $skillIds.Count -le 9) "Plugin must contain one to nine indexed skills: $($entry.name)."
    }

    foreach ($path in $canonicalSkillPaths) {
        $text = [IO.File]::ReadAllText((Join-Path $repositoryRoot $path))
        foreach ($reference in [regex]::Matches($text, '\bln-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\b')) {
            Assert-Condition ($skillNames.Contains($reference.Value)) "Unknown skill reference in ${path}: $($reference.Value)"
        }
    }

    $readme = Get-Content -LiteralPath "README.md" -Raw
    $readmeSkillPaths = @([regex]::Matches($readme, 'plugins/[^/)]+/skills/[^/)]+/SKILL\.md') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    Assert-SequenceEqual $readmeSkillPaths @($canonicalSkillPaths | Sort-Object) "README skill catalog differs from canonical skill directories."

    foreach ($name in $skillMetadata.Keys) {
        $metadata = $skillMetadata[$name]
        $path = "plugins/$($metadata.Plugin)/skills/$name/SKILL.md"
        $readmeRow = "[$($metadata.Title)]($path) | $($metadata.Description) |"
        Assert-Condition ($readme.Contains($readmeRow)) "README title/description differs for $name."
    }
    foreach ($pluginName in $claudeNames) {
        $adapter = Get-Content -LiteralPath "plugins/$pluginName/.codex-plugin/plugin.json" -Raw | ConvertFrom-Json
        $readmePluginPattern = '(?s)### {0}\r?\n\r?\n{1}\r?\n' -f [regex]::Escape($adapter.interface.displayName), [regex]::Escape($adapter.description)
        Assert-Condition ([regex]::IsMatch($readme, $readmePluginPattern)) "README plugin title/description differs for $pluginName."
    }

    $documentationPaths = @('README.md', 'AGENTS.md', 'CLAUDE.md', 'SKILL_TEMPLATE.md') + @(Get-ChildItem -LiteralPath 'docs' -Filter '*.md' -File | ForEach-Object { $_.FullName })
    foreach ($documentationPath in $documentationPaths) {
        $document = Get-Item -LiteralPath $documentationPath
        $text = [IO.File]::ReadAllText($document.FullName)
        foreach ($link in [regex]::Matches($text, '\[[^\]]+\]\(([^)]+)\)')) {
            $target = $link.Groups[1].Value
            if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $target.StartsWith('#')) { continue }
            $localTarget = ($target -split '#')[0]
            Assert-Condition (Test-Path -LiteralPath (Join-Path $document.DirectoryName $localTarget) -PathType Leaf) "Missing documentation link in $($document.Name): $target"
        }
    }
    Assert-Condition ($repositoryMetadata.description.Length -gt 0 -and $repositoryMetadata.description.Length -le 350) 'Invalid repository description.'
    Assert-Condition ($claudeCatalog.description -ceq $repositoryMetadata.description) 'Marketplace description differs from repository metadata.'
    Assert-Condition ($readme.Contains($repositoryMetadata.homepage)) 'Repository homepage differs from README.'
    Assert-Condition ($repositoryMetadata.topics.Count -ge 1 -and $repositoryMetadata.topics.Count -le 20) 'Repository must have one to twenty discovery topics.'
    Assert-Condition (@($repositoryMetadata.topics | Sort-Object -Unique).Count -eq $repositoryMetadata.topics.Count) 'Duplicate repository topic.'
    foreach ($topic in $repositoryMetadata.topics) {
        Assert-Condition ($topic -cmatch '^[a-z0-9-]{1,50}$') "Invalid repository topic: $topic"
    }

    Write-Host "Validated $($claudeNames.Count) plugins, $($skillNames.Count) standalone skills, both catalogs, README, and repository metadata."
} finally {
    Pop-Location
}
