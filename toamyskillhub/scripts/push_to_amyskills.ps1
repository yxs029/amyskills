<#
.SYNOPSIS
  toamyskillhub - Publish/sync a local skill library to the amyskills GitHub repo.

.DESCRIPTION
  Steps: validate source -> robocopy to staging (exclude >100MB files / junk dirs)
  -> ensure git repo + local identity -> generate README skeleton if missing
  -> commit -> push (direct first; retry via detected system proxy) ->
  verify remote SHA matches local HEAD.

.EXAMPLE
  .\push_to_amyskills.ps1 -SourceDir "D:\MySkills"
.EXAMPLE
  .\push_to_amyskills.ps1 -SourceDir "D:\MySkills" -StageDir "D:\stage\amyskills" -Proxy none -DryRun
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
  [switch]$GenerateReadme,
  [switch]$Mirror,
  [switch]$DryRun
)

# ---------- helpers ----------
$script:MaxFileBytes = 104857600   # GitHub hard limit: 100MB per file
$script:WarnFileBytes = 52428800   # GitHub soft warning: 50MB

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

# Extract name + description from a SKILL.md YAML frontmatter (supports > | multiline blocks).
function Get-SkillMeta([string]$Path) {
  $lines = Get-Content -Path $Path -TotalCount 40 -Encoding UTF8
  $name = ""; $desc = ""; $inDesc = $false; $frontmatterCount = 0
  foreach ($l in $lines) {
    if ($l -match '^---\s*$') {
      $frontmatterCount++
      if ($frontmatterCount -ge 2) { break }
      continue
    }
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

# ---------- resolve params ----------
if (-not $SourceDir) { $SourceDir = $env:AMS_SOURCE_DIR }
if (-not $SourceDir) { $SourceDir = "F:\OPRASE-AMY\08AI操作系统\MySkills" }
if (-not $StageDir)  { $StageDir = $env:AMS_STAGE_DIR }
if (-not $StageDir)  { $StageDir = Join-Path $env:USERPROFILE "amyskills-stage" }
if (-not $CommitMessage) {
  $CommitMessage = "chore: sync skills from {0} ({1})" -f (Split-Path $SourceDir -Leaf), (Get-Date -Format "yyyy-MM-dd HH:mm")
}

$resolved = Resolve-Path -LiteralPath $SourceDir -ErrorAction SilentlyContinue
if (-not $resolved) { Write-Die "SourceDir not found. Pass -SourceDir or set AMS_SOURCE_DIR." }
$SourceDir = $resolved.Path.TrimEnd('\')
$StageDir  = $StageDir.TrimEnd('\')

if (($StageDir + '\').StartsWith($SourceDir + '\', 'OrdinalIgnoreCase')) {
  Write-Die "StageDir must not live inside SourceDir (would recurse)."
}
if (-not $TargetRepo.EndsWith(".git")) { $TargetRepo = $TargetRepo + ".git" }

Write-Step "Source : $SourceDir"
Write-Step "Stage  : $StageDir"
Write-Step "Repo   : $TargetRepo (branch $Branch)"

$skillFiles = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -Filter "SKILL.md" -File -ErrorAction SilentlyContinue)
$pkgFiles   = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -in ".zip", ".skill" })
Write-Step ("Found {0} SKILL.md and {1} installable packages." -f $skillFiles.Count, $pkgFiles.Count)

$oversize = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Length -gt $script:MaxFileBytes })
foreach ($f in $oversize) { Write-Warn2 ("Excluded (>{0}MB, GitHub limit): {1}" -f 100, $f.Name) }
$bigWarn = @(Get-ChildItem -LiteralPath $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
             Where-Object { $_.Length -gt $script:WarnFileBytes -and $_.Length -le $script:MaxFileBytes })
foreach ($f in $bigWarn) { Write-Warn2 ("Large file (50-100MB, pushable): {0}" -f $f.Name) }

# ---------- proxy decision ----------
$proxyArgs = @()
$proxyNote = "direct"
if ($Proxy -eq "auto") {
  $p = Get-SystemProxy
  if ($p) {
    $uri = $p -replace "^https?://", "" -split ":" | Select-Object -First 2
    if (Test-TcpPort -HostName $uri[0] -Port ([int]$uri[1])) {
      $proxyArgs = @("-c", "http.proxy=$p", "-c", "https.proxy=$p")
      $proxyNote = "system-proxy $p (direct will be tried as fallback)"
      Write-Step "System proxy detected: $p"
    } else {
      Write-Step "System proxy $($p) found but port closed; using direct."
    }
  } else {
    Write-Step "No system proxy detected; using direct."
  }
} elseif ($Proxy -ne "none") {
  $proxyArgs = @("-c", "http.proxy=$Proxy", "-c", "https.proxy=$Proxy")
  $proxyNote = "explicit proxy $Proxy"
}

if ($DryRun) {
  Write-Host "---- DRY RUN ----"
  Write-Host "Would copy   : $SourceDir -> $StageDir (mode: $(if ($Mirror) { 'mirror' } else { 'incremental' }))"
  Write-Host "Exclude dirs : $($ExcludeDirs -join ', '); files >100MB: $($oversize.Count)"
  Write-Host "README       : $(if ((Test-Path (Join-Path $StageDir 'README.md')) -and -not $GenerateReadme) { 'keep existing' } else { 'generate skeleton' })"
  Write-Host "Commit       : $CommitMessage"
  Write-Host "Push         : $TargetRepo [$Branch] via $proxyNote"
  Write-Host "---- END DRY RUN ----"
  exit 0
}

