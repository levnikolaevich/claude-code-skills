[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$validatorPath = Join-Path $PSScriptRoot "validate-repository.ps1"
$temporaryParent = [IO.Path]::GetTempPath().TrimEnd([IO.Path]::DirectorySeparatorChar)
$temporaryRoot = Join-Path $temporaryParent ("claude-code-skills-contracts-" + [guid]::NewGuid().ToString("N"))

function Assert-Condition {
    param(
        [Parameter(Mandatory)] [bool] $Condition,
        [Parameter(Mandatory)] [string] $Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function New-RepositoryFixture {
    param([Parameter(Mandatory)] [string] $Name)

    $fixtureRoot = Join-Path $temporaryRoot $Name
    New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
    foreach ($path in @("plugins", ".claude-plugin", ".agents", "site", "docs", ".github")) {
        Copy-Item -LiteralPath (Join-Path $repositoryRoot $path) -Destination $fixtureRoot -Recurse
    }
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "README.md") -Destination $fixtureRoot
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "SKILL_TEMPLATE.md") -Destination $fixtureRoot
    foreach ($path in @('AGENTS.md', 'CLAUDE.md')) {
        Copy-Item -LiteralPath (Join-Path $repositoryRoot $path) -Destination $fixtureRoot
    }
    return $fixtureRoot
}

function Assert-ValidatorFailure {
    param(
        [Parameter(Mandatory)] [string] $FixtureRoot,
        [Parameter(Mandatory)] [string] $ExpectedMessage
    )

    $failure = $null
    try {
        & $validatorPath -RepositoryRoot $FixtureRoot *> $null
    } catch {
        $failure = $_.Exception.Message
    }
    Assert-Condition ($null -ne $failure) "Validator unexpectedly accepted fixture: $FixtureRoot"
    Assert-Condition ($failure -like "*$ExpectedMessage*") "Validator failed for the wrong reason: $failure"
}

function Measure-Completion {
    param([Parameter(Mandatory)] [string[]] $States)

    $complete = @($States | Where-Object { $_ -in @("PROVEN", "CLEARED") }).Count
    $incomplete = @($States | Where-Object { $_ -eq "UNPROVEN" }).Count
    [pscustomobject]@{ Complete = $complete; Incomplete = $incomplete; Total = $States.Count }
}

New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
try {
    & $validatorPath -RepositoryRoot $repositoryRoot *> $null

    $catalog = Get-Content -LiteralPath (Join-Path $repositoryRoot ".claude-plugin/marketplace.json") -Raw | ConvertFrom-Json
    foreach ($plugin in $catalog.plugins) {
        $skillPath = Get-ChildItem -LiteralPath (Join-Path $repositoryRoot (($plugin.source -replace '^\./', '') + "/skills")) -Directory |
            Sort-Object Name |
            Select-Object -First 1 |
            ForEach-Object { Join-Path $_.FullName "SKILL.md" }
        $skillText = Get-Content -LiteralPath $skillPath -Raw
        foreach ($state in @("PROVEN", "CLEARED", "UNPROVEN")) {
            Assert-Condition ($skillText -cmatch [regex]::Escape($state)) "$($plugin.name) representative does not expose $state."
        }

        $normal = Measure-Completion @("PROVEN", "PROVEN")
        $absentCondition = Measure-Completion @("PROVEN", "CLEARED")
        $missingEvidence = Measure-Completion @("PROVEN", "UNPROVEN")
        Assert-Condition ($normal.Complete -eq 2 -and $normal.Incomplete -eq 0) "$($plugin.name) normal scenario failed."
        Assert-Condition ($absentCondition.Complete -eq 2 -and $absentCondition.Incomplete -eq 0) "$($plugin.name) absent-condition scenario failed."
        Assert-Condition ($missingEvidence.Complete -eq 1 -and $missingEvidence.Incomplete -eq 1) "$($plugin.name) missing-evidence scenario failed."
    }

    $siteFixture = New-RepositoryFixture "missing-site-skill"
    $sitePath = Join-Path $siteFixture "site/index.html"
    $siteText = [IO.File]::ReadAllText($sitePath)
    $siteText = [regex]::Replace($siteText, '(?m)^\s*<li><span>41</span>.*\r?\n', '', 1)
    [IO.File]::WriteAllText($sitePath, $siteText)
    Assert-ValidatorFailure $siteFixture "Site title/description/link differs"

    $contractFixture = New-RepositoryFixture "legacy-completion-contract"
    $contractPath = Join-Path $contractFixture "plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md"
    $contractText = [IO.File]::ReadAllText($contractPath)
    $legacyContract = "**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order. ``N/A``, skipped, unavailable, or delegated items remain incomplete."
    $contractText = [regex]::Replace($contractText, '(?m)^\*\*Execution contract:\*\*.*$', $legacyContract, 1)
    [IO.File]::WriteAllText($contractPath, $contractText)
    Assert-ValidatorFailure $contractFixture "contradictory legacy completion rule"

    $staleFixture = New-RepositoryFixture 'stale-skill-reference'
    $stalePath = Join-Path $staleFixture 'plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md'
    Add-Content -LiteralPath $stalePath -Value '`ln-35-surgical-change-implementer`'
    Assert-ValidatorFailure $staleFixture 'Stale skill reference'

    $reportFixture = New-RepositoryFixture 'missing-report-field'
    $reportPath = Join-Path $reportFixture 'plugins/operations-suite/skills/ln-71-operations-investigator/SKILL.md'
    $reportText = [IO.File]::ReadAllText($reportPath)
    $reportText = [regex]::Replace($reportText, '(?m)^4\. \*\*Verification:.*\r?\n', '')
    [IO.File]::WriteAllText($reportPath, $reportText)
    Assert-ValidatorFailure $reportFixture 'report fields or order differ'

    $orderFixture = New-RepositoryFixture 'wrong-lifecycle-order'
    foreach ($catalogPath in @('.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json')) {
        $path = Join-Path $orderFixture $catalogPath
        $data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $first = $data.plugins[0]
        $data.plugins[0] = $data.plugins[1]
        $data.plugins[1] = $first
        $data | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path
    }
    Assert-ValidatorFailure $orderFixture 'approved lifecycle'

    $descriptionFixture = New-RepositoryFixture 'stale-readme-description'
    $descriptionPath = Join-Path $descriptionFixture 'README.md'
    $descriptionText = [IO.File]::ReadAllText($descriptionPath).Replace('Evaluates new product opportunities through demand, channels and economics before committing to build.', 'Obsolete description.')
    [IO.File]::WriteAllText($descriptionPath, $descriptionText)
    Assert-ValidatorFailure $descriptionFixture 'README title/description differs'

    $linkFixture = New-RepositoryFixture 'broken-documentation-link'
    Add-Content -LiteralPath (Join-Path $linkFixture 'docs/token-efficiency.md') -Value '[Missing evidence](missing-evidence.md)'
    Assert-ValidatorFailure $linkFixture 'Missing documentation link'

    Write-Host "Passed repository baseline, $($catalog.plugins.Count * 3) completion-state scenarios, and seven negative regression fixtures. These are static contract checks, not live agent evaluations."
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        $resolvedTemporaryRoot = (Resolve-Path -LiteralPath $temporaryRoot).Path
        Assert-Condition ($resolvedTemporaryRoot.StartsWith($temporaryParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) "Refusing to remove a temporary path outside the system temp directory."
        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
    }
}
