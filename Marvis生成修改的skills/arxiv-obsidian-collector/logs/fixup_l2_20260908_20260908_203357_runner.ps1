Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable('MINIMAX_M3_API_KEY','User')
python -u scripts\fixup_l2_20260825.py 2>&1 | Tee-Object -FilePath logs\fixup_l2_20260908_20260908_203357.log