# ---------- stage copy ----------
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
$rcMode = "/E"; if ($Mirror) { $rcMode = "/MIR" }
$rcArgs = @($SourceDir, $StageDir, $rcMode)
$rcArgs += "/XD"; $rcArgs += $ExcludeDirs
$rcArgs += @("/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NP", "/MAX:$script:MaxFileBytes")

Write-Step "Copying to staging ($($rcMode.TrimStart('/'))) ..."
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
& robocopy $rcArgs | Out-Null
$rc = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($rc -ge 8) { Write-Die "robocopy failed with exit code $rc" }
Write-Ok ("Copy done (robocopy code {0}: 0=unchanged 1=copied 2=extras 4=mismatch)." -f $rc)

# clean stray nested .git that may exist from older runs (robocopy /XD already prevents new ones)
Get-ChildItem -LiteralPath $StageDir -Recurse -Force -Directory -Filter ".git" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne (Join-Path $StageDir ".git") } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# ---------- git repo ----------
$gitDir = Join-Path $StageDir ".git"
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

# ---------- README skeleton (only when missing or forced) ----------
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
    $rel = $pf.FullName.Substring($SourceDir.Length).TrimStart('\')
    $top = ($rel -split '\\')[0]
    if (-not $pkgGroups.ContainsKey($top)) { $pkgGroups[$top] = 0 }
    $pkgGroups[$top]++
  }
  $sb = New-Object Text.StringBuilder
  [void]$sb.AppendLine("# AmySkills - Skill Library (auto-generated skeleton)")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("> Generated by **toamyskillhub** on {0}. Feel free to polish this file by hand; the script only regenerates it with -GenerateReadme." -f (Get-Date -Format "yyyy-MM-dd"))
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("| Category | Skills | Packages |")
  [void]$sb.AppendLine("| --- | --- | --- |")
  foreach ($g in ($groups.Keys | Sort-Object)) {
    $pk = 0; if ($pkgGroups.ContainsKey($g)) { $pk = $pkgGroups[$g] }
    [void]$sb.AppendLine("| {0} | {1} | {2} |" -f $g, $groups[$g].Count, $pk)
  }
  [void]$sb.AppendLine("")
  foreach ($g in ($groups.Keys | Sort-Object)) {
    [void]$sb.AppendLine("## $g")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Skill | Description | Path |")
    [void]$sb.AppendLine("| --- | --- | --- |")
    foreach ($m in $groups[$g]) {
      $relPath = $m.Path.Substring($SourceDir.Length).TrimStart('\') -replace '\\', '/'
      [void]$sb.AppendLine("| {0} | {1} | ``{2}`` |" -f $m.Name, $m.Desc, $relPath)
    }
    [void]$sb.AppendLine("")
  }
  [void]$sb.AppendLine("## Install")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("Copy a skill folder (contains SKILL.md) into your agent's skills directory, e.g. ~/.claude/skills/, ~/.openclaw/skills/. Review each SKILL.md before use.")
  [IO.File]::WriteAllText($readmePath, $sb.ToString(), (New-Object Text.UTF8Encoding $true))
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

# ---------- push (with proxy fallback + auto-rebase on divergence) ----------
# IMPORTANT: `-c http.proxy=...` must precede the subcommand, hence ConfigArgs come first.
function Push-Branch([string[]]$ConfigArgs) {
  return Invoke-Git ($ConfigArgs + @("push", "-u", "origin", $Branch)) $StageDir
}
Write-Step "Pushing via $proxyNote ..."
$r = Push-Branch $proxyArgs
$usedProxyArgs = $proxyArgs
if ($r.Code -ne 0) {
  Write-Warn2 "Push failed via $proxyNote. $($r.Out)"
  if ($proxyArgs.Count -gt 0) {
    Write-Step "Retrying direct ..."
    $usedProxyArgs = @()
    $r = Push-Branch @()
  } elseif ($Proxy -eq "auto") {
    $p = Get-SystemProxy
    if ($p) {
      Write-Step "Retrying via system proxy $p ..."
      $usedProxyArgs = @("-c", "http.proxy=$p", "-c", "https.proxy=$p")
      $r = Push-Branch $usedProxyArgs
    }
  }
}
# Multi-agent/multi-device sync: remote moved ahead -> rebase local commits and retry once.
if ($r.Code -ne 0 -and $r.Out -match "fetch first|rejected|non-fast-forward") {
  Write-Step "Remote diverged (another agent/device pushed). Rebasing local commits ..."
  $rb = Invoke-Git ($usedProxyArgs + @("pull", "--rebase", "origin", $Branch)) $StageDir
  if ($rb.Code -eq 0) {
    Write-Ok "Rebase clean. Retrying push ..."
    $r = Push-Branch $usedProxyArgs
  } else {
    Invoke-Git @("rebase", "--abort") $StageDir | Out-Null
    Write-Die "Auto-rebase hit conflicts (aborted, nothing lost). Resolve manually in '$StageDir' then re-run this script."
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
Write-Host ("Skills    : {0} SKILL.md, {1} packages" -f $skillFiles.Count, $pkgFiles.Count)
Write-Host ("Verify    : {0}" -f $(if ($verified) { "OK - remote SHA matches local" } else { "UNVERIFIED - run: git ls-remote origin refs/heads/$Branch" }))
if ($oversize.Count -gt 0) {
  Write-Host ("Excluded  : {0} file(s) over 100MB (see WARN above); note them in README." -f $oversize.Count)
}
Write-Host "-----------------"
if ($verified) { exit 0 } else { exit 1 }
