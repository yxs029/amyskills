# ===== 0. 切到 skill 目录 =====
Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
New-Item -ItemType Directory -Force -Path logs | Out-Null

# ===== 1. 加载并验证 API Key(必须和 pipeline 在同一个 shell!) =====
$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable("MINIMAX_M3_API_KEY", "User")
if ($env:MINIMAX_M3_API_KEY.Length -lt 50) {
    Write-Error "API Key 异常(长度 $($env:MINIMAX_M3_API_KEY.Length)),应为 125 字符。检查 User-env 或呼用户。"
    exit 1
}
Write-Output "API Key OK, length: $($env:MINIMAX_M3_API_KEY.Length)"

# ===== 2. Probe arXiv 是否可用 =====
$probe = python logs\_probe_arxiv.py
Write-Output "arXiv probe exit: $probe"
$probeCode = $LASTEXITCODE
if ($probeCode -ne 0) {
    Write-Output "arXiv 首次 probe 失败(exit=$probeCode),快速再 probe 3 次确认(间隔 15s)..."
    $stillDown = $true
    for ($j=1; $j -le 3; $j++) {
        Start-Sleep -Seconds 15
        $probe2 = python logs\_probe_arxiv.py
        Write-Output ("re-probe {0}: exit={1}" -f $j, $probe2)
        if ($LASTEXITCODE -eq 0) { $stillDown = $false; break }
    }
    if ($stillDown) {
        Write-Output "arXiv 持续不可用,按用户'失败 3 次停'规则,本轮放弃 + 设 cron-once 1.5h 后重试"
        exit 1
    }
}
Write-Output "arXiv OK"

# ===== 3. 跑 pipeline(-u unbuffered 确保日志实时落盘) =====
$layer = "L5"
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
python -u scripts\pipeline.py --layer $layer --config config.yaml 2>&1 | Tee-Object -FilePath "logs\${layer}_$ts.log"
