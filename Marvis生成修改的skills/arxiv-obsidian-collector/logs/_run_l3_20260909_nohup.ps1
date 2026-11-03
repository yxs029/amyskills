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

# ===== 3. 用 Start-Process 启动 pipeline,PowerShell 立即退出 =====
$layer = "L3"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = "logs\${layer}_${ts}_nohup.log"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "python"
$psi.Arguments = "-u scripts\pipeline.py --layer $layer --config config.yaml"
$psi.WorkingDirectory = (Get-Location).Path
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables["MINIMAX_M3_API_KEY"] = $env:MINIMAX_M3_API_KEY
$psi.EnvironmentVariables["SYSTEM_CA_CERTS"] = "C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"

$proc = [System.Diagnostics.Process]::Start($psi)
Write-Output "Pipeline started PID=$($proc.Id) log=$logPath"

# Async tail log to file via background reader
$outReader = $proc.StandardOutput
$errReader = $proc.StandardError

# Use jobs to read output streams and write to log
Start-Job -Name "stdout-tail-$($proc.Id)" -ScriptBlock {
    param($procId, $logPath)
    $proc = [System.Diagnostics.Process]::GetProcessById($procId)
    $reader = $proc.StandardOutput
    $writer = [System.IO.StreamWriter]::new($logPath, $false, [System.Text.Encoding]::UTF8)
    $writer.AutoFlush = $true
    while (-not $reader.EndOfStream) {
        $line = $reader.ReadLine()
        if ($null -ne $line) {
            $writer.WriteLine($line)
        }
    }
    $writer.Close()
} -ArgumentList $proc.Id, $logPath | Out-Null

Start-Job -Name "stderr-tail-$($proc.Id)" -ScriptBlock {
    param($procId, $logPath)
    $proc = [System.Diagnostics.Process]::GetProcessById($procId)
    $reader = $proc.StandardError
    $errPath = $logPath -replace '\.log$', '.err.log'
    $writer = [System.IO.StreamWriter]::new($errPath, $false, [System.Text.Encoding]::UTF8)
    $writer.AutoFlush = $true
    while (-not $reader.EndOfStream) {
        $line = $reader.ReadLine()
        if ($null -ne $line) {
            $writer.WriteLine($line)
        }
    }
    $writer.Close()
} -ArgumentList $proc.Id, $logPath | Out-Null

Write-Output "Detached. Pipeline PID=$($proc.Id) running independently. PowerShell exiting."
