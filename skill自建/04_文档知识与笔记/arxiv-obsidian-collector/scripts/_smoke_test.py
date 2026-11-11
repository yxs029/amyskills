#!/usr/bin/env python3
"""Smoke test: verify MINIMAX_M3_API_KEY works against minimaxi anthropic endpoint."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scorer import make_minimax_client, call_llm

print(f"[env] MINIMAX_M3_API_KEY present: {bool(os.environ.get('MINIMAX_M3_API_KEY'))}, length: {len(os.environ.get('MINIMAX_M3_API_KEY',''))}")
print(f"[env] api_base: {os.environ.get('HTTPS_PROXY') or 'no proxy'}")

try:
    client = make_minimax_client()
    print(f"[ok] client built: {type(client).__name__}")
except Exception as e:
    print(f"[fail] client build: {type(e).__name__}: {e}")
    sys.exit(1)

try:
    out = call_llm(client, "你是什么模型?一句话回答。")
    print(f"[ok] LLM response: {out[:200]}")
except Exception as e:
    print(f"[fail] LLM call: {type(e).__name__}: {str(e)[:400]}")
    sys.exit(2)
