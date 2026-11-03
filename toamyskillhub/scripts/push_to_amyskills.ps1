<#
.SYNOPSIS
  toamyskillhub - Plan, confirm, then publish/sync a local skill library to the amyskills GitHub repo.

.DESCRIPTION
  SAFE-BY-DEFAULT flow:
    Phase 1 PLAN   : build upload manifest (compare source vs staging by mtime+size, or vs
                     REMOTE repo by git blob hash with -DeepCompare; name-collision check;
                     oversize exclusions; secret scan) -> print + save
    Phase 2 CONFIRM: script exits with code 3 until -Confirmed is passed (agent must ask user)
    Phase 3 EXECUTE: robocopy -> commit -> push (proxy fallback + auto-rebase) -> verify SHA

  Modes:
    -PlanOnly            : build & save manifest only (read-only, safe)
    (no switch)          : same as -PlanOnly, then exit 3 = "waiting for user confirmation"
    -Confirmed           : manifest + execute the upload (only after user said yes)
    -DryRun              : quick config/proxy preview (legacy)

.EXAMPLE
  .\push_to_amyskills.ps1 -SourceDir "D:\MySkills" -PlanOnly
.EXAMPLE
  .\push_to_amyskills.ps1 -SourceDir "D:\MySkills" -Confirmed
#>
[CmdletBinding()]
param(
  [string]$SourceDir,
  [string]$TargetRepo = "https://github.com/yxs029/amyskills.git",
  [string]$StageDir,
  [string]$Branch = "main",
  [string]$Proxy = "auto",          # auto | none | http://127.0.0.1:7892
  [string]$IdentityName = "yxs029",
  [string]$IdentityEmail = "yxs029@users.noreply.github.com",
  [string]$CommitMessage,
  [string[]]$ExcludeDirs = @("__pycache__", ".git", "node_modules", ".venv", "venv"),
  [string]$ManifestPath,
  [switch]$GenerateReadme,
  [switch]$Mirror,
  [switch]$PlanOnly,
  [switch]$Confirmed,
  [switch]$DeepCompare,
  [switch]$DryRun
)

$script:MaxFileBytes = 104857600   # GitHub hard limit: 100MB per file
$script:WarnFileBytes = 52428800   # GitHub soft warning: 50MB
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---------- helpers ----------
function Write-Step([string]$msg)  { Write-Host "[toamyskillhub] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)    { Write-Host "[toamyskillhub] $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg) { Write-Host "[toamyskillhub] WARN: $msg" -ForegroundColor Yellow }
function Write-Die([string]$msg)   { Write-Host "[toamyskillhub] ERROR: $msg" -ForegroundColor Red; exit 2 }

# Run git safely on PS 5.1: merge stderr into output (EAP=Continue => no NativeCommandError throw),
# and ALWAYS run inside $WorkingDir via `git -C` (never rely on the caller's CWD).
# NOTE: config switches like `-c http.proxy=...` must come BEFORE the subcommand.
function Invoke-Git {
  param([string[]]$GitArgs, [string]$WorkingDir)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $fullArgs = @()
    if ($WorkingDir) { $fullArgs += @("-C", $WorkingDir) }
    $fullArgs += $GitArgs
    $output = & git @fullArgs 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  return [pscustomobject]@{ Code = $code; Out = (($output | Where-Object { $_ }) -join "`n").Trim(); Err = "" }
}

function Test-TcpPort([string]$HostName, [int]$Port) {
  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(900) -and $client.Connected) { return $true } else { return $false }
  } catch { return $false } finally { $client.Close() }
}

# Read Windows system proxy from registry (ProxyServer may be "host:port" or "http=..;https=..").
function Get-SystemProxy {
  try {
    $k = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -ErrorAction Stop
    if (-not $k.ProxyEnable) { return $null }
    $s = $k.ProxyServer
    if (-not $s) { return $null }
    if ($s -match ";") {
      foreach ($part in ($s -split ";")) {
        if ($part -match "^(https?)=(.+)$") { return ("http://" + $Matches[2]) }
      }
      return $null
    }
    if ($s -notmatch "^https?://") { $s = "http://" + $s }
    return $s
  } catch { return $null }
}

