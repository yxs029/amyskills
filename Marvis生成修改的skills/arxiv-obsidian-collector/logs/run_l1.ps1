$ErrorActionPreference = 'Stop'

Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
New-Item -ItemType Directory -Force -Path logs | Out-Null

$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable("MINIMAX_M3_API_KEY", "User")
if ($env:MINIMAX_M3_API_KEY.Length -lt 50) {
    Write-Error ("API Key abnormal (len " + $env:MINIMAX_M3_API_KEY.Length + "), expected 125")
    exit 1
}
Write-Output ("[OK] API Key length: " + $env:MINIMAX_M3_API_KEY.Length)

$probe = python logs\probe_arxiv.py
Write-Output ("[probe] arXiv: " + $probe)
if ($probe -ne "200") {
    Write-Output ("[warn] arXiv first probe not 200 (" + $probe + "), retry 3x with 15s gap...")
    $stillDown = $true
    for ($j=1; $j -le 3; $j++) {
        Start-Sleep -Seconds 15
        $probe2 = python logs\probe_arxiv.py
        Write-Output ("  re-probe " + $j + ": " + $probe2)
        if ($probe2 -eq "200") { $stillDown = $false; break }
    }
    if ($stillDown) {
        Write-Output "[FAIL] arXiv persistently unavailable, aborting"
        exit 1
    }
}
Write-Output "[OK] arXiv OK"

$layer = "L1"
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
python -u scripts\pipeline.py --layer $layer --config config.yaml 2>&1 | Tee-Object -FilePath ("logs\" + $layer + "_" + $ts + ".log")