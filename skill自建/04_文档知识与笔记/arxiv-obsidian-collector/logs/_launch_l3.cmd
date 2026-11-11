@echo off
setlocal
cd /d "C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector"
if not exist logs mkdir logs

REM Load API key from User env into a normal env var
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('MINIMAX_M3_API_KEY','User')"') do set "MINIMAX_M3_API_KEY=%%i"

if "%MINIMAX_M3_API_KEY%"=="" (
  echo API KEY MISSING
  exit /b 1
)
echo API key loaded, length: %MINIMAX_M3_API_KEY:~0,10%...

REM Launch python truly detached via cmd /c start /B (so PowerShell exit doesn't kill it)
set "TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"
set "LOG=logs\L3_%TS%_nohup.log"

REM Use cmd /c start with /B so it inherits console but runs in background;
REM The new process is a child of cmd but the launching cmd will exit immediately.
start "arxiv-L3" /B cmd /c "python -u scripts\pipeline.py --layer L3 --config config.yaml > %LOG% 2>&1"

echo Detached. See %LOG%