# Network transport args for git (config switches, must precede subcommand).
function Get-NetArgs {
  if ($script:Proxy -eq "none") { return @() }
  if ($script:Proxy -ne "auto") { return @("-c", "http.proxy=$script:Proxy", "-c", "https.proxy=$script:Proxy") }
  $p = Get-SystemProxy
  if ($p) {
    $parts = ($p -replace "^https?://", "") -split ":"
    if (Test-TcpPort -HostName $parts[0] -Port ([int]$parts[1])) {
      return @("-c", "http.proxy=$p", "-c", "https.proxy=$p")
    }
  }
  return @()
}

# Extract name + description from a SKILL.md YAML frontmatter (supports > | multiline blocks).
function Get-SkillMeta([string]$Path) {
  $lines = Get-Content -Path $Path -TotalCount 40 -Encoding UTF8
  $name = ""; $desc = ""; $inDesc = $false; $fmCount = 0
  foreach ($l in $lines) {
    if ($l -match '^---\s*$') { $fmCount++; if ($fmCount -ge 2) { break }; continue }
    if ($l -match '^name:\s*(.+?)\s*$') { $name = $Matches[1].Trim('"', "'"); continue }
    if ($l -match '^description:\s*(.*?)\s*$') {
      $v = $Matches[1].Trim()
      if ($v -match '^[>|][+-]*$') { $inDesc = $true } else { $desc = $v }
      continue
    }
    if ($inDesc) {
      if ($l -match '^\S') { break }
      $t = $l.Trim()
      if ($t) { if ($desc) { $desc += " " }; $desc += $t }
      if ($desc.Length -gt 300) { break }
    }
  }
  if (-not $name) { $name = (Split-Path (Split-Path $Path -Parent) -Leaf) }
  $desc = ($desc -replace '\|', '\|') -replace '\s+', ' '
  if ($desc.Length -gt 180) { $desc = $desc.Substring(0, 180) + "..." }
  if (-not $desc) { $desc = "-" }
  return [pscustomobject]@{ Name = $name; Desc = $desc; Path = $Path }
}

# Git blob hash (sha1 of "blob <size>\0" + content), computed natively to avoid encoding pitfalls.
function Get-BlobHash([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  $sha = [System.Security.Cryptography.SHA1]::Create()
  try {
    $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)" + [char]0)
    $sha.TransformBlock($header, 0, $header.Length, $null, 0) | Out-Null
    $sha.TransformFinalBlock($bytes, 0, $bytes.Length) | Out-Null
    return ([System.BitConverter]::ToString($sha.Hash) -replace '-', '').ToLower()
  } finally { $sha.Dispose() }
}

# ---------- resolve params ----------
if (-not $SourceDir) { $SourceDir = $env:AMS_SOURCE_DIR }
if (-not $SourceDir) { $SourceDir = "F:\OPRASE-AMY\08AI操作系统\MySkills" }
if (-not $StageDir)  { $StageDir = $env:AMS_STAGE_DIR }
if (-not $StageDir)  { $StageDir = Join-Path $env:USERPROFILE "amyskills-stage" }
if (-not $CommitMessage) {
  $CommitMessage = "chore: sync skills from {0} ({1})" -f (Split-Path $SourceDir -Leaf), (Get-Date -Format "yyyy-MM-dd HH:mm")
}
if (-not $ManifestPath) { $ManifestPath = Join-Path $env:TEMP "toamyskillhub-manifest-latest.md" }

