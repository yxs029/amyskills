$ErrorActionPreference = 'Stop'

Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
New-Item -ItemType Directory -Force -Path logs | Out-Null

# Load API key
$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable("MINIMAX_M3_API_KEY", "User")
if ($env:MINIMAX_M3_API_KEY.Length -lt 50) {
    Write-Output ("[FAIL] API Key length: " + $env:MINIMAX_M3_API_KEY.Length + ", expected ~125")
    exit 1
}
Write-Output ("[OK] API Key length: " + $env:MINIMAX_M3_API_KEY.Length)

# Probe arXiv
$probe = python logs\probe_arxiv.py
Write-Output ("[probe] arXiv: " + $probe)
if ($probe -ne "200") {
    $stillDown = $true
    for ($j=1; $j -le 3; $j++) {
        Start-Sleep -Seconds 15
        $probe2 = python logs\probe_arxiv.py
        Write-Output ("  re-probe " + $j + ": " + $probe2)
        if ($probe2 -eq "200") { $stillDown = $false; break }
    }
    if ($stillDown) {
        Write-Output "[FAIL] arXiv persistently down, aborting"
        exit 1
    }
}
Write-Output "[OK] arXiv OK"

# Launch pipeline via Start-Process so it survives this shell exit
$layer = "L1"
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$logFile = Join-Path "logs" ("$layer`_$ts.log")
$stdoutFile = Join-Path "logs" ("$layer`_$ts.stdout.log")
$argList = @("-u", "scripts\pipeline.py", "--layer", $layer, "--config", "config.yaml")

Write-Output ("[launch] Starting pipeline detached. Log: " + $logFile)
$proc = Start-Process -FilePath "python" -ArgumentList $argList -RedirectStandardOutput $stdoutFile -RedirectStandardError (Join-Path "logs" ("$layer`_$ts.stderr.log")) -NoNewWindow -PassThru
Write-Output ("[launch] PID: " + $proc.Id)
Write-Output ("[launch] stdout: " + $stdoutFile)
Write-Output ("[launch] DONE-PRE-FLIGHT")
