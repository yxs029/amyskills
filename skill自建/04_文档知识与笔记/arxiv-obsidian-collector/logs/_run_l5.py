"""L5 cron pre-flight + pipeline wrapper.

Loads MINIMAX_M3_API_KEY from Windows User-env (ctypes, daemon-proof),
probes arXiv, then invokes pipeline.py with the same env var.
Everything in one Python process so $env: from bash can't be lost.
"""
import os
import sys
import subprocess
import ctypes
from ctypes import wintypes

# Force UTF-8 stdout (bash tool on Windows defaults to GBK)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 1) Force-reload API key from Windows User-env (覆盖 daemon 快照)
try:
    buf = ctypes.create_unicode_buffer(2048)
    n = ctypes.windll.kernel32.GetEnvironmentVariableW("MINIMAX_M3_API_KEY", buf, 2048)
    if n > 0:
        os.environ["MINIMAX_M3_API_KEY"] = buf.value
except Exception as e:
    print(f"[WARN] ctypes key reload failed: {e}", flush=True)

key = os.environ.get("MINIMAX_M3_API_KEY", "")
print(f"API Key length: {len(key)}", flush=True)
if len(key) < 50:
    print(f"API key 异常(长度 {len(key)}),应为 125 字符。停止。", flush=True)
    sys.exit(1)

# 2) Probe arXiv
import requests

CA = r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"
PROBE_OK = False
for attempt in range(1, 5):  # 1 initial + 3 retries
    try:
        r = requests.get(
            "https://export.arxiv.org/api/query",
            params={"search_query": "all:cat", "max_results": 2},
            timeout=20,
            verify=CA,
        )
        print(f"arXiv probe (attempt {attempt}): HTTP {r.status_code}", flush=True)
        if r.status_code == 200:
            PROBE_OK = True
            break
    except Exception as e:
        print(f"arXiv probe (attempt {attempt}) exception: {e}", flush=True)
    if attempt < 4:
        import time
        time.sleep(15)

if not PROBE_OK:
    print("arXiv 持续不可用(4 次 probe 全失败),按用户'失败 3 次停'规则,本轮放弃。", flush=True)
    sys.exit(1)

# 3) Run pipeline
print("=" * 60, flush=True)
print("Starting pipeline L5...", flush=True)
print("=" * 60, flush=True)

import time
ts = time.strftime("%Y%m%d_%H%M%S")
log_path = f"logs/L5_{ts}.log"
cmd = [sys.executable, "-u", "scripts/pipeline.py", "--layer", "L5", "--config", "config.yaml"]
print(f"CMD: {' '.join(cmd)}", flush=True)
print(f"LOG: {log_path}", flush=True)

with open(log_path, "w", encoding="utf-8") as f:
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
    )
    import io
    decoder = io.TextIOWrapper(proc.stdout, encoding="utf-8", errors="replace", line_buffering=True)
    try:
        for line in decoder:
            sys.stdout.write(line)
            sys.stdout.flush()
            f.write(line)
    finally:
        decoder.detach()
    proc.wait()
    rc = proc.returncode

print(f"Pipeline exit: {rc}", flush=True)
sys.exit(rc)
