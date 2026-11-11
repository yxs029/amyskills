$ErrorActionPreference = "Stop"
Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
New-Item -ItemType Directory -Force -Path logs | Out-Null

# ===== 1. 加载并验证 API Key =====
$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable("MINIMAX_M3_API_KEY", "User")
if ($env:MINIMAX_M3_API_KEY.Length -lt 50) {
    Write-Error "API Key 异常(长度 $($env:MINIMAX_M3_API_KEY.Length))"
    exit 1
}
Write-Output "OK API Key length: $($env:MINIMAX_M3_API_KEY.Length)"

# ===== 2. Probe arXiv =====
$probe = python -c "import requests; r=requests.get('https://export.arxiv.org/api/query',params={'search_query':'all:cat','max_results':2},timeout=20,verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'); print(r.status_code)"
Write-Output "arXiv probe: $probe"
if ($probe -ne "200") {
    Write-Output ("arXiv probe non-200, retry x3 with 15s gap")
    $stillDown = $true
    for ($j=1; $j -le 3; $j++) {
        Start-Sleep -Seconds 15
        $probe2 = python -c "import requests; r=requests.get('https://export.arxiv.org/api/query',params={'search_query':'all:cat','max_results':2},timeout=20,verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'); print(r.status_code)"
        Write-Output ("  re-probe ${j}: $probe2")
        if ($probe2 -eq "200") { $stillDown = $false; break }
    }
    if ($stillDown) {
        Write-Output "arXiv 持续不可用,本轮放弃"
        exit 1
    }
}
Write-Output "OK arXiv"

# ===== 3. 跑 pipeline =====
$layer = "L3"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
python -u scripts\pipeline.py --layer $layer --config config.yaml 2>&1 | Tee-Object -FilePath "logs\${layer}_$ts.log"
