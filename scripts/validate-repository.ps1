[CmdletBinding()]
param(
    [string] $RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$agentPluginsSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
$legacyCompletionRule = '`N/A`, skipped, unavailable, or delegated items remain incomplete.'

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
    $skillIdsByPlugin = @{}

    for ($pluginIndex = 0; $pluginIndex -lt $claudeCatalog.plugins.Count; $pluginIndex++) {
        $entry = $claudeCatalog.plugins[$pluginIndex]
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
        Assert-Condition ($hostManifest.description -ceq $entry.description) "Manifest description differs for $($entry.name)."
        Assert-Condition ($hostManifest.version -cmatch '^\d+\.\d+\.\d+$') "Manifest version is not SemVer for $($entry.name)."
        Assert-Condition ($hostManifest.skills -ceq './skills/') "Host skill path must be ./skills/ for $($entry.name)."
        foreach ($field in @("license", "homepage", "repository")) {
            Assert-Condition (-not [string]::IsNullOrWhiteSpace($hostManifest.$field)) "Missing $field for $($entry.name)."
        }

        $interface = $hostManifest.interface
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
            Assert-Condition ($lines.Count -ge 100 -and $lines.Count -le 200) "$($skillDirectory.Name) has $($lines.Count) lines; expected 100-200."
            Assert-Condition ($lines.Count -gt 3 -and $lines[0] -ceq '---' -and $lines[3] -ceq '---') "$($skillDirectory.Name) frontmatter must contain only name and description."

            $name = ($lines[1] -replace '^name:\s*', '').Trim('"')
            $description = ($lines[2] -replace '^description:\s*', '').Trim('"')
            Assert-Condition ($name -ceq $skillDirectory.Name) "Folder and frontmatter names differ for $($skillDirectory.Name)."
            Assert-Condition ($description.Length -le 200) "$name description exceeds 200 characters."
            Assert-Condition ($skillNames.Add($name)) "Duplicate skill name: $name."
            $nameMatch = [regex]::Match($name, '^ln-(\d)(\d)-[a-z0-9-]+$')
            Assert-Condition $nameMatch.Success "Invalid indexed skill name: $name."
            Assert-Condition ($nameMatch.Groups[1].Value -ceq $expectedLeadingIndex) "$name is assigned to the wrong plugin family."

            $skillText = [IO.File]::ReadAllText($skillPath)
            Assert-Condition (-not $skillText.Contains($legacyCompletionRule)) "$name uses the contradictory legacy completion rule."
            foreach ($state in @('PROVEN', 'CLEARED', 'UNPROVEN')) {
                Assert-Condition ($skillText -cmatch [regex]::Escape($state)) "$name execution contract does not define $state."
            }
            Assert-Condition ($skillText -cmatch 'Checklist: X/Y complete') "$name does not require the completion count."
            Assert-Condition ($skillText -cmatch '(?m)^- \[ \] ') "$name has no executable checklist."

            $skillId = $nameMatch.Groups[1].Value + $nameMatch.Groups[2].Value
            $skillIds.Add($skillId)
            $relativeSkillPath = [IO.Path]::GetRelativePath($repositoryRoot, $skillPath).Replace('\', '/')
            $canonicalSkillPaths.Add($relativeSkillPath)
        }
        $skillIdsByPlugin[$entry.name] = @($skillIds)
    }

    $readme = Get-Content -LiteralPath "README.md" -Raw
    $readmeSkillPaths = @([regex]::Matches($readme, 'plugins/[^/)]+/skills/[^/)]+/SKILL\.md') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    Assert-SequenceEqual $readmeSkillPaths @($canonicalSkillPaths | Sort-Object) "README skill catalog differs from canonical skill directories."

    $site = Get-Content -LiteralPath "site/index.html" -Raw
    foreach ($pluginName in $claudeNames) {
        $articlePattern = '(?s)<article id="{0}".*?</article>' -f [regex]::Escape($pluginName)
        $articleMatch = [regex]::Match($site, $articlePattern)
        Assert-Condition $articleMatch.Success "Missing site article for $pluginName."
        $siteSkillIds = @([regex]::Matches($articleMatch.Value, '<li><span>(\d{2})</span>') | ForEach-Object { $_.Groups[1].Value })
        Assert-SequenceEqual $siteSkillIds @($skillIdsByPlugin[$pluginName]) "Site skill catalog differs from canonical skills for $pluginName."
    }

    $siteIds = @([regex]::Matches($site, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
    $siteHrefs = @([regex]::Matches($site, 'href="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
    foreach ($href in $siteHrefs) {
        if ($href.StartsWith('#')) {
            Assert-Condition ($siteIds -contains $href.Substring(1)) "Missing site anchor: $href."
        } elseif (-not $href.StartsWith('http') -and -not $href.StartsWith('data:')) {
            $assetPath = ($href -split '#')[0]
            if ($assetPath) {
                Assert-Condition (Test-Path -LiteralPath (Join-Path "site" $assetPath)) "Missing site asset: $href."
            }
        }
    }

    foreach ($redirectPath in Get-ChildItem -LiteralPath "site/plugins" -Filter "*.html" -File) {
        $redirect = Get-Content -LiteralPath $redirectPath.FullName -Raw
        $target = [regex]::Match($redirect, 'index\.html#([a-z0-9-]+)')
        Assert-Condition ($target.Success -and $siteIds -contains $target.Groups[1].Value) "Invalid site redirect target in $($redirectPath.Name)."
    }

    foreach ($retiredPath in @("mcp", "site/mcp")) {
        Assert-Condition (-not (Test-Path -LiteralPath $retiredPath)) "Retired path must not be restored: $retiredPath."
    }

    Write-Host "Validated $($claudeNames.Count) plugins, $($skillNames.Count) standalone skills, both catalogs, README, and the static site."
} finally {
    Pop-Location
}
