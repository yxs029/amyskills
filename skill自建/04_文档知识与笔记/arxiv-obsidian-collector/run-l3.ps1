$ErrorActionPreference = 'Stop'

# 1. 从 8/11 session jsonl 抽 M3 key(完整 125 字符)
$keyFile = 'C:\Users\AaronMY\.minimax\v2\sessions\2026\08\11\09-00-01-064-session_bXZzXzA1NWUyNGMxYTI3ZTQ2ZWM4Nzk0OGQ0YjE4ZWQzMDMz\display.jsonl'
if (-not (Test-Path $keyFile)) {
    Write-Error "Key file not found: $keyFile"
    exit 1
}
$key = (Get-Content $keyFile -TotalCount 5 -Encoding utf8 |
    Select-String -Pattern 'sk-cp-[A-Za-z0-9_-]{20,}' |
    Select-Object -First 1).Matches[0].Value
Write-Host "Extracted M3 key, length=$($key.Length)"

# 2. 写到 Process env(只对当前 ps1 进程及子进程生效,不持久)
$env:MINIMAX_M3_API_KEY = $key

# 3. 切到 skill 目录
Set-Location 'C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector'

# 4. 准备日志路径
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$logBase = "logs\L3_$ts"
$outLog = "$logBase.out"
$errLog = "$logBase.err"
Write-Host "Log files: $outLog, $errLog"

# 5. 用 Start-Process 启动 python,RedirectStandardOutput/Error 写到磁盘
#    python -u 强制 unbuffered,否则 stdout 不会及时落盘
$proc = Start-Process -FilePath 'python' `
    -ArgumentList @('-u', 'scripts\pipeline.py', '--layer', 'L3', '--config', 'config.yaml') `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -NoNewWindow -PassThru -WorkingDirectory (Get-Location)

Write-Host "Started python PID=$($proc.Id)"

# 6. 等进程结束,定期 poll
#    bash tool background task 有 30 分钟 maxRunMs 硬限制
#    在 25 分钟主动 self-terminate,留 5 分钟缓冲给 background task 干净退出
#    pipeline 自身有断点续跑,下次启动会跳过已下 PDF/已生成 md
$softTimeout = New-TimeSpan -Minutes 25
$hardTimeout = New-TimeSpan -Minutes 28
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited) {
    Start-Sleep -Seconds 15
    $elapsed = $sw.Elapsed
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] PID $($proc.Id) running, elapsed=$([int]$elapsed.TotalMinutes)m CPU=$($proc.CPU)s"
    if ($elapsed -gt $softTimeout) {
        Write-Warning "Soft timeout 25min reached, gracefully killing pipeline (断点续跑)..."
        $proc | Stop-Process -Force
        Start-Sleep -Seconds 3
        break
    }
    if ($elapsed -gt $hardTimeout) {
        Write-Warning "Hard timeout 28min, force-killing"
        $proc | Stop-Process -Force
        break
    }
}

Write-Host "Pipeline exit code: $($proc.ExitCode)"
exit $proc.ExitCode
