#!/usr/bin/env python3
"""
单层任务执行器: 由 Mavis cron 调用。
- 接受 --layer 参数(可写中文层名或 ASCII 别名 L1..L5)
- 不做 round-robin(轮转由调度器负责)
- 失败时打印 stack,exit code != 0,让调度器感知失败
"""

import argparse
import io
import subprocess
import sys
import traceback
from datetime import datetime
from pathlib import Path

# Windows GBK 终端兜底(同 pipeline.py)
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream is None:
        continue
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, io.UnsupportedOperation):
        try:
            _buf = _stream.buffer  # type: ignore[attr-defined]
        except AttributeError:
            continue
        setattr(sys, _stream_name, io.TextIOWrapper(_buf, encoding="utf-8", errors="replace"))

SCRIPT_DIR = Path(__file__).parent
PIPELINE = SCRIPT_DIR / "pipeline.py"

LAYER_ALIAS = {
    "L1": "第一层-专用小模型",
    "L2": "第二层-大模型基底层",
    "L3": "第三层-大模型组件层",
    "L4": "第四层-智能体工程层",
    "L5": "第五层-行业应用层",
}


def main():
    p = argparse.ArgumentParser(
        description="arxiv-obsidian-collector dispatcher(单层)"
    )
    p.add_argument(
        "--layer", required=True,
        help="层名,可用 '第一层-专用小模型' 或 ASCII 别名 L1..L5",
    )
    p.add_argument(
        "--config", default="config.yaml",
        help="配置文件路径(相对脚本目录)",
    )
    args = p.parse_args()

    layer = LAYER_ALIAS.get(args.layer, args.layer)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{ts}] ▶ dispatcher 启动  layer={layer}")
    print(f"{'=' * 60}")

    cmd = [
        sys.executable,
        str(PIPELINE),
        "--layer", layer,
        "--config", args.config,
    ]
    print(f"$ {' '.join(cmd)}\n")

    try:
        rc = subprocess.call(cmd)
    except Exception:
        traceback.print_exc()
        rc = 1

    print(f"\n{'=' * 60}")
    if rc == 0:
        print(f"✅ [{ts}] {layer} 完成")
    else:
        print(f"❌ [{ts}] {layer} 失败,exit code = {rc}")
    sys.exit(rc)


if __name__ == "__main__":
    main()
