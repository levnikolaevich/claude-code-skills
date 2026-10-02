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

$fixtureRoot = Join-Path $temporaryRoot 'repository'
$fixtureSnapshot = @{}
$fixtureName = ''

# Copy the repository once; every case then mutates this copy and the next case restores it from memory.
function Initialize-RepositoryFixture {
    foreach ($path in @('plugins', '.claude-plugin', '.agents', 'docs', '.github', 'scripts', 'README.md', 'SKILL_TEMPLATE.md', 'AGENTS.md', 'CLAUDE.md', 'LICENSE')) {
        $source = Join-Path $repositoryRoot $path
        $files = if (Test-Path -LiteralPath $source -PathType Container) { Get-ChildItem -LiteralPath $source -Recurse -File -Force } else { Get-Item -LiteralPath $source }
        foreach ($file in $files) {
            $relative = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
            $fixtureSnapshot[$relative] = [IO.File]::ReadAllBytes($file.FullName)
            $target = Join-Path $fixtureRoot $relative
            [void] [IO.Directory]::CreateDirectory((Split-Path -Parent $target))
            [IO.File]::WriteAllBytes($target, $fixtureSnapshot[$relative])
        }
    }
}

function New-RepositoryFixture {
    param([Parameter(Mandatory)] [string] $Name)

    $script:fixtureName = $Name
    foreach ($file in Get-ChildItem -LiteralPath $fixtureRoot -Recurse -File -Force) {
        if (-not $fixtureSnapshot.ContainsKey([IO.Path]::GetRelativePath($fixtureRoot, $file.FullName))) {
            Remove-Item -LiteralPath $file.FullName -Force
        }
    }
    foreach ($relative in $fixtureSnapshot.Keys) {
        $target = Join-Path $fixtureRoot $relative
        $expected = [byte[]] $fixtureSnapshot[$relative]
        if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or -not [Linq.Enumerable]::SequenceEqual([byte[]] [IO.File]::ReadAllBytes($target), $expected)) {
            [void] [IO.Directory]::CreateDirectory((Split-Path -Parent $target))
            [IO.File]::WriteAllBytes($target, $expected)
        }
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
    Assert-Condition ($null -ne $failure) "Validator unexpectedly accepted fixture: $fixtureName"
    Assert-Condition ($failure -like "*$ExpectedMessage*") "Validator failed for the wrong reason in ${fixtureName}: $failure"
}