$resolved = Resolve-Path -LiteralPath $SourceDir -ErrorAction SilentlyContinue
if (-not $resolved) { Write-Die "SourceDir not found. Pass -SourceDir or set AMS_SOURCE_DIR." }
$SourceDir = $resolved.Path.TrimEnd('\')
$StageDir  = $StageDir.TrimEnd('\')
if (($StageDir + '\').StartsWith($SourceDir + '\', 'OrdinalIgnoreCase')) {
  Write-Die "StageDir must not live inside SourceDir (would recurse)."
}
if (-not $TargetRepo.EndsWith(".git")) { $TargetRepo = $TargetRepo + ".git" }
$gitDir = Join-Path $StageDir ".git"

Write-Step "Source : $SourceDir"
Write-Step "Stage  : $StageDir"
Write-Step "Repo   : $TargetRepo (branch $Branch) | mode: $(if ($Confirmed) { 'EXECUTE(-Confirmed)' } else { 'PLAN (no upload until -Confirmed)' })"

# ---------- scan source ----------
$skillFiles = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -Filter "SKILL.md" -File -ErrorAction SilentlyContinue)
$skillDirs  = @($skillFiles | ForEach-Object { $_.Directory.FullName })
$pkgFiles   = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -in ".zip", ".skill" })
$allFiles   = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { -not ($_.FullName -split '\\' | Where-Object { $ExcludeDirs -ccontains $_ }) })
$oversize   = @($allFiles | Where-Object { $_.Length -gt $script:MaxFileBytes })
$bigWarn    = @($allFiles | Where-Object { $_.Length -gt $script:WarnFileBytes -and $_.Length -le $script:MaxFileBytes })
$hashable   = @($allFiles | Where-Object { $_.Length -le $script:MaxFileBytes })
Write-Step ("Scan: {0} SKILL.md, {1} packages, {2} files total (excluded >100MB: {3})." -f $skillFiles.Count, $pkgFiles.Count, $allFiles.Count, $oversize.Count)

# ---------- remote state ----------
$remoteAvailable = $false; $remoteAhead = -1; $remoteMap = @{}
$netArgs = @(Get-NetArgs)
$proxyNote = if ($netArgs.Count -gt 0) { ($netArgs[1] -replace '^http\.proxy=', '') } else { "direct" }
if (Test-Path $gitDir) {
  $f1 = Invoke-Git ($netArgs + @("fetch", "origin")) $StageDir
  if ($f1.Code -ne 0 -and $netArgs.Count -gt 0) {
    Write-Warn2 "Fetch via proxy failed; trying direct..."
    $netArgs = @()
    $f1 = Invoke-Git @("fetch", "origin") $StageDir
  } elseif ($f1.Code -ne 0) {
    $p2 = Get-SystemProxy
    if ($p2) { $netArgs = @("-c", "http.proxy=$p2", "-c", "https.proxy=$p2"); $f1 = Invoke-Git ($netArgs + @("fetch", "origin")) $StageDir }
  }
  if ($f1.Code -eq 0) {
    $remoteAvailable = $true
    $cnt = Invoke-Git ($netArgs + @("rev-list", "--count", "HEAD..origin/$Branch")) $StageDir
    if ($cnt.Code -eq 0) { [void]([int]::TryParse($cnt.Out.Trim(), [ref]$remoteAhead)) }
  } else {
    Write-Warn2 "Fetch failed: $($f1.Out). Will compare against local staging only (weaker)."
  }
  if ($remoteAvailable) {
    $ls = Invoke-Git (@("-c", "core.quotepath=false", "ls-tree", "-r", "origin/$Branch")) $StageDir
    foreach ($line in ($ls.Out -split "`n")) {
      if ($line -match "^160000\s+commit\s+") { continue }  # ignore submodule entries
      $ti = $line.IndexOf("`t")
      if ($ti -lt 0) { continue }
      $meta = $line.Substring(0, $ti)
      $path = $line.Substring($ti + 1).Trim()
      if ($meta -match "^\d+\s+blob\s+([0-9a-f]{40})$") { $remoteMap[$path] = $Matches[1] }
    }
    Write-Step ("Remote reachable. origin/{0} tree: {1} blobs; ahead-of-stage commits: {2}." -f $Branch, $remoteMap.Count, $(if ($remoteAhead -ge 0) { $remoteAhead } else { "?" }))
  }
} else {
  Write-Step "No staging repo yet (first publish). Everything counts as new."
}

