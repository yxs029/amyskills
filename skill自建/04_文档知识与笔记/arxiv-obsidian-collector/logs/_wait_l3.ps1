#!/usr/bin/env pwsh
# Monitor L3 pipeline by polling process + log file
# Exits when python process gone OR log shows "完成" / "导入"
$ErrorActionPreference = "Stop"
$logDir = "C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector\logs"
$vaultDir = "F:\软件测试\30AI技术知识树\arxivForAI\第三层-大模型组件层"

# Find latest nohup log
$log = Get-ChildItem "$logDir\L3_*nohup.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $log) { Write-Output "no log found"; exit 1 }
Write-Output "Monitoring log: $($log.FullName)"

# Find python process started after 14:06
$proc = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt "2026/9/9 14:06" } | Select-Object -First 1
if (-not $proc) { Write-Output "no python process found"; exit 1 }
Write-Output "Pipeline PID=$($proc.Id), start=$($proc.StartTime)"
$procId = $proc.Id

# Track initial .md count
$startCount = (Get-ChildItem $vaultDir -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt "2026/9/9 13:00" }).Count
Write-Output "Initial today's .md count: $startCount"

# Poll every 30s, up to 45 minutes (90 polls)
for ($i=1; $i -le 90; $i++) {
    Start-Sleep -Seconds 30
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if (-not $p) {
        Write-Output "[$i] Pipeline PID=$procId gone. Done."
        break
    }
    $now = Get-Date -Format "HH:mm:ss"
    $cpu = $p.CPU
    $ws = [math]::Round($p.WS/1MB, 1)
    $lines = (Get-Content $log.FullName -Encoding UTF8 -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    $newMd = (Get-ChildItem $vaultDir -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt "2026/9/9 13:00" }).Count - $startCount
    Write-Output "[$i] $now alive CPU=$cpu WS=${ws}M lines=$lines newMd=$newMd"
}

# Final state
Write-Output "=== FINAL LOG (last 60 lines) ==="
Get-Content $log.FullName -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -Last 60
Write-Output "=== NEW .md FILES (today) ==="
Get-ChildItem $vaultDir -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt "2026/9/9 13:00" } | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
