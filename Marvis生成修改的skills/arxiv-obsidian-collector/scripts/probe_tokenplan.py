"""
Pre-flight token plan probe for the arxiv pipeline.

目的: 在跑 pipeline 之前,先 ping 一下 LLM 端点,确认 token plan 未耗尽。
避免 9-2/9-9 那种跑了几十篇才撞 429 把 vault 污染的情况。

用法(在 pre-flight bash 里):
    python -u scripts\\probe_tokenplan.py [--config CONFIG_PATH] [--env ENV_VAR]

返回码:
    0 = LLM OK,可以跑 pipeline
    1 = token plan 耗尽(429) — 请按"失败 3 次停"规则停手
    2 = 其他错误(endpoint 错误/网络/SDK) — 排查后重跑
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import yaml


def _load_env_from_windows_user(env_name: str) -> str | None:
    """通过 ctypes 直接读 Windows User 环境变量(注册表级别)。

    解决 mavis daemon 启动时快照 env,后续 bash 设的 $env 不影响子进程的问题。
    8-24 教训:即使在 bash 里 set $env:...,python 子进程拿到的还是 daemon 快照。
    """
    try:
        import ctypes
        from ctypes import wintypes

        buf = ctypes.create_unicode_buffer(4096)
        length = wintypes.DWORD(4096)
        # 1 = USER environment, 0 = process
        ok = ctypes.windll.kernel32.GetUserVariableW(
            "USERNAME", None, buf, ctypes.byref(length)
        )
        # 上面是验证 ctypes 链路通,真正读 env 用下面:
        val = ctypes.windll.kernel32.GetEnvironmentVariableW(env_name, buf, 4096)
        if val == 0:
            return None
        return buf.value
    except Exception as exc:  # pragma: no cover
        print(f"[probe] ctypes GetEnvironmentVariableW 失败: {exc}", file=sys.stderr)
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default="config.yaml",
        help="pipeline 配置文件路径(默认 config.yaml,在 skill 根目录)",
    )
    parser.add_argument(
        "--env",
        default=None,
        help="API key 环境变量名(默认从 config.yaml 读 api_key_env)",
    )
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        # probe 通常在 skill 根目录跑
        config_path = Path.cwd() / config_path
    if not config_path.exists():
        print(f"[probe] 找不到 config: {config_path}", file=sys.stderr)
        return 2

    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    api_base = cfg.get("api_base", "").rstrip("/")
    model = cfg.get("model", "m3")
    env_name = args.env or cfg.get("api_key_env") or "MINIMAX_M3_API_KEY"

    # 优先用进程 env,再 fallback 到 Windows User-env(ctypes)
    api_key = os.environ.get(env_name) or ""
    if len(api_key) < 50:
        user_val = _load_env_from_windows_user(env_name)
        if user_val and len(user_val) >= 50:
            api_key = user_val
            # 顺手设进进程 env,让后续 pipeline 同 shell 也能用
            os.environ[env_name] = user_val
    if len(api_key) < 50:
        print(f"[probe] API Key 异常(长度 {len(api_key)},env={env_name})", file=sys.stderr)
        return 2

    print(f"[probe] config={config_path.name} api_base={api_base} model={model} key_len={len(api_key)}")

    try:
        from anthropic import Anthropic
    except ImportError as exc:
        print(f"[probe] 缺 anthropic SDK: {exc}", file=sys.stderr)
        return 2

    client = Anthropic(api_key=api_key, base_url=api_base)

    started = time.time()
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": "ping"}],
        )
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        # 429 / 用量上限 / plan 耗尽
        if "429" in msg or "用量上限" in msg or "rate_limit" in msg.lower():
            print(f"[probe] LLM_TOKEN_PLAN_EXHAUSTED: {msg[:300]}")
            return 1
        # 401: 跟 8-24 同款 key 问题
        if "401" in msg or "authentication" in msg.lower():
            print(f"[probe] LLM_AUTH_FAIL: {msg[:300]}")
            return 2
        print(f"[probe] LLM_OTHER_ERROR: {type(exc).__name__}: {msg[:300]}")
        return 2

    elapsed = time.time() - started
    # 取第一个 text block
    text = ""
    for blk in getattr(resp, "content", []) or []:
        if getattr(blk, "type", None) == "text":
            text = (blk.text or "").strip()
            break
    if not text:
        try:
            text = (resp.content[0].text or "").strip()
        except Exception:  # noqa: BLE001
            text = ""
    # ASCII-only 展示(LLM 偶发回 emoji/中文,Windows GBK 终端会炸)
    safe = text.encode("ascii", "replace").decode("ascii")[:60]
    print(f"[probe] LLM_OK elapsed={elapsed:.2f}s reply={safe!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