# ---------- build units & compare ----------
# Default: compare by modification time + size against the staging tree (robocopy preserves
# source mtimes, so equal mtime+size == already synced). Fast (<15s for 1400+ files).
# -DeepCompare: additionally compute git-blob SHA1 per file and diff against the remote tree.
$units = New-Object System.Collections.Generic.List[object]
$unitIndex = @{}
$sourceRelSet = @{}
$sortedDirs = @($skillDirs | Sort-Object { $_.Length } -Descending)  # deepest first -> nearest ancestor wins

foreach ($f in $hashable) {
  $rel = $f.FullName.Substring($SourceDir.Length + 1).Replace('\', '/')
  $sourceRelSet[$rel] = $f
  $isPkg = $f.Extension -in ".zip", ".skill"
  $unitDir = $null
  if (-not $isPkg) {
    foreach ($d in $sortedDirs) {
      if ($f.FullName.StartsWith($d + '\', 'OrdinalIgnoreCase')) { $unitDir = $d; break }
    }
  }
  if ($isPkg) { $unitKey = "PKG:" + $rel }
  elseif ($unitDir) { $unitKey = "SKILL:" + $unitDir.Substring($SourceDir.Length + 1) }
  else { $unitKey = "ROOT" }   # loose files at source root
  $hash = if ($DeepCompare -and $remoteAvailable) { Get-BlobHash -Path $f.FullName } else { $null }
  $fileRec = [pscustomobject]@{ Rel = $rel; Hash = $hash; LastMod = $f.LastWriteTime; Size = $f.Length }
  if ($unitIndex.ContainsKey($unitKey)) {
    $u = $unitIndex[$unitKey]
    $u.Files += $fileRec
    if ($fileRec.LastMod -gt $u.LastMod) { $u.LastMod = $fileRec.LastMod }
  } else {
    $u = [pscustomobject]@{
      Key = $unitKey; Type = $unitKey.Substring(0, 4).TrimEnd(':'); Files = @($fileRec)
      LastMod = $fileRec.LastMod
    }
    $unitIndex[$unitKey] = $u
    $units.Add($u)
  }
}

function Compare-Unit($unit) {
  $new = 0; $chg = 0; $same = 0
  if ($DeepCompare -and $remoteAvailable) {
    foreach ($f in $unit.Files) {
      if (-not $remoteMap.ContainsKey($f.Rel)) { $new++ }
      elseif ($f.Hash -and $remoteMap[$f.Rel] -ne $f.Hash) { $chg++ }
      else { $same++ }
    }
  } elseif (Test-Path $gitDir) {
    foreach ($f in $unit.Files) {
      $p = Join-Path $StageDir ($f.Rel.Replace('/', '\'))
      if (-not (Test-Path $p)) { $new++ }
      else {
        $i = Get-Item $p
        if ([Math]::Abs(($i.LastWriteTimeUtc - $f.LastMod.ToUniversalTime()).TotalSeconds) -gt 2 -or $i.Length -ne $f.Size) { $chg++ } else { $same++ }
      }
    }
  } else {
    return [pscustomobject]@{ Action = "新增"; New = $unit.Files.Count; Changed = 0; Same = 0 }
  }
  $action = if ($new -eq $unit.Files.Count) { "新增" } elseif ($new -gt 0 -or $chg -gt 0) { "更新" } else { "无变化" }
  return [pscustomobject]@{ Action = $action; New = $new; Changed = $chg; Same = $same }
}

# remote dirs containing SKILL.md, for same-name-different-path detection
$remoteSkillDirNames = @{}
foreach ($rp in $remoteMap.Keys) {
  if ($rp -match "(^|/)SKILL\.md$") {
    $parent = ($rp -split "/")[0..((($rp -split "/").Count) - 2)] -join "/"
    $base = ($parent -split "/")[-1]
    if (-not $remoteSkillDirNames.ContainsKey($base)) { $remoteSkillDirNames[$base] = @() }
    $remoteSkillDirNames[$base] += $parent
  }
}

$plan = New-Object System.Collections.Generic.List[object]
foreach ($u in $units) {
  $cmp = Compare-Unit $u
  $name = ($u.Key -replace '^SKILL:', '' -replace '^PKG:', '')
  $collision = ""
  if ($cmp.Action -eq "新增" -and $u.Type -eq "SKILL") {
    $base = ($name -split '/')[-1]
    if ($remoteSkillDirNames.ContainsKey($base)) {
      $collision = "⚠️ 同名技能已存在于仓库其他位置: $($remoteSkillDirNames[$base] -join ', ')"
    }
  }
  $plan.Add([pscustomobject]@{
    Key = $u.Key; Type = $u.Type; Name = $name; Action = $cmp.Action
    New = $cmp.New; Changed = $cmp.Changed; Same = $cmp.Same
    Total = $u.Files.Count; LastMod = $u.LastMod; Collision = $collision
  })
}

# deletions: remote paths missing from source
$deletions = @()
if ($remoteAvailable) {
  $deletions = @($remoteMap.Keys | Where-Object { -not $sourceRelSet.ContainsKey($_) })
}

# secret scan (report file paths only, never the value)
$secretHits = @()
$scanFiles = Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in ".md", ".json", ".py", ".js", ".txt", ".yaml", ".yml" }
$hitFiles = $scanFiles | Select-String -Pattern "gk_live_[A-Za-z0-9]{8,}", "ark-[A-Za-z0-9]{16,}", "sk-[A-Za-z0-9]{20,}", "ghp_[A-Za-z0-9]{20,}", "github_pat_[A-Za-z0-9_]{20,}" -ErrorAction SilentlyContinue
foreach ($h in $hitFiles) {
  if ($h.Line -notmatch "你的|xxx|xxxx|placeholder|<") {
    $secretHits += ("{0} (line {1})" -f $h.Path.Replace("$SourceDir\", ""), $h.LineNumber)
  }
}

# ---------- render manifest ----------
$stats = @{}
foreach ($p in $plan) { if (-not $stats.ContainsKey($p.Action)) { $stats[$p.Action] = 0 }; $stats[$p.Action]++ }
$statLine = ($stats.Keys | Sort-Object | ForEach-Object { "{0} {1}" -f $stats[$_], $_ }) -join " · "

$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine("# toamyskillhub 上传清单 / Upload Manifest")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- 时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("- 源目录：$SourceDir")
[void]$sb.AppendLine("- 目标仓库：$TargetRepo（branch $Branch）")
[void]$sb.AppendLine("- 汇总：$statLine（共 $($plan.Count) 个单元）")
[void]$sb.AppendLine("- 远端状态：$(if ($remoteAvailable) { "可达；领先本地暂存 $remoteAhead 个提交$(if ($remoteAhead -gt 0) { '（执行时将自动 rebase）' })" } else { "不可达，按本地暂存对比（弱）" })")
[void]$sb.AppendLine("- 对比方式：$(if ($DeepCompare -and $remoteAvailable) { '远端 blob 哈希深度对比（-DeepCompare）' } else { '修改时间+大小（默认，秒级）' })")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 需要关注的动作")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| 动作 | 单元 | 类型 | 文件数(新/改/同) | 最近修改 | 备注 |")
[void]$sb.AppendLine("| --- | --- | --- | --- | --- | --- |")
$attention = @($plan | Where-Object { $_.Action -ne "无变化" })
foreach ($p in $attention) {
  [void]$sb.AppendLine(("| {0} | {1} | {2} | {3}({4}/{5}/{6}) | {7} | {8} |" -f $p.Action, $p.Name, $p.Type, $p.Total, $p.New, $p.Changed, $p.Same, $p.LastMod.ToString("yyyy-MM-dd HH:mm"), $p.Collision))
}
if ($attention.Count -eq 0) { [void]$sb.AppendLine("| - | 无新增/更新，仓库已是最新 | - | - | - | - |") }
[void]$sb.AppendLine("")
$unchanged = @($plan | Where-Object { $_.Action -eq "无变化" })
[void]$sb.AppendLine("## 无变化单元（$($unchanged.Count) 个，略）")
[void]$sb.AppendLine("")
[void]$sb.AppendLine(($unchanged | ForEach-Object { $_.Name }) -join "、")
[void]$sb.AppendLine("")
if ($deletions.Count -gt 0) {
  [void]$sb.AppendLine("## ⚠️ 源中已不存在但仓库仍有的路径（$($deletions.Count) 个，默认保留；加 -Mirror 同步删除）")
  $deletions | Select-Object -First 15 | ForEach-Object { [void]$sb.AppendLine("- $_") }
  [void]$sb.AppendLine("")
}
if ($oversize.Count -gt 0) {
  [void]$sb.AppendLine("## 排除的超大文件（>100MB，GitHub 硬限制）")
  foreach ($o in $oversize) { [void]$sb.AppendLine(("- {0} ({1:N1} MB)" -f $o.FullName.Replace("$SourceDir\", ""), ($o.Length / 1MB))) }
  [void]$sb.AppendLine("")
}
if ($bigWarn.Count -gt 0) {
  [void]$sb.AppendLine("## 大文件警告（50–100MB，可推但有警告）")
  foreach ($o in $bigWarn) { [void]$sb.AppendLine(("- {0} ({1:N1} MB)" -f $o.FullName.Replace("$SourceDir\", ""), ($o.Length / 1MB))) }
  [void]$sb.AppendLine("")
}
[void]$sb.AppendLine("## 安全扫描")
if ($secretHits.Count -eq 0) {
  [void]$sb.AppendLine("- 未发现真实 API Key 模式（占位符已忽略）")
} else {
  [void]$sb.AppendLine("- ⚠️ 疑似真实密钥，必须人工确认后再上传（仅列文件，不显示内容）：")
  $secretHits | ForEach-Object { [void]$sb.AppendLine("  - $_") }
}
[void]$sb.AppendLine("")
[void]$sb.AppendLine("> 确认后执行：powershell -File push_to_amyskills.ps1 ... -Confirmed")

$outFile = $ManifestPath
[IO.File]::WriteAllText($outFile, $sb.ToString(), (New-Object Text.UTF8Encoding $true))
Write-Host $sb.ToString()
Write-Ok "Manifest saved: $outFile"

if ($PlanOnly) { exit 0 }
if (-not $Confirmed) {
  Write-Host ""
  Write-Host "⏸  等待用户确认。请把上方清单展示给用户，确认后加 -Confirmed 重新运行以执行上传。(exit 3)" -ForegroundColor Magenta
  exit 3
}

# ---------- execute: stage copy ----------
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
$rcMode = "/E"; if ($Mirror) { $rcMode = "/MIR" }
$rcArgs = @($SourceDir, $StageDir, $rcMode)
$rcArgs += "/XD"; $rcArgs += $ExcludeDirs
$rcArgs += @("/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NP", "/MAX:$script:MaxFileBytes")
Write-Step "Copying to staging ($($rcMode.TrimStart('/'))) ..."
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
& robocopy @rcArgs | Out-Null
$rc = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($rc -ge 8) { Write-Die "robocopy failed with exit code $rc" }
Write-Ok ("Copy done (robocopy code {0}: 0=unchanged 1=copied 2=extras 4=mismatch)." -f $rc)

Get-ChildItem -LiteralPath $StageDir -Recurse -Force -Directory -Filter ".git" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne (Join-Path $StageDir ".git") } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# ---------- git repo ----------
if (-not (Test-Path $gitDir)) {
  Write-Step "Initializing new git repo ..."
  $r = Invoke-Git @("init", "-b", $Branch) $StageDir
  if ($r.Code -ne 0) {
    Invoke-Git @("init") $StageDir | Out-Null
    Invoke-Git @("checkout", "-b", $Branch) $StageDir | Out-Null
  }
  Invoke-Git @("remote", "add", "origin", $TargetRepo) $StageDir | Out-Null
} else {
  $r = Invoke-Git @("remote", "get-url", "origin") $StageDir
  if ($r.Code -ne 0) { Invoke-Git @("remote", "add", "origin", $TargetRepo) $StageDir | Out-Null }
  elseif ($r.Out.Trim() -ne $TargetRepo) {
    Write-Die "StageDir '$StageDir' already points at remote '$($r.Out)'. Choose another StageDir or update remote manually."
  }
}
$uname = (Invoke-Git @("config", "--local", "user.name") $StageDir).Out
if (-not $uname) {
  Invoke-Git @("config", "--local", "user.name", $IdentityName) $StageDir | Out-Null
  Invoke-Git @("config", "--local", "user.email", $IdentityEmail) $StageDir | Out-Null
  Write-Step "Local git identity set: $IdentityName <$IdentityEmail>"
}
Invoke-Git @("config", "--local", "core.safecrlf", "false") $StageDir | Out-Null

$gitignore = Join-Path $StageDir ".gitignore"
if (-not (Test-Path $gitignore)) {
  "__pycache__/`n*.pyc`nnode_modules/`n.DS_Store`nThumbs.db`n" | Out-File -FilePath $gitignore -Encoding utf8
}

$readmePath = Join-Path $StageDir "README.md"
if ((-not (Test-Path $readmePath)) -or $GenerateReadme) {
  Write-Step "Generating README skeleton ..."
  $groups = @{}
  foreach ($sf in $skillFiles) {
    $rel = $sf.FullName.Substring($SourceDir.Length).TrimStart('\')
    $top = ($rel -split '\\')[0]
    if ($rel -notmatch '\\') { $top = "root" }
    if (-not $groups.ContainsKey($top)) { $groups[$top] = @() }
    $groups[$top] += (Get-SkillMeta -Path $sf.FullName)
  }
  $pkgGroups = @{}
  foreach ($pf in $pkgFiles) {
    $top = ($pf.FullName.Substring($SourceDir.Length).TrimStart('\') -split '\\')[0]
    if (-not $pkgGroups.ContainsKey($top)) { $pkgGroups[$top] = 0 }
    $pkgGroups[$top]++
  }
  $sb2 = New-Object Text.StringBuilder
  [void]$sb2.AppendLine("# AmySkills - Skill Library (auto-generated skeleton)")
  [void]$sb2.AppendLine("")
  [void]$sb2.AppendLine(("> Generated by **toamyskillhub** on {0}. Feel free to polish by hand; regenerate only with -GenerateReadme." -f (Get-Date -Format "yyyy-MM-dd")))
  [void]$sb2.AppendLine("")
  [void]$sb2.AppendLine("| Category | Skills | Packages |")
  [void]$sb2.AppendLine("| --- | --- | --- |")
  foreach ($g in ($groups.Keys | Sort-Object)) {
    $pk = 0; if ($pkgGroups.ContainsKey($g)) { $pk = $pkgGroups[$g] }
    [void]$sb2.AppendLine(("| {0} | {1} | {2} |" -f $g, $groups[$g].Count, $pk))
  }
  [void]$sb2.AppendLine("")
  foreach ($g in ($groups.Keys | Sort-Object)) {
    [void]$sb2.AppendLine("## $g")
    [void]$sb2.AppendLine("")
    [void]$sb2.AppendLine("| Skill | Description | Path |")
    [void]$sb2.AppendLine("| --- | --- | --- |")
    foreach ($m in $groups[$g]) {
      $relPath = $m.Path.Substring($SourceDir.Length).TrimStart('\') -replace '\\', '/'
      [void]$sb2.AppendLine(("| {0} | {1} | ``{2}`` |" -f $m.Name, $m.Desc, $relPath))
    }
    [void]$sb2.AppendLine("")
  }
  [void]$sb2.AppendLine("## Install")
  [void]$sb2.AppendLine("")
  [void]$sb2.AppendLine("Copy a skill folder (contains SKILL.md) into your agent's skills directory, e.g. ~/.claude/skills/, ~/.openclaw/skills/. Review each SKILL.md before use.")
  [IO.File]::WriteAllText($readmePath, $sb2.ToString(), (New-Object Text.UTF8Encoding $true))
  Write-Ok "README skeleton written. (Agents: polish by hand for a nicer catalog.)"
} else {
  Write-Step "Existing README.md kept (use -GenerateReadme to force regenerate)."
}

# ---------- commit ----------
Invoke-Git @("add", "-A") $StageDir | Out-Null
$staged = (Invoke-Git @("status", "--porcelain") $StageDir).Out
if ($staged) {
  $r = Invoke-Git @("commit", "-m", $CommitMessage) $StageDir
  if ($r.Code -ne 0) {
    $why = if ($r.Err) { $r.Err } else { $r.Out }
    Write-Die "git commit failed: $why"
  }
  Write-Ok "Committed: $CommitMessage"
} else {
  Write-Step "Nothing new to commit."
}

# ---------- push (transport fallback + auto-rebase on divergence) ----------
function Push-Branch([string[]]$ConfigArgs) {
  return Invoke-Git ($ConfigArgs + @("push", "-u", "origin", $Branch)) $StageDir
}
Write-Step "Pushing via $proxyNote..."
$r = Push-Branch $netArgs
$usedProxyArgs = $netArgs
if ($r.Code -ne 0) {
  Write-Warn2 "Push failed via $proxyNote. $($r.Out)"
  if ($netArgs.Count -gt 0) {
    Write-Step "Retrying direct ..."
    $usedProxyArgs = @()
    $r = Push-Branch @()
  } else {
    $p2 = Get-SystemProxy
    if ($p2) {
      Write-Step "Retrying via system proxy $p2 ..."
      $usedProxyArgs = @("-c", "http.proxy=$p2", "-c", "https.proxy=$p2")
      $r = Push-Branch $usedProxyArgs
    }
  }
}
if ($r.Code -ne 0 -and $r.Out -match "fetch first|rejected|non-fast-forward") {
  Write-Step "Remote diverged (another agent/device pushed). Rebasing local commits ..."
  $rb = Invoke-Git ($usedProxyArgs + @("pull", "--rebase", "origin", $Branch)) $StageDir
  if ($rb.Code -eq 0) {
    Write-Ok "Rebase clean. Retrying push ..."
    $r = Push-Branch $usedProxyArgs
  } else {
    Invoke-Git @("rebase", "--abort") $StageDir | Out-Null
    Write-Die "Auto-rebase hit conflicts (aborted, nothing lost). Resolve manually in '$StageDir' then re-run with -Confirmed."
  }
}
if ($r.Code -ne 0) {
  Write-Host $r.Out -ForegroundColor Red
  Write-Die "Push failed. See troubleshooting section in SKILL.md (auth / proxy / repo existence)."
}
Write-Ok "Push accepted by remote."

# ---------- verify ----------
$local = (Invoke-Git @("rev-parse", "HEAD") $StageDir).Out
$remoteQ = Invoke-Git ($usedProxyArgs + @("ls-remote", "origin", "refs/heads/$Branch")) $StageDir
$verified = $false
if ($remoteQ.Code -eq 0 -and $remoteQ.Out -match "^([0-9a-f]{40})\s") { $verified = ($Matches[1] -eq $local) }

$pack = (Invoke-Git @("count-objects", "-vH") $StageDir).Out
$packSize = ""
if ($pack -match "size-pack: (.+)") { $packSize = $Matches[1].Trim() }

Write-Host "---- SUMMARY ----"
Write-Host ("Repo      : {0} (branch {1})" -f $TargetRepo, $Branch)
Write-Host ("Commit    : {0}" -f $local)
Write-Host ("Pack size : {0}" -f $packSize)
Write-Host ("Plan      : $statLine")
Write-Host ("Verify    : {0}" -f $(if ($verified) { "OK - remote SHA matches local" } else { "UNVERIFIED - run: git ls-remote origin refs/heads/$Branch" }))
Write-Host ("Manifest  : {0}" -f $outFile)
Write-Host "-----------------"
if ($verified) { exit 0 } else { exit 1 }
