# ASCII-only register script for arxiv-obsidian-collector.
# Reads prompt text from cron-prompts/arxiv-L{N}.txt to avoid PowerShell
# UTF-8 parser issues with embedded Chinese characters.

param(
    [switch]$Disable,
    [switch]$Unregister
)

$ErrorActionPreference = "Continue"
$agent = "mavis"
$skillRoot = "C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector"
$promptsDir = Join-Path $skillRoot "cron-prompts"

$layers = @(
    @{ Index = 1; File = "arxiv-L1.txt"; Schedule = "0 9 * * 1" }
    , @{ Index = 2; File = "arxiv-L2.txt"; Schedule = "0 9 * * 2" }
    , @{ Index = 3; File = "arxiv-L3.txt"; Schedule = "0 9 * * 3" }
    , @{ Index = 4; File = "arxiv-L4.txt"; Schedule = "0 9 * * 4" }
    , @{ Index = 5; File = "arxiv-L5.txt"; Schedule = "0 9 * * 5" }
)

function Remove-CronIfExists {
    param([string]$Name)
    & mavis cron delete $agent $Name 2>&1 | Out-Null
    return $LASTEXITCODE
}

if ($Unregister) {
    foreach ($entry in $layers) {
        $cronName = "arxiv-L$($entry.Index)"
        Remove-CronIfExists -Name $cronName
        Write-Host "x removed: $cronName"
    }
    Write-Host "`nuninstall done.`n" -ForegroundColor Green
    exit 0
}

foreach ($entry in $layers) {
    $cronName  = "arxiv-L$($entry.Index)"
    $promptFile = Join-Path $promptsDir $entry.File
    $prompt    = [System.IO.File]::ReadAllText($promptFile, [System.Text.Encoding]::UTF8)

    # Idempotent: delete any pre-existing cron with the same name first.
    Remove-CronIfExists -Name $cronName

    Write-Host "[L$($entry.Index)] creating  $cronName  schedule='$($entry.Schedule)'"

    if ($Disable) {
        & mavis cron create $agent $cronName `
            --schedule=$($entry.Schedule) `
            --prompt=$prompt `
            --timezone "Asia/Shanghai" `
            --disable | Out-Null
    } else {
        & mavis cron create $agent $cronName `
            --schedule=$($entry.Schedule) `
            --prompt=$prompt `
            --timezone "Asia/Shanghai" | Out-Null
    }
}

Write-Host "`nregistration done. list with:`n" -ForegroundColor Green
Write-Host "  mavis cron list $agent | findstr arxiv"
Write-Host "`nfire a test run now:`n"
Write-Host "  mavis cron trigger $agent arxiv-L1"
Write-Host ""
