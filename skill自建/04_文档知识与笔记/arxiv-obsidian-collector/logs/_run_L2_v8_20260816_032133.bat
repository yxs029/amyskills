@echo off
chcp 65001 >nul
set HTTPS_PROXY=http://127.0.0.1:7892
set HTTP_PROXY=http://127.0.0.1:7892
set PYTHONUNBUFFERED=1
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set MINIMAX_M3_API_KEY=<your-m3-key>
cd /d "C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector"
python.exe -u scripts\pipeline.py --layer L2 > "C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector\logs\L2_20260816_032133_v8.log" 2>&1
