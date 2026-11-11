# merge_segments.ps1 v3.0 - merge numbered segment files into one deliverable.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File merge_segments.ps1 `
#       -SegName "avpl-v12-32" `
#       -OutName "05-Deliverables\price\AVPL\xxx_32char.md"
#
# Params:
#   -SegName  Segment folder name (relative to -SegRoot). Merged by file name ASC.
#   -OutName  Output file. Relative -> resolved against -Base; absolute -> used as is.
#   -SegRoot  Segment root. Default: <StageDir>\data\segments
#   -Base     Project root. Default: parent of <StageDir>
#   StageDir  = first ancestor of the script dir (or CWD) that contains data\segments
#
# WHY THIS SCRIPT IS 100% ASCII (root-cause fix, v3.0):
#   v2.x hard-coded the CJK project path inside the script
#   ($base = "e:\...\SCC-...") and also carried CJK comments.
#   Windows PowerShell 5.1 reads a **BOM-less UTF-8 .ps1 as ANSI (GBK on zh-CN)**,
#   so CJK bytes are mis-decoded. Consequences observed:
#     - the hard-coded $base became garbage -> Test-Path failed ->
#       false "segment dir does not exist" error;
#     - worse, mis-decoded comment bytes broke the PARSER
#       ("Unexpected token '}' in expression or statement").
#   The old workaround was a rule "always run this script as a single command",
#   which only treated the symptom.
#   v3.0 therefore: (a) derives all paths from $PSScriptRoot / CWD, and
#   (b) keeps **zero non-ASCII characters** in this file, so the decoder
#   cannot matter at all. CJK paths arrive only via argv, which is safe.
#
# Other behaviour:
#   - Output is UTF-8 WITHOUT BOM
#   - Parent output directory is created automatically (was missing in v2.x)
#   - A trailing newline is ensured between segments

param(
    [Parameter(Mandatory = $true)][string]$SegName,
    [Parameter(Mandatory = $true)][string]$OutName,
    [string]$SegRoot,
    [string]$Base
)

$ErrorActionPreference = "Stop"

if (-not $PSScriptRoot) {
    throw "PSScriptRoot is empty. Run this script with -File, not by dot-sourcing."
}

# Resolve the 'stage dir' = the folder containing data\segments.
# Strategy per starting point: walk UP, and at every ancestor also do a
# shallow (Depth 3) scan for a 'segments' folder whose parent is named 'data'.
# This is needed because the caller's CWD is usually a deliverable subfolder
# (e.g. ...\05-...\price\AVPL\run) while data\segments lives in a sibling branch.
function Resolve-StageDir([string[]]$starts) {
    foreach ($s in $starts) {
        if (-not $s) { continue }
        $d = $s
        while ($d) {
            if (Test-Path (Join-Path (Join-Path $d "data") "segments")) { return $d }
            $hit = Get-ChildItem -Path $d -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue |
                   Where-Object { $_.Name -eq "segments" -and $_.Parent.Name -eq "data" } |
                   Select-Object -First 1
            if ($hit) { return (Split-Path $hit.Parent.FullName -Parent) }
            $parent = Split-Path $d -Parent
            if (-not $parent -or $parent -eq $d) { break }
            $d = $parent
        }
    }
    return $null
}

$ScriptDir = $PSScriptRoot
$StageDir  = Resolve-StageDir @((Get-Location).Path, $ScriptDir)
if (-not $StageDir) {
    throw "Cannot locate a data\segments folder. Pass -SegRoot and -Base explicitly."
}

if (-not $SegRoot) { $SegRoot = Join-Path (Join-Path $StageDir "data") "segments" }
if (-not $Base)    { $Base    = Split-Path $StageDir -Parent }

$segDir = Join-Path $SegRoot $SegName
if ([System.IO.Path]::IsPathRooted($OutName)) {
    $outFile = $OutName
} else {
    $outFile = Join-Path $Base $OutName
}

if (-not (Test-Path $segDir)) { throw "Segment dir not found: $segDir" }

$outDir = Split-Path $outFile -Parent
if (-not (Test-Path $outDir)) {
    [void](New-Item -ItemType Directory -Path $outDir -Force)
    Write-Host ("  created output dir: " + $outDir)
}

$files = Get-ChildItem -Path $segDir -Filter "*.md" | Sort-Object Name
if ($files.Count -eq 0) { throw "Segment dir is empty: $segDir" }

$sb = New-Object System.Text.StringBuilder
foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    [void]$sb.Append($text)
    if (-not $text.EndsWith("`n")) { [void]$sb.Append("`r`n") }
    Write-Host ("  + " + $f.Name)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)

$lineCount = [System.IO.File]::ReadAllLines($outFile).Count
$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)

Write-Host ""
Write-Host "Merged -> $outFile"
Write-Host ("segments: " + $files.Count + " | lines: " + $lineCount + " | size: " + $sizeKB + " KB")
