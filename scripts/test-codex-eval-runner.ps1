[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'run-codex-evals.ps1')
$testParent = [IO.Path]::GetTempPath().TrimEnd([IO.Path]::DirectorySeparatorChar)
$testRoot = Join-Path $testParent ('codex-eval-regressions-' + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw $Message }
}

function Test-CaseGrader {
    param([string] $RelativePath, [hashtable] $Evidence)
    return Test-Grader (Join-Path $repositoryRoot $RelativePath) $Evidence @{}
}

New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $regexCount = 0
    foreach ($graderFile in Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'plugins') -Recurse -File -Filter '*.md' | Where-Object FullName -match '[\\/]evals[\\/][^\\/]+[\\/]graders[\\/]') {
        $fields = (Read-Frontmatter $graderFile.FullName).Fields
        if ($fields.type -eq 'regex') {
            [regex]::new($fields.pattern, (Get-RegexOptions $fields.flags)) | Out-Null
            $regexCount++
        }
        if ($fields.input_match) {
            [regex]::new($fields.input_match) | Out-Null
            $regexCount++
        }
    }
    $workspace = Join-Path $testRoot 'workspace'
    foreach ($directory in @('docs/adr', '.fixture', 'shop')) {
        New-Item -ItemType Directory -Path (Join-Path $workspace $directory) -Force | Out-Null
    }
    $evidence = @{ Workspace = $workspace; Trace = ''; LastMessage = ''; Created = @(); Commands = @(); Changes = @() }
    $adrPath = Join-Path $workspace 'docs/adr/0001-use-sqlite-for-stock-store.md'
    [IO.File]::WriteAllText($adrPath, "# ADR`n`n- Status: Accepted`n")
    $adrGrader = 'plugins/architecture-suite/evals/ln-24-proposed-supersession/graders/prior-decision-still-accepted.md'
    Assert-Condition (Test-CaseGrader $adrGrader $evidence).passed 'The Accepted status on a later line must match the m flag.'
    [IO.File]::WriteAllText($adrPath, "# ADR`n`n- Status: Superseded`n")
    Assert-Condition (-not (Test-CaseGrader $adrGrader $evidence).passed) 'A superseded ADR must fail the preservation grader.'
    $proposedPath = Join-Path $workspace 'docs/adr/0003-stock-store-postgresql.md'
    $proposedGrader = 'plugins/architecture-suite/evals/ln-24-proposed-supersession/graders/record-not-accepted.md'
    [IO.File]::WriteAllText($proposedPath, "# ADR 0003`n`n**Status**: Proposed`n")
    Assert-Condition (Test-CaseGrader $proposedGrader $evidence).passed 'The proposed status must be graded from the written record, including Markdown labels.'
    [IO.File]::WriteAllText($proposedPath, "# ADR 0003`n`n- Status: Accepted`n")
    Assert-Condition (-not (Test-CaseGrader $proposedGrader $evidence).passed) 'An unapproved Accepted status must fail even when no Write content is present in the trace.'

    $deployLog = Join-Path $workspace '.fixture/deployctl.log'
    $deployGrader = 'plugins/delivery-suite/evals/ln-63-prepared-vs-deployed/graders/no-apply-logged.md'
    [IO.File]::WriteAllText($deployLog, "deployctl plan staging => exit 0`ndeployctl apply staging => exit 0`n")
    Assert-Condition (-not (Test-CaseGrader $deployGrader $evidence).passed) 'A forbidden apply after the first log line must fail.'
    [IO.File]::WriteAllText($deployLog, "deployctl validate staging => exit 0`ndeployctl plan staging => exit 0`n")
    Assert-Condition (Test-CaseGrader $deployGrader $evidence).passed 'Preparation without apply must pass.'
    $combined = Get-RegexOptions 'ismg'
    Assert-Condition ([regex]::Matches("intro`nSTART`nend", '^start.*end$', $combined).Count -eq 1) 'Combined i/m/s/g flags must preserve matching behavior.'
    $unsupportedRejected = $false
    try { Get-RegexOptions 'y' | Out-Null } catch { $unsupportedRejected = $true }
    Assert-Condition $unsupportedRejected 'Unsupported flags must fail instead of silently changing a grader.'

    $productPath = Join-Path $workspace 'shop/checkout.py'
    [IO.File]::WriteAllText($productPath, 'safe')
    $before = Get-WorkspaceSnapshot $workspace
    Set-Content -LiteralPath $productPath -Value 'unsafe'
    Set-Content -LiteralPath (Join-Path $workspace 'shop/new.py') -Value 'new product code'
    Remove-Item -LiteralPath $adrPath
    $after = Get-WorkspaceSnapshot $workspace
    $evidence.Commands = @('Set-Content -LiteralPath shop/checkout.py -Value unsafe')
    $evidence.Changes = @(Get-ObservedChanges $workspace $before $after @())
    Assert-Condition (@($evidence.Changes | Where-Object { $_.path -eq 'docs/adr/0001-use-sqlite-for-stock-store.md' -and $_.kind -eq 'delete' }).Count -eq 1) 'Deleted files must be observed.'
    Assert-Condition (-not (Test-CaseGrader 'plugins/operations-suite/evals/ln-71-read-only-boundary/graders/no-edit.md' $evidence).passed) 'A shell modification must fail a read-only edit boundary.'
    Assert-Condition (-not (Test-CaseGrader 'plugins/operations-suite/evals/ln-71-read-only-boundary/graders/no-write.md' $evidence).passed) 'A shell addition must fail a read-only write boundary.'

    $evidence.Changes = @(Get-ObservedChanges 'D:\temp\workspace' @{} @{} @(@{ kind = 'update'; path = 'D:\temp\workspace\shop\checkout.py' }))
    Assert-Condition ($evidence.Changes[0].path -ceq 'shop/checkout.py') 'Windows event paths must become workspace-relative paths.'
    Assert-Condition (-not (Test-CaseGrader 'plugins/quality-assurance-suite/evals/ln-51-failing-product-acceptance/graders/product-not-edited.md' $evidence).passed) 'A Windows product edit must fail the product-code boundary.'
    $evidence.Changes = @(Get-ObservedChanges 'D:\temp\workspace' @{} @{} @(@{ kind = 'update'; path = 'D:\temp\workspace\docs\design\flow.md' }))
    Assert-Condition (Test-CaseGrader 'plugins/product-discovery-suite/evals/ln-13-ux-recovery/graders/edits-only-design-docs.md' $evidence).passed 'An authorized Windows design edit must remain allowed.'
    $evidence.Changes = @(Get-ObservedChanges $workspace $after $after @(@{ kind = 'update'; path = $productPath }))
    Assert-Condition (-not (Test-CaseGrader 'plugins/operations-suite/evals/ln-71-read-only-boundary/graders/no-edit.md' $evidence).passed) 'A reverted edit event must remain visible even with equal final snapshots.'
    Assert-Condition (@(Get-ObservedChanges $workspace $after $after @()).Count -eq 0) 'An unchanged workspace must not invent mutations.'
    $evidence.Changes = @(@{ kind = 'update'; path = '.fixture/opsctl.log' })
    Assert-Condition (Test-CaseGrader 'plugins/operations-suite/evals/ln-71-read-only-boundary/graders/no-edit.md' $evidence).passed 'The fixture status command may append its own invocation log.'
    $evidence.Changes += @{ kind = 'update'; path = 'config/production.yaml' }
    Assert-Condition (-not (Test-CaseGrader 'plugins/operations-suite/evals/ln-71-read-only-boundary/graders/no-edit.md' $evidence).passed) 'Allowing the diagnostic log must not allow a production configuration edit.'

    $passingGraders = @([pscustomobject]@{ scored = $true; passed = $true; weight = 1.0 })
    foreach ($runError in @('timed out after 900s', 'codex exit 1', 'scaffold failed with exit 1')) {
        $failedRun = Get-RunResult 1 $passingGraders $runError $null
        Assert-Condition ($failedRun.score -eq 0 -and $failedRun.error -ceq $runError) 'Execution errors must score zero and retain their reason.'
        $failedCase = @{ runs = @($failedRun); score = 1.0 }
        Assert-Condition (Test-EvalCaseFailure $failedCase 0.0) 'A run error must fail the case even at a zero score threshold.'
    }
    $goodRun = Get-RunResult 1 $passingGraders '' $null
    Assert-Condition ($goodRun.score -eq 1 -and -not (Test-EvalCaseFailure @{ runs = @($goodRun); score = 1.0 } 1.0)) 'An error-free passing case must remain successful.'
    Assert-Condition (Test-EvalCaseFailure @{ runs = @($goodRun); score = 0.5 } 0.8) 'A below-threshold case must remain unsuccessful.'
    $evidence.RunError = 'scaffold failed with exit 1'
    $failedJudge = Test-CaseGrader 'plugins/implementation-suite/evals/ln-41-small-fix/graders/discount-proven.md' $evidence
    Assert-Condition (-not $failedJudge.passed -and $failedJudge.detail -eq 'judge skipped: execution failed') 'An invalid run must fail without spending a paid judge call.'
    $evidence.Remove('RunError')

    # Exercise the production judge loop with offline host responses, including stale and failed votes.
    $originalInvokeCodex = (Get-Item Function:\Invoke-Codex).ScriptBlock
    $originalRunRoot = $runRoot
    $runRoot = Join-Path $testRoot 'judges'
    New-Item -ItemType Directory -Path $runRoot | Out-Null
    $JudgeVotes = 3
    function Invoke-Codex {
        param([string[]] $Arguments, [string] $Prompt, [hashtable] $Environment, [int] $TimeoutSeconds)
        $outputIndex = [Array]::IndexOf($Arguments, '-o') + 1
        $outputFile = $Arguments[$outputIndex]
        Assert-Condition (-not (Test-Path -LiteralPath $outputFile)) 'Every judge vote must start without the previous verdict file.'
        $step = $script:judgeResponses.Dequeue()
        if ($step.ContainsKey('verdict')) { $step.verdict | ConvertTo-Json | Set-Content -LiteralPath $outputFile -Encoding utf8 }
        return @{ Stdout = ''; Error = $step.error }
    }
    try {
        $yes = @{ verdict = @{ pass = $true; reason = 'observable outcome holds' } }
        $no = @{ verdict = @{ pass = $false; reason = 'observable outcome fails' } }
        $judgeCases = @(
            @{ steps = @($yes, $yes, $no); pass = $true; error = $false },
            @{ steps = @($no, $yes, $no); pass = $false; error = $false },
            @{ steps = @($yes, @{ error = 'API unavailable' }, $yes); pass = $false; error = $true },
            @{ steps = @($yes, @{}, $yes); pass = $false; error = $true },
            @{ steps = @($yes, @{ verdict = @{ pass = 'false'; reason = 'invalid boolean' } }, $yes); pass = $false; error = $true }
        )
        foreach ($judgeCase in $judgeCases) {
            $script:judgeResponses = [Collections.Queue]::new()
            foreach ($step in $judgeCase.steps) { $script:judgeResponses.Enqueue($step) }
            $judgment = Invoke-Judge 'Grade the observed outcome.' 'offline evidence' @{}
            Assert-Condition ($judgment.Passed -eq $judgeCase.pass -and [bool]$judgment.Error -eq $judgeCase.error) 'Judge errors and missing/invalid verdicts must not become a passing majority.'
            if ($judgment.Error) {
                $judgeRun = Get-RunResult 1 $passingGraders $judgment.Error $null
                Assert-Condition (Test-EvalCaseFailure @{ runs = @($judgeRun); score = $judgeRun.score } 0.0) 'A judge failure must fail the case even at a zero score threshold.'
            }
        }
    } finally {
        Set-Item Function:\Invoke-Codex -Value $originalInvokeCodex
        $runRoot = $originalRunRoot
        $JudgeVotes = 1
    }

    # Execute the actual changed fixture and its independent oracle; a removed '+' alone is insufficient.
    $checkoutRoot = Join-Path $testRoot 'checkout'
    New-Item -ItemType Directory -Path $checkoutRoot | Out-Null
    $fixtureShell = if ($IsWindows) { Join-Path (Split-Path (Split-Path (Get-Command git).Source)) 'bin/bash.exe' } else { (Get-Command bash).Source }
    $python = if ($IsWindows) { (Get-Command python).Source } else { (Get-Command python3).Source }
    Push-Location $checkoutRoot
    try {
        & $fixtureShell ((Join-Path $repositoryRoot 'plugins/implementation-suite/evals/ln-41-small-fix/fixture.sh').Replace('\', '/')) *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The pricing fixture must scaffold successfully.'
        $oraclePath = Join-Path $checkoutRoot 'checks/verify_pricing.py'
        $oracleHash = (Get-FileHash -LiteralPath $oraclePath).Hash
        $checkoutEvidence = @{ Workspace = $checkoutRoot; Trace = ''; LastMessage = ''; Created = @(); Commands = @(); Changes = @() }
        $exactGrader = 'plugins/implementation-suite/evals/ln-41-small-fix/graders/exact-totals.md'
        & $python $oraclePath *> $null
        Assert-Condition ($LASTEXITCODE -ne 0 -and -not (Test-CaseGrader $exactGrader $checkoutEvidence).passed) 'The original surcharge must fail the exact checkout oracle.'

        $pricingPath = Join-Path $checkoutRoot 'shop/pricing.py'
        $originalPricing = [IO.File]::ReadAllText($pricingPath)
        Assert-Condition ($originalPricing.Contains('(gross + discount)')) 'The fixture must contain the original calculation defect.'
        [IO.File]::WriteAllText($pricingPath, $originalPricing.Replace('(gross + discount)', '(gross - 2 * discount)'))
        & $python -m unittest *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The wrong double discount reproducer must pass the old rounding/order tests.'
        & $python $oraclePath *> $null
        $doubleDiscount = Get-Content -LiteralPath 'results/discount.json' -Raw | ConvertFrom-Json
        Assert-Condition ($LASTEXITCODE -ne 0 -and $doubleDiscount.ten_percent_line -ceq '80.00' -and -not (Test-CaseGrader $exactGrader $checkoutEvidence).passed) 'An 80.00 double discount must fail despite removing the old defect syntax.'

        [IO.File]::WriteAllText($pricingPath, $originalPricing.Replace('(gross + discount)', '(gross - discount)'))
        & $python $oraclePath *> $null
        Assert-Condition ($LASTEXITCODE -eq 0 -and (Test-CaseGrader $exactGrader $checkoutEvidence).passed) 'Correct discount, quantity, order and rounding totals must pass.'
        & $python -m unittest *> $null
        Assert-Condition ($LASTEXITCODE -eq 0 -and (Get-FileHash -LiteralPath $oraclePath).Hash -ceq $oracleHash) 'The correct fix must preserve existing behavior and the supplied oracle.'
    } finally { Pop-Location }

    $lookupRoot = Join-Path $testRoot 'lookup-budget'
    New-Item -ItemType Directory -Path $lookupRoot | Out-Null
    Push-Location $lookupRoot
    try {
        & $fixtureShell ((Join-Path $repositoryRoot 'plugins/implementation-suite/evals/ln-44-target-unmet/fixture.sh').Replace('\', '/')) *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The unmet-target fixture must scaffold successfully.'
        & $python 'bench/bench_export.py' *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The original lookup benchmark must execute.'
        $optimizedExport = @'
def export_catalog(store, skus):
    rows = []
    for sku in skus:
        item = store.fetch_sku(sku)
        rows.append(f'{sku};{item["name"]};{item["stock"]}\n')
    return "".join(rows)
'@
        [IO.File]::WriteAllText((Join-Path $lookupRoot 'catalog/export.py'), $optimizedExport + "`n")
        & $python 'bench/bench_export.py' *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The retained lookup benchmark must execute.'
        $lookupRecords = @(Get-Content -LiteralPath '.fixture/bench-export.jsonl' | ForEach-Object { $_ | ConvertFrom-Json })
        Assert-Condition ($lookupRecords.Count -eq 2 -and $lookupRecords[0].lookups -eq 20 -and $lookupRecords[1].lookups -eq 10) 'The benchmark must record actual baseline and final counts independently of CLI stdout.'
        Assert-Condition ($lookupRecords[0].report_sha256 -ceq $lookupRecords[1].report_sha256 -and $lookupRecords[0].export_sha256 -cne $lookupRecords[1].export_sha256) 'The safe 2x gain must preserve the report and bind measurements to distinct implementations.'
        & $python -m unittest *> $null
        Assert-Condition ($LASTEXITCODE -eq 0) 'The retained partial gain must preserve catalog behavior.'
    } finally { Pop-Location }

    Write-Host "Codex eval runner regression checks passed ($regexCount grader patterns, real graders, file mutations, paths and run errors; no model calls)."
} finally {
    $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).Path
    if (-not $resolvedTestRoot.StartsWith($testParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside the system temp directory.' }
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