New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
try {
    & $validatorPath -RepositoryRoot $repositoryRoot *> $null
    Initialize-RepositoryFixture
    & $validatorPath -RepositoryRoot $fixtureRoot *> $null

    $checklistFixture = New-RepositoryFixture 'missing-domain-checklist'
    $checklistPath = Join-Path $checklistFixture 'plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md'
    $checklistText = [IO.File]::ReadAllText($checklistPath)
    $checklistText = [regex]::Replace($checklistText, '(?s)## Checklist\r?\n.*?(?=\r?\n## Self-Check)', "## Checklist`n")
    [IO.File]::WriteAllText($checklistPath, $checklistText)
    Assert-ValidatorFailure $checklistFixture 'has no domain checklist'

    $contractFixture = New-RepositoryFixture "changed-execution-contract"
    $contractPath = Join-Path $contractFixture "plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md"
    $contractText = [IO.File]::ReadAllText($contractPath)
    $contractText = $contractText.Replace('reading, delegation, tool failure, a zero exit status, or a self-reported success is not proof', 'reading alone is proof')
    [IO.File]::WriteAllText($contractPath, $contractText)
    Assert-ValidatorFailure $contractFixture "differs from SKILL_TEMPLATE.md"

    $staleFixture = New-RepositoryFixture 'unknown-skill-reference'
    $stalePath = Join-Path $staleFixture 'plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md'
    Add-Content -LiteralPath $stalePath -Value '`ln-00-missing-skill`'
    Assert-ValidatorFailure $staleFixture 'Unknown skill reference'

    $reportFixture = New-RepositoryFixture 'missing-report-field'
    $reportPath = Join-Path $reportFixture 'plugins/operations-suite/skills/ln-71-operations-investigator/SKILL.md'
    $reportText = [IO.File]::ReadAllText($reportPath)
    $reportText = [regex]::Replace($reportText, '(?m)^4\. \*\*Verification:.*\r?\n', '')
    [IO.File]::WriteAllText($reportPath, $reportText)
    Assert-ValidatorFailure $reportFixture 'differs from SKILL_TEMPLATE.md'

    $orderFixture = New-RepositoryFixture 'wrong-lifecycle-order'
    foreach ($catalogPath in @('.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json')) {
        $path = Join-Path $orderFixture $catalogPath
        $data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $first = $data.plugins[0]
        $data.plugins[0] = $data.plugins[1]
        $data.plugins[1] = $first
        $data | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path
    }
    Assert-ValidatorFailure $orderFixture 'wrong plugin family'

    $descriptionFixture = New-RepositoryFixture 'stale-readme-description'
    $descriptionPath = Join-Path $descriptionFixture 'README.md'
    $descriptionText = [IO.File]::ReadAllText($descriptionPath).Replace('Evaluates new product opportunities through demand, channels and economics before committing to build.', 'Obsolete description.')
    [IO.File]::WriteAllText($descriptionPath, $descriptionText)
    Assert-ValidatorFailure $descriptionFixture 'README title/description differs'

    $pluginManifest = Get-Content -LiteralPath (Join-Path $repositoryRoot 'plugins/product-discovery-suite/.codex-plugin/plugin.json') -Raw | ConvertFrom-Json
    $repositoryMetadata = Get-Content -LiteralPath (Join-Path $repositoryRoot '.github/repository-metadata.json') -Raw | ConvertFrom-Json
    $metadataCases = @(
        @{ Name='stale-plugin-homepage'; Path='plugins/product-discovery-suite/.codex-plugin/plugin.json'; Old=$repositoryMetadata.homepage; Message='Plugin homepage differs from repository metadata' }
        @{ Name='stale-plugin-long-description'; Path='plugins/product-discovery-suite/.codex-plugin/plugin.json'; Old='"longDescription": "' + $pluginManifest.description + '"'; Message='Host longDescription differs' }
        @{ Name='stale-readme-plugin-description'; Path='README.md'; Old=$pluginManifest.description; Message='README plugin title/description differs' }
        @{ Name='stale-marketplace-description'; Path='.claude-plugin/marketplace.json'; Old=$repositoryMetadata.description; Message='Marketplace description differs from repository metadata' }
    )
    foreach ($case in $metadataCases) {
        $fixture = New-RepositoryFixture $case.Name
        $path = Join-Path $fixture $case.Path
        $text = [IO.File]::ReadAllText($path)
        $replacement = if ($case.Name -eq 'stale-plugin-long-description') { '"longDescription": "Stale copy."' } else { 'Stale copy.' }
        Assert-Condition ($text.Contains($case.Old)) "Fixture source missing: $($case.Name)"
        [IO.File]::WriteAllText($path, $text.Replace($case.Old, $replacement))
        Assert-ValidatorFailure $fixture $case.Message
    }

    $policyFixture = New-RepositoryFixture 'contradictory-test-policy'
    $policyPath = Join-Path $policyFixture 'plugins/quality-assurance-suite/skills/ln-51-acceptance-test-builder/SKILL.md'
    $policyText = [IO.File]::ReadAllText($policyPath).Replace('Prefer E2E through user or external-system boundaries', 'Prefer unit tests for every implementation detail')
    [IO.File]::WriteAllText($policyPath, $policyText)
    Assert-ValidatorFailure $policyFixture 'shared rule differs from SKILL_TEMPLATE.md: Test value and boundary'

    $policyPlacementFixture = New-RepositoryFixture 'misplaced-test-policy'
    $policyPlacementPath = Join-Path $policyPlacementFixture 'plugins/delivery-planning-suite/skills/ln-31-delivery-plan-builder/SKILL.md'
    $policyPlacementText = [IO.File]::ReadAllText($policyPlacementPath)
    $policyLine = [regex]::Match($policyPlacementText, '(?m)^- \[ \] \*\*Test value and boundary:\*\*[^\r\n]*').Value
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($policyLine)) 'Fixture source is missing the test policy.'
    [IO.File]::WriteAllText($policyPlacementPath, $policyPlacementText.Replace($policyLine, '') + "`n" + $policyLine + "`n")
    Assert-ValidatorFailure $policyPlacementFixture 'shared rule is outside its domain checklist: Test value and boundary'

    $coverageFixture = New-RepositoryFixture 'missing-eval-coverage'
    $coverageEvalPath = (Resolve-Path -LiteralPath (Join-Path $coverageFixture 'plugins/operations-suite/evals')).Path
    $resolvedCoverageFixture = (Resolve-Path -LiteralPath $coverageFixture).Path
    Assert-Condition ($coverageEvalPath.StartsWith($resolvedCoverageFixture + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) 'Refusing to remove eval fixtures outside the disposable repository.'
    Remove-Item -LiteralPath $coverageEvalPath -Recurse -Force
    Assert-ValidatorFailure $coverageFixture 'has no eval case'

    $evalSkillFixture = New-RepositoryFixture 'mismatched-eval-skill'
    $evalPromptPath = Join-Path $evalSkillFixture 'plugins/implementation-suite/evals/ln-41-small-fix/prompt.md'
    $evalPromptText = [IO.File]::ReadAllText($evalPromptPath)
    Assert-Condition ($evalPromptText.Contains('Use the ln-41-surgical-change-implementer skill.')) 'Fixture source is missing the eval skill invocation.'
    [IO.File]::WriteAllText($evalPromptPath, $evalPromptText.Replace('Use the ln-41-surgical-change-implementer skill.', 'Use the ln-42-dependency-upgrader skill.'))
    Assert-ValidatorFailure $evalSkillFixture 'must invoke and grade the same skill'

    $verdictFixture = New-RepositoryFixture 'unknown-eval-verdict'
    $verdictGraderPath = Join-Path $verdictFixture 'plugins/implementation-suite/evals/ln-41-small-fix/graders/verdict.md'
    $verdictGraderText = [IO.File]::ReadAllText($verdictGraderPath)
    Assert-Condition ($verdictGraderText.Contains('DELIVERED')) 'Fixture source is missing the eval verdict token.'
    [IO.File]::WriteAllText($verdictGraderPath, $verdictGraderText.Replace('DELIVERED', 'SHIPPED'))
    Assert-ValidatorFailure $verdictFixture 'is not a shared vocabulary verdict'

    $expectedVerdictFixture = New-RepositoryFixture 'contradictory-expected-verdict'
    $expectedPromptPath = Join-Path $expectedVerdictFixture 'plugins/architecture-suite/evals/ln-25-stale-diagram-element/prompt.md'
    $expectedPromptText = [IO.File]::ReadAllText($expectedPromptPath)
    Assert-Condition ($expectedPromptText.Contains('Result INCOMPLETE')) 'Fixture source is missing its expected Result verdict.'
    [IO.File]::WriteAllText($expectedPromptPath, $expectedPromptText.Replace('Result INCOMPLETE', 'Result READY'))
    Assert-ValidatorFailure $expectedVerdictFixture 'expected_outcome verdict READY differs from its verdict grader'

    $linkFixture = New-RepositoryFixture 'broken-documentation-link'
    Add-Content -LiteralPath (Join-Path $linkFixture 'docs/token-efficiency.md') -Value '[Missing evidence](missing-evidence.md)'
    Assert-ValidatorFailure $linkFixture 'Missing documentation link in token-efficiency.md: missing-evidence.md'

    Write-Host "Repository baseline and validator regression checks passed."
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        $resolvedTemporaryRoot = (Resolve-Path -LiteralPath $temporaryRoot).Path
        Assert-Condition ($resolvedTemporaryRoot.StartsWith($temporaryParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) "Refusing to remove a temporary path outside the system temp directory."
        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
    }
}
